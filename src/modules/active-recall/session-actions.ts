"use server";

import { z } from "zod";
import { createNotebooksServerApi } from "@/modules/notebooks";
import { createStudyItemRepository } from "@/modules/study-engine";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { type ActionError, toActionError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  parseInput,
  requireOwnerId,
  revalidateActiveRecall,
  withBoundary,
} from "./action-support";
import {
  finishRecallSession,
  planRecallSession,
  type RecallSessionQuestion,
  saveRecallAnswer,
  startRecallSession,
} from "./application";
import type { RecallSessionEvaluationStatus } from "./domain/recall-session";
import { scheduleRecallEvaluation } from "./evaluation-runner";
import {
  DrizzleRecallQuestionRepository,
  DrizzleRecallSessionUnitOfWork,
} from "./infrastructure";

// Server Actions of an active-recall session (§3.3, RF-AR-02/03): the
// player's question list, start, one save per answer and finish. Same
// boundary as actions.ts: session first, Zod validation, every failure as
// an ActionError, never a throw to the client.

export type RecallSessionQuestionView = RecallSessionQuestion;

export interface RecallSessionPlanView {
  // What a session started now would show, in order; empty when the page
  // has no question to practise.
  questions: RecallSessionQuestionView[];
}

// What the page's techniques panel lists for active recall.
export interface RecallPageSummaryView {
  // Active (not archived) questions on the page.
  questionCount: number;
}

export interface StartedRecallSessionView {
  sessionId: string;
  questions: RecallSessionQuestionView[];
}

export interface SavedRecallAnswerView {
  questionId: string;
  // As stored: trimmed, or the skip marker for a skip or a blank answer.
  answerText: string;
  selfRating: number;
}

export interface FinishedRecallSessionView {
  sessionId: string;
  answeredCount: number;
  evaluationStatus: RecallSessionEvaluationStatus;
}

// An answer is free text; the cap only stops an abusive payload (a long
// written answer is a few thousand characters).
const MAX_ANSWER_LENGTH = 20_000;

const pageInput = z.object({ pageId: z.uuid() });
const sessionInput = z.object({ sessionId: z.uuid() });
const answerInput = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid(),
  answerText: z.string().max(MAX_ANSWER_LENGTH),
  // Range and integer checks are the domain's (RECALL_INVALID_ANSWER).
  selfRating: z.number(),
});

// Adapters are built per call, like actions.ts: serverless functions are
// short-lived, so no module-level singletons.
function deps() {
  const db = getDb();
  return {
    db,
    pages: createNotebooksServerApi({ db, clock: systemClock }),
    uow: new DrizzleRecallSessionUnitOfWork(db),
  };
}

// The session route's question list (read only: opening the route never
// creates a session).
export async function getRecallSessionPlanAction(
  input: unknown,
): Promise<Result<RecallSessionPlanView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const { db } = deps();
    const plan = await planRecallSession(
      parsed.value,
      {
        questions: new DrizzleRecallQuestionRepository(db),
        studyItems: createStudyItemRepository(db),
        clock: systemClock,
      },
      ownerId.value,
    );
    return ok(plan);
  });
}

// The techniques panel's "generated" row (Phase 6 T5b): how many active
// questions the page holds; read only.
export async function getRecallPageSummaryAction(
  input: unknown,
): Promise<Result<RecallPageSummaryView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const questions = await new DrizzleRecallQuestionRepository(
      getDb(),
    ).listActiveByPage(parsed.value.pageId, ownerId.value);
    return ok({ questionCount: questions.length });
  });
}

// Opens a new session on the page: the player calls it when the first
// answer is saved, and "Nueva sesión" calls it again.
export async function startRecallSessionAction(
  input: unknown,
): Promise<Result<StartedRecallSessionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const { pages, uow } = deps();
    const result = await startRecallSession(
      parsed.value,
      { pages, uow, clock: systemClock, ids: { next: createId } },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok({
      sessionId: result.value.session.id,
      questions: result.value.questions,
    });
  });
}

// Saves one answer as it is given ("Calificar respuesta" + self-rating, or
// "Saltar" with the skip marker and 0).
export async function saveRecallAnswerAction(
  input: unknown,
): Promise<Result<SavedRecallAnswerView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(answerInput, input);
    if (!parsed.ok) return parsed;

    const { uow } = deps();
    const result = await saveRecallAnswer(
      parsed.value,
      { uow, clock: systemClock, ids: { next: createId } },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok({
      questionId: result.value.questionId,
      answerText: result.value.answerText,
      selfRating: result.value.selfRating,
    });
  });
}

// "Terminar" or the last question: closes the session with the answers
// saved so far. The evaluation runs after the response (`after()`, Phase 6
// T6) within the session page's `maxDuration`; closing never waits for it.
// A repeated "Terminar" on a pending session schedules it again: the claim
// keeps a live run's answers to that run.
export async function finishRecallSessionAction(
  input: unknown,
): Promise<Result<FinishedRecallSessionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(sessionInput, input);
    if (!parsed.ok) return parsed;

    const { uow } = deps();
    const result = await finishRecallSession(
      parsed.value,
      { uow, clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    const { session } = result.value;
    if (session.evaluationStatus === "pending") {
      scheduleRecallEvaluation(session.id, ownerId.value);
    }
    revalidateActiveRecall();
    return ok({
      sessionId: result.value.session.id,
      answeredCount: result.value.answeredCount,
      evaluationStatus: result.value.session.evaluationStatus,
    });
  });
}
