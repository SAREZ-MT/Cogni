"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { getCurrentDueCutoff } from "@/modules/scheduling";
import {
  createPageMasteryReader,
  createStudyItemRepository,
} from "@/modules/study-engine";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { type ActionError, toActionError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { parseInput, requireOwnerId, withBoundary } from "./action-support";
import {
  getRecallSessionReview,
  listRecallHub,
  type RecallDueCounts,
  type RecallHubEntry,
  type RecallHubSessionEntry,
  type RecallPageMasterySource,
  type RecallSessionReview,
} from "./application";
import {
  createDrizzleRecallRepositories,
  DrizzleRecallHubReader,
} from "./infrastructure";

// Server Actions of the active recall hub, notebook view and past-session
// results (documento-maestro §3.3, Phase 6 T7). Same boundary as
// session-actions.ts: session first, Zod validation, every failure as an
// ActionError, never a throw to the client.

export type RecallHubSessionView = Omit<RecallHubSessionEntry, "finishedAt"> & {
  // ISO instant the session finished.
  finishedAt: string;
};

export type RecallHubPageView = Omit<
  RecallHubEntry,
  "sessions" | "latestQuestionAt"
> & {
  sessions: RecallHubSessionView[];
  // ISO instant of the newest active question; null without any.
  latestQuestionAt: string | null;
};

export interface RecallHubView {
  pages: RecallHubPageView[];
  averageMastery: number | null;
}

export type RecallSessionReviewView = RecallSessionReview;

const reviewInput = z.object({ pageId: z.uuid(), sessionId: z.uuid() });

// Page mastery and the recall questions due today, both from study-engine
// (the module's declared dependency; the due items are the same "due" as
// scheduling's "Repasos de hoy": due before the start of the owner's next
// local day in their profile zone, not suspended, page and notebook not
// archived). A failing read never hides the hub: it degrades to unknown
// (null) and goes to Sentry.
function hubSources(db: ReturnType<typeof getDb>): {
  mastery: RecallPageMasterySource;
  due: RecallDueCounts;
} {
  const masteryReader = createPageMasteryReader(db);
  const studyItems = createStudyItemRepository(db);
  return {
    mastery: {
      async masteryByPage(ownerId) {
        try {
          const rows = await masteryReader.listByOwner(ownerId);
          return new Map(rows.map((row) => [row.pageId, row.score]));
        } catch (error) {
          Sentry.captureException(error);
          return null;
        }
      },
    },
    due: {
      async recallQuestionsDueByPage(ownerId) {
        try {
          const dueCutoff = await getCurrentDueCutoff();
          const items = await studyItems.listDue(
            ownerId,
            dueCutoff(systemClock.now()),
          );
          const counts = new Map<string, number>();
          for (const item of items) {
            if (item.kind !== "recall_question") continue;
            counts.set(item.pageId, (counts.get(item.pageId) ?? 0) + 1);
          }
          return counts;
        } catch (error) {
          Sentry.captureException(error);
          return null;
        }
      },
    },
  };
}

// The caller's pages with recall questions or a finished recall session
// (archived pages and notebooks left out), ordered by notebook title then page title, and the
// average page mastery of those pages.
export async function listRecallHubAction(): Promise<
  Result<RecallHubView, ActionError>
> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;

    const db = getDb();
    const result = await listRecallHub(
      { reader: new DrizzleRecallHubReader(db), ...hubSources(db) },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok({
      averageMastery: result.value.averageMastery,
      pages: result.value.pages.map((page) => ({
        ...page,
        latestQuestionAt: page.latestQuestionAt?.toISOString() ?? null,
        sessions: page.sessions.map((session) => ({
          ...session,
          finishedAt: session.finishedAt.toISOString(),
        })),
      })),
    });
  });
}

// A finished session of the page with its questions and answers, so the
// results view can open it again (its evaluation is polled with
// getRecallSessionResultsAction). Unknown, foreign, open or another
// page's session: RECALL_SESSION_NOT_FOUND.
export async function getRecallSessionReviewAction(
  input: unknown,
): Promise<Result<RecallSessionReviewView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(reviewInput, input);
    if (!parsed.ok) return parsed;

    const result = await getRecallSessionReview(
      parsed.value,
      createDrizzleRecallRepositories(getDb()),
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok(result.value);
  });
}
