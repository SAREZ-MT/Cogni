import { type LanguageModel, generateObject as sdkGenerateObject } from "ai";
import type { ZodType } from "zod";
import type { AiProvider } from "../application/ports";

// The slice of the AI SDK `generateObject` this adapter relies on, so tests
// inject a stub with no network. `usage` fields are `number | undefined` in
// AI SDK v7 (`LanguageModelUsage`).
export type GenerateObjectFn = (options: {
  model: LanguageModel;
  schema: ZodType<unknown>;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens?: number;
}) => Promise<{
  object: unknown;
  usage: {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
  };
}>;

// `generateObject` is marked @deprecated in ai@7 in favor of `generateText`
// with `output`, but still ships and is the call the project decisions fix
// (documento-maestro §8.1). Revisit when it is removed.
const defaultGenerateObject: GenerateObjectFn = (options) =>
  sdkGenerateObject(options);

export function createAiSdkProvider(options: {
  id: string;
  modelId: string;
  model: LanguageModel;
  generateObject?: GenerateObjectFn;
  nowMs?: () => number;
}): AiProvider {
  const call = options.generateObject ?? defaultGenerateObject;
  const nowMs = options.nowMs ?? Date.now;
  return {
    id: options.id,
    model: options.modelId,
    async generateObject(request) {
      const startedAt = nowMs();
      // Errors (transport, provider, NoObjectGeneratedError) propagate: the
      // use case records the failure and rotates.
      const result = await call({
        model: options.model,
        schema: request.schema as ZodType<unknown>,
        system: request.system,
        prompt: request.prompt,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
      });
      return {
        object: result.object,
        usage: {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
        },
        latencyMs: nowMs() - startedAt,
      };
    },
  };
}
