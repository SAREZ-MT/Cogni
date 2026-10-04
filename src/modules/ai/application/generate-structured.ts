import type { ZodType } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  type AiGeneration,
  type AiPurpose,
  type BreakerState,
  completeGeneration,
  failGeneration,
  isOpen,
  type ProviderEntry,
  type ProviderUsage,
  recordFailure,
  recordSuccess,
  selectProvider,
  startGeneration,
} from "../domain";
import { AI_ERROR } from "../domain/errors";
import type {
  AiGenerationRepository,
  AiProviderMap,
  BreakerStore,
  IdGenerator,
  QuotaStore,
} from "./ports";
import { outputSchemaFor } from "./schemas";

export interface GenerateStructuredInput {
  purpose: AiPurpose;
  pageId: string | null;
  promptVersion: string;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens?: number;
}

export interface GenerateStructuredDeps {
  entries: readonly ProviderEntry[];
  providers: AiProviderMap;
  quota: QuotaStore;
  breakers: BreakerStore;
  generations: AiGenerationRepository;
  clock: Clock;
  ids: IdGenerator;
}

export interface GenerateStructuredOutput {
  object: unknown;
  generation: AiGeneration;
}

// A failed generation carries the id of the last audited attempt so callers
// can reference it without another lookup.
export class AiGenerationFailedError extends DomainError {
  readonly generationId: string;

  constructor(generationId: string) {
    super(AI_ERROR.GENERATION_FAILED, "The AI generation failed");
    this.generationId = generationId;
  }
}

// documento-maestro §8.1: <= 0.3 evaluation, <= 0.7 generation.
const EVALUATION_PURPOSES: readonly AiPurpose[] = [
  "evaluate_recall_answer",
  "session_feedback",
];

export function maxTemperatureFor(purpose: AiPurpose): number {
  return EVALUATION_PURPOSES.includes(purpose) ? 0.3 : 0.7;
}

const MAX_ATTEMPTS = 2;

// Never copies provider messages: they can echo request data or secrets.
function failureReason(error: unknown): string {
  const name = error instanceof Error ? error.name : "UnknownError";
  return `provider_error: ${name}`;
}

async function snapshot(
  deps: GenerateStructuredDeps,
  now: Date,
): Promise<{
  usage: Record<string, ProviderUsage>;
  breakers: Record<string, BreakerState>;
  unhealthyIds: Set<string>;
}> {
  const usage: Record<string, ProviderUsage> = {};
  const breakers: Record<string, BreakerState> = {};
  const unhealthyIds = new Set<string>();
  await Promise.all(
    deps.entries.map(async (entry) => {
      usage[entry.id] = await deps.quota.readUsage(entry.id, now);
      const state = await deps.breakers.read(entry.id);
      breakers[entry.id] = state;
      if (isOpen(state, now)) unhealthyIds.add(entry.id);
    }),
  );
  return { usage, breakers, unhealthyIds };
}

// Single entry point for every model call (documento-maestro §8.1): select a
// provider, call it, validate against the purpose schema, audit every attempt
// and retry once on the next provider. Never invents an object.
export async function generateStructured(
  input: GenerateStructuredInput,
  deps: GenerateStructuredDeps,
  ownerId: string,
): Promise<Result<GenerateStructuredOutput, DomainError>> {
  const schema: ZodType<unknown> = outputSchemaFor(input.purpose);
  const temperature = Math.min(
    input.temperature,
    maxTemperatureFor(input.purpose),
  );
  const failedProviders: string[] = [];
  let lastFailedId: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const now = deps.clock.now();
    const snap = await snapshot(deps, now);
    const entry = selectProvider(deps.entries, {
      purpose: input.purpose,
      unhealthyIds: snap.unhealthyIds,
      usage: snap.usage,
      exclude: failedProviders,
    });
    if (entry === null) {
      if (lastFailedId !== null) {
        return err(new AiGenerationFailedError(lastFailedId));
      }
      return err(
        new DomainError(
          AI_ERROR.NO_PROVIDER_AVAILABLE,
          "No AI provider is available for this purpose",
        ),
      );
    }

    const started = startGeneration(
      {
        id: deps.ids.next(),
        ownerId,
        pageId: input.pageId,
        purpose: input.purpose,
        provider: entry.id,
        model: entry.model,
        promptVersion: input.promptVersion,
      },
      deps.clock,
    );
    await deps.generations.create(started);
    await deps.quota.recordCall(entry.id, now);

    let failure: string | null = null;
    try {
      const provider = deps.providers.get(entry.id);
      if (!provider) throw new Error("provider not configured");
      const response = await provider.generateObject({
        schema,
        system: input.system,
        prompt: input.prompt,
        temperature,
        maxOutputTokens: input.maxOutputTokens,
      });
      const parsed = schema.safeParse(response.object);
      if (parsed.success) {
        const completed = completeGeneration(
          started,
          {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            latencyMs: response.latencyMs,
          },
          deps.clock,
        );
        if (!completed.ok) return completed;
        await deps.generations.update(completed.value);
        await deps.breakers.write(entry.id, recordSuccess());
        return ok({ object: parsed.data, generation: completed.value });
      }
      failure = "invalid_output";
    } catch (error) {
      failure = failureReason(error);
    }

    const failed = failGeneration(started, failure, deps.clock);
    if (!failed.ok) return failed;
    await deps.generations.update(failed.value);
    await deps.breakers.write(
      entry.id,
      recordFailure(snap.breakers[entry.id], deps.clock.now()),
    );
    failedProviders.push(entry.id);
    lastFailedId = started.id;
  }

  // lastFailedId is always set once the loop exhausts its attempts.
  return err(new AiGenerationFailedError(lastFailedId as string));
}
