"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAiServerApi } from "@/modules/ai";
import { createNotebooksServerApi } from "@/modules/notebooks";
import { serverEnv } from "@/shared/config/env.server";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { toActionError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  parseInput,
  requireOwnerId,
  revalidateExams,
  withBoundary,
} from "./action-support";
import type { ExamGenerationActionError } from "./actions";
import { ExamDailyLimitReachedError, startExamRetake } from "./application";
import { EXAM_MAX_QUESTIONS, EXAM_MIN_QUESTIONS } from "./domain/exam-session";
import { DrizzleExamSessionUnitOfWork } from "./infrastructure";

export interface StartedExamRetakeView {
  sessionId: string;
  resumed: boolean;
  // Daily AI generations left; null when no AI call was made.
  remainingToday: number | null;
}

// The UI always sends N: its minimum depends on the failed roots
// (max(10, failed)), which the use case checks.
const retakeInput = z.object({
  pageId: z.uuid(),
  count: z.number().int().min(EXAM_MIN_QUESTIONS).max(EXAM_MAX_QUESTIONS),
});

// "Repetir examen" (documento-maestro §7.5): resumes the page's open retake
// or generates the reformulated questions (one generation of the daily
// limit, consumed only when the retake was created) and opens it. The
// action may run a long provider call: Next applies `maxDuration` from the
// route segment that hosts it (the exam and notebook page routes).
export async function startExamRetakeAction(
  input: unknown,
): Promise<Result<StartedExamRetakeView, ExamGenerationActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(retakeInput, input);
    if (!parsed.ok) return parsed;

    const db = getDb();
    const env = serverEnv();
    const ids = { next: createId };
    const ai = createAiServerApi({ env, db, clock: systemClock, ids });
    const result = await startExamRetake(
      { pageId: parsed.value.pageId, requestedCount: parsed.value.count },
      {
        pages: createNotebooksServerApi({ db, clock: systemClock }),
        limiter: ai.generationLimiter,
        ai,
        uow: new DrizzleExamSessionUnitOfWork(db, ids),
        clock: systemClock,
        ids,
        tokenCap: env.AI_PAGE_TOKEN_CAP,
      },
      ownerId.value,
    );
    if (!result.ok) {
      const error: ExamGenerationActionError = toActionError(result.error);
      return err(
        result.error instanceof ExamDailyLimitReachedError
          ? { ...error, resetAt: result.error.resetAt.toISOString() }
          : error,
      );
    }
    // The page's exam state and questions changed: the exams screens and
    // the notebook page's techniques panel read them.
    revalidateExams();
    revalidatePath("/notebooks", "layout");
    return ok({
      sessionId: result.value.session.id,
      resumed: result.value.resumed,
      remainingToday: result.value.remainingToday,
    });
  });
}
