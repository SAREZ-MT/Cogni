import type { StudyItemKind } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { startOfTomorrowIn } from "../domain/calendar";
import type { DueKind, DueTodayPage } from "../domain/due-today";
import type { DueTodayReader } from "../domain/due-today-reader";

// Compile-time guard: DueKind mirrors study-engine's StudyItemKind, so a new
// technique kind breaks the build here instead of silently counting 0.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const kindsMatch: Same<DueKind, StudyItemKind> = true;
void kindsMatch;

export interface ListDueTodayDeps {
  reader: DueTodayReader;
  clock: Clock;
}

export interface ListDueTodayInput {
  ownerId: string;
  // The profile's zone: "today" is the local day of the clock's now in it.
  timeZone: string;
}

// "Repasos de hoy" (documento-maestro §3.5): the owner's pages with items
// due today, the page that has waited longest first. Reviews are due per
// local day (user decision 2026-10-18: SM-2 schedules days, and the whole
// day is review time), so an item due later today already counts; the
// bound is the start of tomorrow in the owner's zone. `now` comes from the
// injected clock so tests can pin the day.
export async function listDueToday(
  input: ListDueTodayInput,
  deps: ListDueTodayDeps,
): Promise<DueTodayPage[]> {
  return deps.reader.listDueToday(
    input.ownerId,
    startOfTomorrowIn(deps.clock.now(), input.timeZone),
  );
}
