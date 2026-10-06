"use server";

import * as Sentry from "@sentry/nextjs";
import { createSchedulingServerApi } from "@/modules/scheduling";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { type ActionError, toActionError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { requireOwnerId, withBoundary } from "./action-support";
import {
  type ExamDueCounts,
  type ExamHubEntry,
  listExamHub,
} from "./application";
import { DrizzleExamHubReader } from "./infrastructure";

// Server Action of the exams hub and notebook view (documento-maestro
// §3.3, Phase 5 T9). Same boundary as session-actions.ts.

export type ExamHubPageView = Omit<ExamHubEntry, "lastFinishedAt"> & {
  // ISO instant of the last finished exam; null when never examined.
  lastFinishedAt: string | null;
};

// Exam questions due today from scheduling's "Repasos de hoy". A failing
// due list never hides the hub: it degrades to unknown counts (null).
function dueCounts(db: ReturnType<typeof getDb>): ExamDueCounts {
  const scheduling = createSchedulingServerApi({ db, clock: systemClock });
  return {
    async examQuestionsDueByPage(ownerId) {
      try {
        const pages = await scheduling.listDueToday(ownerId);
        return new Map(
          pages.map((page) => [page.pageId, page.due.exam_question]),
        );
      } catch (error) {
        Sentry.captureException(error);
        return null;
      }
    },
  };
}

// The caller's pages holding exam questions (archived pages and notebooks
// left out), ordered by notebook title then page title.
export async function listExamHubAction(): Promise<
  Result<ExamHubPageView[], ActionError>
> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;

    const db = getDb();
    const result = await listExamHub(
      { reader: new DrizzleExamHubReader(db), due: dueCounts(db) },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok(
      result.value.map((page) => ({
        ...page,
        lastFinishedAt: page.lastFinishedAt?.toISOString() ?? null,
      })),
    );
  });
}
