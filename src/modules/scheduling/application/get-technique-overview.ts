import type { Clock } from "@/shared/kernel/clock";
import { startOfTodayIn, startOfTomorrowIn } from "../domain/calendar";
import {
  type TechniqueOverview,
  toTechniqueOverview,
} from "../domain/technique-overview";
import type { TechniqueOverviewReader } from "../domain/technique-overview-reader";

export interface GetTechniqueOverviewDeps {
  reader: TechniqueOverviewReader;
  clock: Clock;
}

export interface GetTechniqueOverviewInput {
  ownerId: string;
  // The profile's zone: "tomorrow" starts at its local midnight.
  timeZone: string;
}

// Home's technique cards (Phase 8 H2-T5f, H2-T5i): per technique, the
// owner's live item count, the next due date from tomorrow on, and today's
// study units (pages pending and pages done), all bound to the owner's
// local day. Items due later today are already pending (listDueToday uses
// the same bound: reviews are due per local day, user decision
// 2026-10-18), so the next review is always on a later day.
export async function getTechniqueOverview(
  input: GetTechniqueOverviewInput,
  deps: GetTechniqueOverviewDeps,
): Promise<TechniqueOverview> {
  const now = deps.clock.now();
  const snapshot = await deps.reader.readTechniqueSnapshot(input.ownerId, {
    reviewedFrom: startOfTodayIn(now, input.timeZone),
    dueBefore: startOfTomorrowIn(now, input.timeZone),
  });
  return toTechniqueOverview(snapshot);
}
