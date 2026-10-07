"use server";

import { z } from "zod";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { type ActionError, toActionError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  parseInput,
  requireOwnerId,
  revalidateActiveRecall,
  withBoundary,
} from "./action-support";
import {
  disagreeRecallAnswer,
  getRecallSessionResults,
  type RecallAnswerResult,
  retryRecallEvaluation,
} from "./application";
import type {
  RecallSessionCalibration,
  RecallSessionEvaluationStatus,
} from "./domain/recall-session";
import { scheduleRecallEvaluation } from "./evaluation-runner";
import { createDrizzleRecallRepositories } from "./infrastructure";

// Server Actions of a session's asynchronous evaluation (Phase 6 T6, §8.5,
// CU-09): the results page polls the status, "Reintentar" requeues the
// failed answers and "No estoy de acuerdo" records a disagreement. Same
// boundary as session-actions.ts: session first, Zod validation, every
// failure as an ActionError, never a throw to the client.

export type RecallAnswerResultView = RecallAnswerResult;

export interface RecallSessionResultsView {
  sessionId: string;
  // ISO timestamps (the results header shows the session date).
  startedAt: string;
  finishedAt: string | null;
  evaluationStatus: RecallSessionEvaluationStatus;
  // Average combined quality (0–5) of the done answers; null when none.
  averageCombinedQuality: number | null;
  calibration: RecallSessionCalibration;
  answers: RecallAnswerResultView[];
}

export interface RetriedRecallEvaluationView {
  sessionId: string;
  requeued: number;
  evaluationStatus: RecallSessionEvaluationStatus;
}

export interface DisagreedRecallAnswerView {
  answerId: string;
  disagreed: boolean;
}

const sessionInput = z.object({ sessionId: z.uuid() });
const answerInput = z.object({ answerId: z.uuid() });

function repositories() {
  return createDrizzleRecallRepositories(getDb());
}

// The results page's polling read. While a finished session is still
// pending it also schedules an evaluation run: a run that died (the
// function was stopped) leaves its claims to expire, and the next run
// takes them over. A run that finds every pending answer claimed by a
// live run stops at once, so polling never evaluates an answer twice.
export async function getRecallSessionResultsAction(
  input: unknown,
): Promise<Result<RecallSessionResultsView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(sessionInput, input);
    if (!parsed.ok) return parsed;

    const result = await getRecallSessionResults(
      parsed.value,
      repositories(),
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    const { session, answers, averageCombinedQuality, calibration } =
      result.value;
    if (session.finishedAt !== null && session.evaluationStatus === "pending") {
      scheduleRecallEvaluation(session.id, ownerId.value);
    }
    return ok({
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
      finishedAt: session.finishedAt?.toISOString() ?? null,
      evaluationStatus: session.evaluationStatus,
      averageCombinedQuality,
      calibration,
      answers,
    });
  });
}

// "Reintentar" (CU-09 alternate flow): the failed answers go back to
// pending and a new evaluation run is scheduled after the response.
export async function retryRecallEvaluationAction(
  input: unknown,
): Promise<Result<RetriedRecallEvaluationView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(sessionInput, input);
    if (!parsed.ok) return parsed;

    const result = await retryRecallEvaluation(
      parsed.value,
      { ...repositories(), clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    const { session, requeued } = result.value;
    if (requeued > 0) scheduleRecallEvaluation(session.id, ownerId.value);
    return ok({
      sessionId: session.id,
      requeued,
      evaluationStatus: session.evaluationStatus,
    });
  });
}

// "No estoy de acuerdo" (§8.5): recorded, never changes the score.
export async function disagreeRecallAnswerAction(
  input: unknown,
): Promise<Result<DisagreedRecallAnswerView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(answerInput, input);
    if (!parsed.ok) return parsed;

    const result = await disagreeRecallAnswer(
      parsed.value,
      { ...repositories(), clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateActiveRecall();
    return ok({ answerId: result.value.id, disagreed: result.value.disagreed });
  });
}
