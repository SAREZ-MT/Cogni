"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createNotebooksServerApi } from "@/modules/notebooks";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { type ActionError, toActionError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  parseInput,
  requireOwnerId,
  revalidateExams,
  withBoundary,
} from "./action-support";
import {
  answerExamQuestion,
  completeExamSession,
  type ExamSessionDetail,
  getExamPageOverview,
  readExamSession,
  startExamSession,
} from "./application";
import { EXAM_ERROR } from "./domain/errors";
import { EXAM_OPTION_COUNT } from "./domain/exam-question";
import {
  EXAM_DEFAULT_QUESTIONS,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_QUESTIONS,
  examSessionDurationMs,
} from "./domain/exam-session";
import { DrizzleExamSessionUnitOfWork } from "./infrastructure";

// Server Actions of an exam session (§3.3): start, answer one question at a
// time, finish, and the read models of the player and the results. Same
// boundary as actions.ts: session first, Zod validation, every failure as
// an ActionError, never a throw to the client.

export interface ExamStartView {
  // Roots with an active question; an exam needs at least 10.
  activeQuestionCount: number;
  retakePending: boolean;
  openSessionId: string | null;
  lastFinishedSessionId: string | null;
}

export interface StartedExamSessionView {
  sessionId: string;
  resumed: boolean;
}

// Revealed only once a question is answered.
export interface ExamAnswerView {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  correctIndex: number;
  explanation: string;
  concept: string;
}

export interface ExamPlayerQuestionView {
  id: string;
  stem: string;
  options: string[];
  answer: ExamAnswerView | null;
}

export interface ExamSessionView {
  sessionId: string;
  pageId: string;
  // ISO instant: the player counts the elapsed time from it.
  startedAt: string;
  finished: boolean;
  questions: ExamPlayerQuestionView[];
}

export interface FinishedExamSessionView {
  sessionId: string;
  passed: boolean;
}

export interface ExamResultQuestionView {
  id: string;
  stem: string;
  options: string[];
  concept: string;
  explanation: string;
  correctIndex: number;
  selectedIndex: number;
  isCorrect: boolean;
}

export interface ExamResultsView {
  sessionId: string;
  pageId: string;
  finishedAt: string;
  total: number;
  correct: number;
  // Whole percent, rounded down (display only; `passed` is the decision).
  scorePercent: number;
  passed: boolean;
  // The total time taken (user decision 2026-10-05: shown only here and in
  // the player).
  durationSeconds: number;
  questions: ExamResultQuestionView[];
  // Concepts of the wrong answers, once each, in the exam's question order.
  failedConcepts: string[];
}

const pageInput = z.object({ pageId: z.uuid() });
const sessionInput = z.object({ sessionId: z.uuid() });
const startInput = z.object({
  pageId: z.uuid(),
  count: z
    .number()
    .int()
    .min(EXAM_MIN_QUESTIONS)
    .max(EXAM_MAX_QUESTIONS)
    .optional(),
});
const answerInput = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid(),
  selectedIndex: z
    .number()
    .int()
    .min(0)
    .max(EXAM_OPTION_COUNT - 1),
});
const resultsInput = z.object({
  pageId: z.uuid(),
  sessionId: z.uuid().optional(),
});

// Adapters are built per call (short-lived serverless functions).
function deps() {
  const db = getDb();
  const ids = { next: createId };
  return {
    pages: createNotebooksServerApi({ db, clock: systemClock }),
    uow: new DrizzleExamSessionUnitOfWork(db, ids),
    ids,
  };
}

// A finished exam moves the page's due items and exam state: the exams
// screens and the notebook page's techniques panel both read them.
function revalidateAfterFinish(): void {
  revalidateExams();
  revalidatePath("/notebooks", "layout");
}

function toPlayerView(detail: ExamSessionDetail): ExamSessionView {
  return {
    sessionId: detail.session.id,
    pageId: detail.session.pageId,
    startedAt: detail.session.startedAt.toISOString(),
    finished: detail.session.finishedAt !== null,
    questions: detail.questions.map(({ question, answer }) => ({
      id: question.id,
      stem: question.stem,
      options: [...question.options],
      answer: answer && {
        questionId: question.id,
        selectedIndex: answer.selectedIndex,
        isCorrect: answer.isCorrect,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        concept: question.concept,
      },
    })),
  };
}

