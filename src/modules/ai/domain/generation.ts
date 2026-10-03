import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { AI_ERROR } from "./errors";
import type { AiPurpose } from "./purpose";

export type GenerationStatus = "queued" | "running" | "done" | "failed";

// One model call, audited (documento-maestro §6.1). `pageId` is null when the
// purpose is not tied to a page.
export interface AiGeneration {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string | null;
  readonly purpose: AiPurpose;
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly status: GenerationStatus;
  readonly error: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewGeneration {
  id: string;
  ownerId: string;
  pageId: string | null;
  purpose: AiPurpose;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface GenerationUsage {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export function startGeneration(
  input: NewGeneration,
  clock: Clock,
): AiGeneration {
  const now = clock.now();
  return {
    ...input,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
    status: "running",
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

function invalidTransition(
  from: GenerationStatus,
  to: GenerationStatus,
): DomainError {
  return new DomainError(
    AI_ERROR.INVALID_TRANSITION,
    `A generation cannot move from ${from} to ${to}`,
  );
}

export function completeGeneration(
  generation: AiGeneration,
  usage: GenerationUsage,
  clock: Clock,
): Result<AiGeneration, DomainError> {
  if (generation.status !== "running") {
    return err(invalidTransition(generation.status, "done"));
  }
  return ok({
    ...generation,
    ...usage,
    status: "done",
    error: null,
    updatedAt: clock.now(),
  });
}

export function failGeneration(
  generation: AiGeneration,
  reason: string,
  clock: Clock,
): Result<AiGeneration, DomainError> {
  if (generation.status !== "running" && generation.status !== "queued") {
    return err(invalidTransition(generation.status, "failed"));
  }
  return ok({
    ...generation,
    status: "failed",
    error: reason,
    updatedAt: clock.now(),
  });
}
