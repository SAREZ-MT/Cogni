import type { ZodType } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  type AiGeneration,
  type AiPurpose,
  type BreakerState,
  budgetGroupOf,
  completeGeneration,
  estimateTokens,
  failGeneration,
  isOpen,
  type ProviderEntry,
  type ProviderUsage,
  quotaKeyOf,
  recordFailure,
  recordSuccess,
  selectProvider,
  startGeneration,
  vendorOf,
} from "../domain";
import { AI_ERROR } from "../domain/errors";
import type {
  AiGenerationRepository,
  AiProviderMap,
  BreakerStore,
  BudgetStore,
  IdGenerator,
  QuotaStore,
} from "./ports";
import { outputSchemaFor, providerSchemaFor } from "./schemas";

export interface GenerateStructuredInput {
  purpose: AiPurpose;
  pageId: string | null;
  promptVersion: string;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens?: number;
  // Longest wait for one provider attempt; past it the attempt is aborted
  // and the next provider is tried. Defaults to ATTEMPT_TIMEOUT_MS.
  timeoutMs?: number;
  // The caller giving up (its own deadline). Aborts the running attempt and
  // ends the generation without trying another provider.
  signal?: AbortSignal;
}

export interface GenerateStructuredDeps {
  entries: readonly ProviderEntry[];
  providers: AiProviderMap;
  quota: QuotaStore;
  // App-wide daily budget of the purpose's group, charged per attempt.
  budget: BudgetStore;
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

// Two attempts stay well inside the 300 s function limit.
export const ATTEMPT_TIMEOUT_MS = 60_000;

// Settles with the call or rejects with the signal's reason, whichever comes
// first, so an adapter that ignores the signal cannot hold the use case.
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

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
  const quotaKeys = new Set(deps.entries.map(quotaKeyOf));
  await Promise.all([
    ...[...quotaKeys].map(async (key) => {
      usage[key] = await deps.quota.readUsage(key, now);
    }),
    ...deps.entries.map(async (entry) => {
      const state = await deps.breakers.read(entry.id);
      breakers[entry.id] = state;
      if (isOpen(state, now)) unhealthyIds.add(entry.id);
    }),
  ]);
  return { usage, breakers, unhealthyIds };
}

// Charges one attempt to the app-wide budget. Fails closed: a store that
// cannot answer refuses the call like a spent budget.
async function withinBudget(
  deps: GenerateStructuredDeps,
  purpose: AiPurpose,
  now: Date,
): Promise<boolean> {
  try {
    return await deps.budget.consume(budgetGroupOf(purpose), now);
  } catch {
    return false;
  }
}

// Single entry point for every model call (documento-maestro §8.1): select a
// provider, call it, validate against the purpose schema, audit every attempt
// and retry once on the next provider, of another vendor when one is
// eligible. Every attempt runs under its own timeout (and the caller's
// signal); an abort is a failed attempt. Every attempt is first charged to
// the app-wide daily budget of its purpose; a spent budget ends the
// generation with AI_DAILY_BUDGET_EXHAUSTED before the provider is called
// or the attempt audited. Never invents an object.
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
  // The retry prefers another vendor: two models behind one key (or one
  // vendor's outage) must not take both attempts.
  const failedVendors: string[] = [];
  // Same word-based estimate as the page cap; skips providers whose prompt
  // ceiling (a small tokens-per-minute window) it would exceed.
  const promptTokens = estimateTokens(`${input.system}\n${input.prompt}`);
  let lastFailedId: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const now = deps.clock.now();
    const snap = await snapshot(deps, now);
    const entry = selectProvider(deps.entries, {
      purpose: input.purpose,
      unhealthyIds: snap.unhealthyIds,
      usage: snap.usage,
      exclude: failedProviders,
      avoidVendors: failedVendors,
      promptTokens,
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

    // Charged only once a provider is chosen, so an attempt that calls
    // nothing costs nothing.
    if (!(await withinBudget(deps, input.purpose, now))) {
      return err(
        new DomainError(
          AI_ERROR.DAILY_BUDGET_EXHAUSTED,
          "The app-wide daily AI budget for this purpose is spent",
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
    await deps.quota.recordCall(quotaKeyOf(entry), now);

    let failure: string | null = null;
    const timeout = AbortSignal.timeout(input.timeoutMs ?? ATTEMPT_TIMEOUT_MS);
    const signal = input.signal
      ? AbortSignal.any([timeout, input.signal])
      : timeout;
    try {
      const provider = deps.providers.get(entry.id);
      if (!provider) throw new Error("provider not configured");
      const response = await abortable(
        provider.generateObject({
          // Same shape without the size caps, which only the validation
          // below applies (some providers refuse them in a schema).
          schema: providerSchemaFor(input.purpose),
          system: input.system,
          prompt: input.prompt,
          temperature,
          maxOutputTokens: input.maxOutputTokens,
          signal,
        }),
        signal,
      );
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
    // The caller gave up: the provider is not blamed and no other is tried.
    if (input.signal?.aborted) {
      return err(new AiGenerationFailedError(started.id));
    }
    await deps.breakers.write(
      entry.id,
      recordFailure(snap.breakers[entry.id], deps.clock.now()),
    );
    failedProviders.push(entry.id);
    failedVendors.push(vendorOf(entry));
    lastFailedId = started.id;
  }

  // lastFailedId is always set once the loop exhausts its attempts.
  return err(new AiGenerationFailedError(lastFailedId as string));
}