function toResultsView(detail: ExamSessionDetail): ExamResultsView | null {
  const { session } = detail;
  if (
    session.finishedAt === null ||
    session.total === null ||
    session.correct === null ||
    session.passed === null
  ) {
    return null;
  }
  const questions = detail.questions.flatMap(({ question, answer }) =>
    answer
      ? [
          {
            id: question.id,
            stem: question.stem,
            options: [...question.options],
            concept: question.concept,
            explanation: question.explanation,
            correctIndex: question.correctIndex,
            selectedIndex: answer.selectedIndex,
            isCorrect: answer.isCorrect,
          },
        ]
      : [],
  );
  return {
    sessionId: session.id,
    pageId: session.pageId,
    finishedAt: session.finishedAt.toISOString(),
    total: session.total,
    correct: session.correct,
    scorePercent: Math.floor((session.correct * 100) / session.total),
    passed: session.passed,
    durationSeconds: Math.floor((examSessionDurationMs(session) ?? 0) / 1000),
    questions,
    failedConcepts: [
      ...new Set(questions.filter((q) => !q.isCorrect).map((q) => q.concept)),
    ],
  };
}

export async function getExamStartAction(
  input: unknown,
): Promise<Result<ExamStartView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const { uow } = deps();
    const result = await getExamPageOverview(
      parsed.value,
      { uow },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    const overview = result.value;
    return ok({
      activeQuestionCount: overview.activeQuestionCount,
      retakePending: overview.retakePending,
      openSessionId: overview.openSession?.id ?? null,
      lastFinishedSessionId: overview.lastFinishedSession?.id ?? null,
    });
  });
}

export async function startExamSessionAction(
  input: unknown,
): Promise<Result<StartedExamSessionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(startInput, input);
    if (!parsed.ok) return parsed;

    const { pages, uow, ids } = deps();
    const result = await startExamSession(
      {
        pageId: parsed.value.pageId,
        requestedCount: parsed.value.count ?? EXAM_DEFAULT_QUESTIONS,
      },
      { pages, uow, clock: systemClock, ids },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateExams();
    return ok({
      sessionId: result.value.session.id,
      resumed: result.value.resumed,
    });
  });
}

export async function getExamSessionAction(
  input: unknown,
): Promise<Result<ExamSessionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(sessionInput, input);
    if (!parsed.ok) return parsed;

    const { uow } = deps();
    const result = await readExamSession(parsed.value, { uow }, ownerId.value);
    if (!result.ok) return err(toActionError(result.error));
    return ok(toPlayerView(result.value));
  });
}

export async function answerExamQuestionAction(
  input: unknown,
): Promise<Result<ExamAnswerView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(answerInput, input);
    if (!parsed.ok) return parsed;

    const { uow } = deps();
    const result = await answerExamQuestion(
      parsed.value,
      { uow, clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok(result.value);
  });
}

export async function finishExamSessionAction(
  input: unknown,
): Promise<Result<FinishedExamSessionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(sessionInput, input);
    if (!parsed.ok) return parsed;

    const { uow } = deps();
    const result = await completeExamSession(
      parsed.value,
      { uow, clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateAfterFinish();
    return ok({
      sessionId: result.value.session.id,
      passed: result.value.session.passed === true,
    });
  });
}

// The results of a finished session of the page: `sessionId` when given,
// otherwise the page's last finished session. EXAMS_SESSION_NOT_FOUND when
// there is none, the session is open or it belongs to another page.
export async function getExamResultsAction(
  input: unknown,
): Promise<Result<ExamResultsView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(resultsInput, input);
    if (!parsed.ok) return parsed;
    const notFound = err<ActionError>({
      code: EXAM_ERROR.SESSION_NOT_FOUND,
      message: "exam results not found",
    });

    const { uow } = deps();
    let sessionId = parsed.value.sessionId;
    if (!sessionId) {
      const overview = await getExamPageOverview(
        { pageId: parsed.value.pageId },
        { uow },
        ownerId.value,
      );
      if (!overview.ok) return err(toActionError(overview.error));
      sessionId = overview.value.lastFinishedSession?.id;
      if (!sessionId) return notFound;
    }
    const detail = await readExamSession({ sessionId }, { uow }, ownerId.value);
    if (!detail.ok) return err(toActionError(detail.error));
    if (detail.value.session.pageId !== parsed.value.pageId) return notFound;
    const view = toResultsView(detail.value);
    return view ? ok(view) : notFound;
  });
}
