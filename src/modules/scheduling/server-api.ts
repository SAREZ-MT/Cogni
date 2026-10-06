// Server-side API other modules use to read the "Hoy" due list (exams' hub
// counts its due exam questions with it). A composition root like
// actions.ts, but with no "use server" directive: it is not a
// client-reachable entry point, and the caller supplies the owner it has
// already authenticated.
import type { DbExecutor } from "@/shared/db/client";
import { type Clock, systemClock } from "@/shared/kernel/clock";
import { listDueToday } from "./application";
import type { DueTodayPage } from "./domain/due-today";
import { DrizzleDueTodayReader } from "./infrastructure";

export interface SchedulingServerApi {
  // The owner's pages with study items due now, the page that has waited
  // longest first (same read as listDueTodayAction).
  listDueToday(ownerId: string): Promise<DueTodayPage[]>;
}

export function createSchedulingServerApi(deps: {
  db: DbExecutor;
  clock?: Clock;
}): SchedulingServerApi {
  const reader = new DrizzleDueTodayReader(deps.db);
  const clock = deps.clock ?? systemClock;
  return {
    listDueToday: (ownerId) => listDueToday(ownerId, { reader, clock }),
  };
}
