import type { StudyItemKind } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
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

// "Repasos de hoy" (documento-maestro §3.5): the owner's pages with items
// due now, the page that has waited longest first. `now` comes from the
// injected clock so tests can pin the due boundary.
export async function listDueToday(
  ownerId: string,
  deps: ListDueTodayDeps,
): Promise<DueTodayPage[]> {
  return deps.reader.listDueToday(ownerId, deps.clock.now());
}
