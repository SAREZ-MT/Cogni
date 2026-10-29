"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { AI_ERROR, createAiServerApi } from "@/modules/ai";
import { createNotebooksServerApi } from "@/modules/notebooks";
import { serverEnv } from "@/shared/config/env.server";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import {
  type ActionError,
  type DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import {
  PAGE_TOO_SHORT_CODE,
  PageTooShortError,
  pageTooShortDetails,
} from "@/shared/kernel/generation-capacity";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  type Analytics,
  createServerAnalytics,
} from "@/shared/observability/analytics";
import {
  parseInput,
  requireOwnerId,
  revalidateExams,
  withBoundary,
} from "./action-support";
import {
  applyExamEdits,
  ExamDailyLimitReachedError,
  editExamQuestion,
  listPageExamQuestions,
  requestExamGeneration,
  retireExamQuestion,
} from "./application";
import { EXAM_ERROR } from "./domain/errors";
import {
  EXAM_OPTION_COUNT,
  type ExamQuestion,
  type ExamQuestionOrigin,
  MAX_CONCEPT_LENGTH,
  MAX_EXPLANATION_LENGTH,
  MAX_OPTION_LENGTH,
  MAX_STEM_LENGTH,
} from "./domain/exam-question";
import {
  EXAM_DEFAULT_QUESTIONS,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_QUESTIONS,
} from "./domain/exam-session";
import {
  DrizzleExamFingerprints,
  DrizzleExamQuestionRepository,
  DrizzleExamUnitOfWork,
} from "./infrastructure";

// Server Actions are the only client-reachable entry point of this module:
// session first, Zod validation, then the use case, and every DomainError
// leaves as the plain ActionError shape. None of them throws to the client.

export interface ExamQuestionView {
  id: string;
  pageId: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  concept: string;
  origin: ExamQuestionOrigin;
}

export interface RetiredExamQuestionView {
  id: string;
}

export interface ExamGenerationView {
  // The new AI questions, in generation order.
  questions: ExamQuestionView[];
  created: number;
  // Generated questions dropped as invalid or duplicates.
  skipped: number;
  remainingToday: number;
  truncated: boolean;
  wordsUsed: number;
  wordsTotal: number;
}

// `resetAt` (ISO) accompanies AI_DAILY_LIMIT_REACHED so the UI can say when
// generation is available again (same shape as flashcards').
export interface ExamGenerationActionError extends ActionError {
  readonly resetAt?: string;
  // AI_PAGE_TOO_SHORT (Phase 8 H14): the new paragraphs' words, the words
  // the request needs and the questions those words carry.
  readonly words?: number;
  readonly minWords?: number;
  readonly maxItems?: number;
}

// The raw texts are only bounded here (twice the limit leaves room for
// surrounding whitespace); the domain applies the real limits to the
// trimmed text and answers EXAMS_INVALID_QUESTION.
const text = (max: number) => z.string().max(max * 2);
const content = {
  stem: text(MAX_STEM_LENGTH),
  options: z.array(text(MAX_OPTION_LENGTH)).length(EXAM_OPTION_COUNT),
  correctIndex: z
    .number()
    .int()
    .min(0)
    .max(EXAM_OPTION_COUNT - 1),
  explanation: text(MAX_EXPLANATION_LENGTH),
  concept: text(MAX_CONCEPT_LENGTH),
};
const pageInput = z.object({ pageId: z.uuid() });
const editInput = z.object({ questionId: z.uuid(), ...content });
const questionInput = z.object({ questionId: z.uuid() });
// One edit page save (Phase 8 H18).
const MAX_DRAFT_ITEMS = 200;
const saveExamEditsInput = z.object({
  pageId: z.uuid(),
  updates: z.array(z.object({ id: z.uuid(), ...content })).max(MAX_DRAFT_ITEMS),
  creates: z.array(z.object(content)).max(MAX_DRAFT_ITEMS),
  deletes: z.array(z.uuid()).max(MAX_DRAFT_ITEMS),
});
const generateInput = z.object({
  pageId: z.uuid(),
  count: z
    .number()
    .int()
    .min(EXAM_MIN_QUESTIONS)
    .max(EXAM_MAX_QUESTIONS)
    .optional(),
});

// Adapters are built per call, like flashcards/actions.ts: serverless
// functions are short-lived, so no module-level singletons.
function deps() {
  const db = getDb();
  return {
    pages: createNotebooksServerApi({ db, clock: systemClock }),
    questions: new DrizzleExamQuestionRepository(db),
    uow: new DrizzleExamUnitOfWork(db),
  };
}

// The generation also needs the env, the AI module and analytics; kept apart
// so the question actions never read the server env.
function generationDeps() {
  const db = getDb();
  const env = serverEnv();
  return {
    env,
    ai: createAiServerApi({
      env,
      db,
      clock: systemClock,
      ids: { next: createId },
    }),
    pages: createNotebooksServerApi({ db, clock: systemClock }),
    questions: new DrizzleExamQuestionRepository(db),
    fingerprints: new DrizzleExamFingerprints(db),
    uow: new DrizzleExamUnitOfWork(db),
    analytics: createServerAnalytics({
      key: env.NEXT_PUBLIC_POSTHOG_KEY,
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
    }),
  };
}

