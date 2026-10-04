import type { GenerationRateLimiter } from "@/modules/ai";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";

// Uses `peek`: reading the counter must never consume a generation.
export async function getGenerationStatus(
  deps: { limiter: GenerationRateLimiter },
  ownerId: string,
): Promise<Result<{ remainingToday: number; resetAt: Date }, DomainError>> {
  const limit = await deps.limiter.peek(ownerId);
  return ok({ remainingToday: limit.remaining, resetAt: limit.resetAt });
}
