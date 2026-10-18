// Server-side reads of "Repasos de hoy" (Phase 8 H2-T5g). Not a "use
// server" file: nothing here is client-reachable. Reviews are due per
// local day of the profile's zone (user decision 2026-10-18), so every
// "due today" read needs that zone:
//   - getDueToday: Home and the calendar's "Hoy" pass the zone and the
//     instant they render with, so "today" agrees with the rest of the page;
//   - listDueTodayAction (actions.ts) reads the zone itself, server-side,
//     with the system clock, and never accepts a clock from its caller;
//   - getCurrentDueCutoff: the technique modules' Server Actions build
//     their sessions' "due" bound from it, so a session offers exactly
//     what Home counts.
import * as Sentry from "@sentry/nextjs";
import { unstable_rethrow } from "next/navigation";
import { getCurrentTimeZoneSetting, getCurrentUser } from "@/modules/identity";
import { getDb } from "@/shared/db/client";
import { type Clock, createFixedClock } from "@/shared/kernel/clock";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { listDueToday } from "./application";
import { isTimeZone, startOfTomorrowIn } from "./domain/calendar";
import type { DueTodayPage } from "./domain/due-today";
import { SCHEDULING_ERROR } from "./domain/errors";
import { DrizzleDueTodayReader } from "./infrastructure";

function actionError(code: string, message: string): ActionError {
  return toActionError(new DomainError(code, message));
}

// The caller's pages with items due during today in `timeZone`, the page
// that has waited longest first. A missing `timeZone` reads the profile's
// zone. Session first; every failure leaves as the plain ActionError
// shape, never throws (Next.js control-flow errors are rethrown).
export async function readDueToday(
  input: { timeZone?: string },
  clock: Clock,
): Promise<Result<DueTodayPage[], ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return err(
        actionError(
          SCHEDULING_ERROR.SESSION_REQUIRED,
          "Debes iniciar sesión para continuar.",
        ),
      );
    }
    const timeZone =
      input.timeZone ?? (await getCurrentTimeZoneSetting()).timeZone;
    if (!isTimeZone(timeZone)) {
      return err(
        actionError(SCHEDULING_ERROR.INVALID_RANGE, "invalid time zone"),
      );
    }
    const pages = await listDueToday(
      { ownerId: user.id, timeZone },
      { reader: new DrizzleDueTodayReader(getDb()), clock },
    );
    return ok(pages);
  } catch (error) {
    unstable_rethrow(error);
    Sentry.captureException(error);
    return err(
      actionError(
        SCHEDULING_ERROR.UNEXPECTED,
        "unexpected scheduling action failure",
      ),
    );
  }
}

// Home's and the calendar's read: "today" is the local day of `now` (the
// instant the page renders with) in `timeZone` (the profile's zone).
export function getDueToday(input: {
  timeZone: string;
  now: Date;
}): Promise<Result<DueTodayPage[], ActionError>> {
  return readDueToday(
    { timeZone: input.timeZone },
    createFixedClock(input.now),
  );
}

// The current user's "due" bound as a function of the instant: the start
// of the local day after `now` in the profile's zone (the default zone
// when the profile cannot be read, like every other zone read). Items
// with due_at before it are due today. Resolve it inside the request (it
// reads the session), then pass it on, also to work deferred with after().
export async function getCurrentDueCutoff(): Promise<(now: Date) => Date> {
  const { timeZone } = await getCurrentTimeZoneSetting();
  return (now) => startOfTomorrowIn(now, timeZone);
}
