// Server-side read behind Home's technique cards (Phase 8 H2-T5f). Not a
// "use server" file: nothing here is client-reachable. Home calls
// getTechniqueOverview with the instant it renders with, so "tomorrow"
// agrees with the rest of the page; the Server Action
// (getTechniqueOverviewAction) reuses the same read with the system clock
// and never accepts a clock from its input.
import * as Sentry from "@sentry/nextjs";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/modules/identity";
import { getDb } from "@/shared/db/client";
import { type Clock, createFixedClock } from "@/shared/kernel/clock";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { getTechniqueOverview as readOverview } from "./application";
import { isTimeZone } from "./domain/calendar";
import { SCHEDULING_ERROR } from "./domain/errors";
import type { TechniqueOverview } from "./domain/technique-overview";
import { DrizzleTechniqueOverviewReader } from "./infrastructure";

function actionError(code: string, message: string): ActionError {
  return toActionError(new DomainError(code, message));
}

// The caller's live item count and next due date (from tomorrow on, in
// `timeZone`) per technique. Session first; every failure leaves as the
// plain ActionError shape, never throws (Next.js control-flow errors are
// rethrown to the framework).
export async function readTechniqueOverview(
  input: { timeZone: string },
  clock: Clock,
): Promise<Result<TechniqueOverview, ActionError>> {
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
    if (!isTimeZone(input.timeZone)) {
      return err(
        actionError(SCHEDULING_ERROR.INVALID_RANGE, "invalid time zone"),
      );
    }
    const overview = await readOverview(
      { ownerId: user.id, timeZone: input.timeZone },
      { reader: new DrizzleTechniqueOverviewReader(getDb()), clock },
    );
    return ok(overview);
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

// Home's read: "tomorrow" follows `now`, the instant the page renders with.
export function getTechniqueOverview(input: {
  timeZone: string;
  now: Date;
}): Promise<Result<TechniqueOverview, ActionError>> {
  return readTechniqueOverview(
    { timeZone: input.timeZone },
    createFixedClock(input.now),
  );
}
