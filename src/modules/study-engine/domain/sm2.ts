import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { STUDY_ENGINE_ERROR } from "./errors";
import { MIN_EASINESS, type Quality, type Sm2State } from "./study-item";

const DAY_MS = 86_400_000;

// SM-2 exactly as documento-maestro §7.1. Pure: no clock, no side effects.
//
//   if q < 3:  n = 0, I = 1
//   if q >= 3: I = 1 (n = 0) | 6 (n = 1) | round(I_prev * EF_prev) (n >= 2)
//              n = n + 1
//   EF = max(1.3, EF + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
//   due_at = now + I days; lapses += 1 if q < 3
//
// The interval uses the easiness *before* this review's update, because the
// spec lists the EF update after the interval step.
export function applySm2(
  state: Sm2State,
  quality: Quality,
  now: Date,
): Result<Sm2State, DomainError> {
  if (!isQuality(quality)) {
    return err(
      new DomainError(
        STUDY_ENGINE_ERROR.INVALID_QUALITY,
        "quality must be an integer between 0 and 5",
      ),
    );
  }

  const failed = quality < 3;
  let intervalDays: number;
  let repetitions: number;

  if (failed) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (state.repetitions === 0) {
      intervalDays = 1;
    } else if (state.repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(state.intervalDays * state.easiness);
    }
    repetitions = state.repetitions + 1;
  }

  const missed = 5 - quality;
  const easiness = Math.max(
    MIN_EASINESS,
    state.easiness + (0.1 - missed * (0.08 + missed * 0.02)),
  );

  return ok({
    easiness,
    intervalDays,
    repetitions,
    // Dates are UTC instants; "I days" is I * 24 h (§12).
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
    lastQuality: quality,
    lastReviewedAt: now,
    lapses: failed ? state.lapses + 1 : state.lapses,
  });
}

function isQuality(value: unknown): value is Quality {
  return (
    Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 5
  );
}
