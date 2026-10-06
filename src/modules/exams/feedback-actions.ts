"use server";

import { z } from "zod";
import { createAiServerApi } from "@/modules/ai";
import { createNotebooksServerApi } from "@/modules/notebooks";
import { createSessionFeedbackSources } from "@/modules/study-engine";
import { serverEnv } from "@/shared/config/env.server";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { type ActionError, toActionError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import { parseInput, requireOwnerId, withBoundary } from "./action-support";
import {
  type ExamReviewNotice,
  getExamReviewNotice,
  requestExamFeedback,
} from "./application";
import { type ExamFeedbackView, toExamFeedbackView } from "./feedback-view";
import { DrizzleExamSessionUnitOfWork } from "./infrastructure";

// Server Actions of the exam feedback (§3.3: at the end the AI explains the
// failed questions with the page's content) and of the notebook page's
// "review before retaking" notice. Same boundary as session-actions.ts.

const sessionInput = z.object({ sessionId: z.uuid() });
const pageInput = z.object({ pageId: z.uuid() });

// The finished exam's AI feedback: generated once (a failed exam, the first
// pass, a failure after a pass) or the last pass's feedback shown again.
// Never spends a generation of the daily limit (peek only). A provider
// failure answers ok with status "failed". The call may wait for the
// provider (FEEDBACK_AI_TIMEOUT_MS): it runs under the results route's
// maxDuration.
export async function requestExamFeedbackAction(
  input: unknown,
): Promise<Result<ExamFeedbackView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(sessionInput, input);
    if (!parsed.ok) return parsed;

    const db = getDb();
    const env = serverEnv();
    const ids = { next: createId };
    const ai = createAiServerApi({ env, db, clock: systemClock, ids });
    const result = await requestExamFeedback(
      parsed.value,
      {
        uow: new DrizzleExamSessionUnitOfWork(db, ids),
        feedback: createSessionFeedbackSources(db).feedback,
        pages: createNotebooksServerApi({ db, clock: systemClock }),
        limiter: ai.generationLimiter,
        ai,
        clock: systemClock,
        ids,
        tokenCap: env.AI_PAGE_TOKEN_CAP,
      },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok(toExamFeedbackView(result.value));
  });
}

// The failed concepts of the page's pending retake (null when none), for
// the notebook page's "Repasa antes de repetir el examen" notice.
export async function getExamReviewNoticeAction(
  input: unknown,
): Promise<Result<ExamReviewNotice | null, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const db = getDb();
    const result = await getExamReviewNotice(
      parsed.value,
      { uow: new DrizzleExamSessionUnitOfWork(db, { next: createId }) },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok(result.value);
  });
}