// Analytics is never a dependency of the action: a rejected event is
// reported and dropped, so a saved generation still answers with its result.
async function trackSafely(
  analytics: Analytics,
  ...event: Parameters<Analytics["track"]>
): Promise<void> {
  try {
    await analytics.track(...event);
  } catch (error) {
    Sentry.captureException(error);
  }
}

function statusFor(
  error: DomainError,
): "limit" | "empty" | "no_new_content" | "failed" {
  if (error.code === AI_ERROR.DAILY_LIMIT_REACHED) return "limit";
  if (error.code === EXAM_ERROR.NO_NEW_CONTENT) return "no_new_content";
  // A page too short to generate from (H14) is tracked as empty.
  if (error.code === AI_ERROR.PAGE_EMPTY || error.code === PAGE_TOO_SHORT_CODE)
    return "empty";
  return "failed";
}

function toView(question: ExamQuestion): ExamQuestionView {
  return {
    id: question.id,
    pageId: question.pageId,
    stem: question.stem,
    options: [...question.options],
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    concept: question.concept,
    origin: question.origin,
  };
}

export async function listExamQuestionsAction(
  input: unknown,
): Promise<Result<ExamQuestionView[], ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const { questions } = deps();
    const result = await listPageExamQuestions(
      parsed.value,
      { questions },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok(result.value.map(toView));
  });
}

export async function editExamQuestionAction(
  input: unknown,
): Promise<Result<ExamQuestionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(editInput, input);
    if (!parsed.ok) return parsed;

    const { uow } = deps();
    const result = await editExamQuestion(
      parsed.value,
      { uow, clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateExams();
    return ok(toView(result.value));
  });
}

export async function retireExamQuestionAction(
  input: unknown,
): Promise<Result<RetiredExamQuestionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(questionInput, input);
    if (!parsed.ok) return parsed;

    const { uow } = deps();
    const result = await retireExamQuestion(
      parsed.value,
      { uow, clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateExams();
    return ok({ id: result.value.id });
  });
}

// "Examen → Generar" (§3.3 "generadas por IA"): one generation of the daily
// limit creates `count` (10-30, default 10) AI questions with their study
// items. The action runs long provider calls: Next applies `maxDuration`
// from the route segment that hosts the action (the notebook page route).
export async function generateExamQuestionsAction(
  input: unknown,
): Promise<Result<ExamGenerationView, ExamGenerationActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(generateInput, input);
    if (!parsed.ok) return parsed;

    const { env, ai, pages, questions, fingerprints, uow, analytics } =
      generationDeps();
    const result = await requestExamGeneration(
      {
        pageId: parsed.value.pageId,
        count: parsed.value.count ?? EXAM_DEFAULT_QUESTIONS,
      },
      {
        limiter: ai.generationLimiter,
        pages,
        ai,
        questions,
        fingerprints,
        uow,
        clock: systemClock,
        ids: { next: createId },
        tokenCap: env.AI_PAGE_TOKEN_CAP,
      },
      ownerId.value,
    );

    const purpose = "generate_exam_questions";
    if (!result.ok) {
      await trackSafely(analytics, "generation_requested", ownerId.value, {
        pageId: parsed.value.pageId,
        purpose,
        provider: null,
        model: null,
        status: statusFor(result.error),
        truncated: false,
      });
      const error: ExamGenerationActionError = toActionError(result.error);
      if (result.error instanceof PageTooShortError) {
        return err({ ...error, ...pageTooShortDetails(result.error) });
      }
      return err(
        result.error instanceof ExamDailyLimitReachedError
          ? { ...error, resetAt: result.error.resetAt.toISOString() }
          : error,
      );
    }

    const value = result.value;
    revalidateExams();
    await trackSafely(analytics, "generation_requested", ownerId.value, {
      pageId: parsed.value.pageId,
      purpose,
      provider: value.provider,
      model: value.model,
      status: "done",
      truncated: value.truncated,
    });
    return ok({
      questions: value.questions.map(toView),
      created: value.questions.length,
      skipped: value.skipped,
      remainingToday: value.remainingToday,
      truncated: value.truncated,
      wordsUsed: value.wordsUsed,
      wordsTotal: value.wordsTotal,
    });
  });
}

// "Guardar" on the exam questions' edit page (Phase 8 H18): the draft's
// edits, additions and real deletions (a deleted question takes its whole
// lineage), applied together in one transaction (applyExamEdits) or not
// at all. Answers the page's active questions.
export async function saveExamEditsAction(
  input: unknown,
): Promise<Result<ExamQuestionView[], ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(saveExamEditsInput, input);
    if (!parsed.ok) return parsed;

    const { pages, uow } = deps();
    const result = await applyExamEdits(
      parsed.value,
      { pages, uow, clock: systemClock, ids: { next: createId } },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateExams();
    return ok(result.value.questions.map(toView));
  });
}
