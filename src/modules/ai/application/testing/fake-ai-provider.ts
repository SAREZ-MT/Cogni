import type {
  AiProvider,
  GenerateObjectRequest,
  GenerateObjectResponse,
} from "../ports";

export type FakeOutcome =
  | { object: unknown }
  | { throw: Error }
  | { invalid: true };

// Plays a scripted queue of outcomes, one per call, and records every request.
// An exhausted script throws so an unexpected extra call fails loudly.
export class FakeAiProvider implements AiProvider {
  readonly calls: GenerateObjectRequest<unknown>[] = [];
  private readonly queue: FakeOutcome[];

  constructor(
    readonly id: string,
    readonly model: string,
    script: readonly FakeOutcome[] = [],
  ) {
    this.queue = [...script];
  }

  async generateObject<T>(
    request: GenerateObjectRequest<T>,
  ): Promise<GenerateObjectResponse> {
    this.calls.push(request);
    const outcome = this.queue.shift();
    if (!outcome) throw new Error("FakeAiProvider script exhausted");
    if ("throw" in outcome) throw outcome.throw;
    const object = "invalid" in outcome ? { unexpected: true } : outcome.object;
    return {
      object,
      usage: { inputTokens: 10, outputTokens: 20 },
      latencyMs: 5,
    };
  }
}
