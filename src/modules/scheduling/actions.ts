"use server";

import * as Sentry from "@sentry/nextjs";
import { getCurrentUser } from "@/modules/identity";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { listDueToday } from "./application";
import type { DueTodayPage } from "./domain/due-today";
import { SCHEDULING_ERROR } from "./domain/errors";
import { DrizzleDueTodayReader } from "./infrastructure";

// Server Actions of the scheduling module (documento-maestro §3.5): session
// first, every failure leaves as the plain ActionError shape, never throws.

export type DueTodayPageView = DueTodayPage;

function actionError(code: string, message: string): ActionError {
  return toActionError(new DomainError(code, message));
}

// "Repasos de hoy": the caller's pages with items due now, the page that has
// waited longest first.
export async function listDueTodayAction(): Promise<
  Result<DueTodayPageView[], ActionError>
> {
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
    const pages = await listDueToday(user.id, {
      reader: new DrizzleDueTodayReader(getDb()),
      clock: systemClock,
    });
    return ok(pages);
  } catch (error) {
    Sentry.captureException(error);
    return err(
      actionError(
        SCHEDULING_ERROR.UNEXPECTED,
        "unexpected scheduling action failure",
      ),
    );
  }
}
