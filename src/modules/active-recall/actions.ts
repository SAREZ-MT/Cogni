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
  revalidateActiveRecall,
  withBoundary,
} from "./action-support";
import {
  applyRecallEdits,
  RecallDailyLimitReachedError,
  requestRecallGeneration,
} from "./application";
import { RECALL_ERROR } from "./domain/errors";
import type {
  RecallQuestion,
  RecallQuestionOrigin,
} from "./domain/recall-question";
import {
  DrizzleRecallFingerprints,
  DrizzleRecallQuestionRepository,
  DrizzleRecallUnitOfWork,
} from "./infrastructure";

// Server Actions are the only client-reachable entry point of this module:
// session first, Zod validation, then the use case, and every DomainError
// leaves as the plain ActionError shape. None of them throws to the client.

export interface RecallQuestionView {
  id: string;
  pageId: string;
  prompt: string;
  keyConcepts: string[];
  acceptableAnswerSummary: string;
  origin: RecallQuestionOrigin;
}

export interface RecallGenerationView {
  // The new AI questions, in generation order.
  questions: RecallQuestionView[];
  created: number;
  // Generated questions dropped as invalid or duplicates.
  skipped: number;
  remainingToday: number;
  truncated: boolean;
  wordsUsed: number;
  wordsTotal: number;
}

// `resetAt` (ISO) accompanies AI_DAILY_LIMIT_REACHED so the UI can say when
// generation is available again (same shape as exams' and flashcards').
export interface RecallGenerationActionError extends ActionError {
  readonly resetAt?: string;
  // AI_PAGE_TOO_SHORT (Phase 8 H14): the new paragraphs' words, the words
  // the 10 questions need and the questions those words carry.
  readonly words?: number;
  readonly minWords?: number;
  readonly maxItems?: number;
}

const generateInput = z.object({ pageId: z.uuid() });
const pageInput = z.object({ pageId: z.uuid() });

// One edit page save (Phase 8 H18). The bounds only keep the payload sane;
// the domain trims and checks every field (non-blank prompt, at least one
// non-blank key concept, a non-blank summary).
const MAX_DRAFT_ITEMS = 200;
const fieldText = z.string().max(4000);
const questionContent = z.object({
  prompt: fieldText,
  keyConcepts: z.array(z.string().max(500)).max(30),
  acceptableAnswerSummary: fieldText,
});
const saveRecallEditsInput = z.object({
  pageId: z.uuid(),
  updates: z
    .array(questionContent.extend({ id: z.uuid() }))
    .max(MAX_DRAFT_ITEMS),
  creates: z.array(questionContent).max(MAX_DRAFT_ITEMS),
  deletes: z.array(z.uuid()).max(MAX_DRAFT_ITEMS),
});

// Adapters are built per call, like exams/actions.ts: serverless functions
// are short-lived, so no module-level singletons.
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
    questions: new DrizzleRecallQuestionRepository(db),
    fingerprints: new DrizzleRecallFingerprints(db),
    uow: new DrizzleRecallUnitOfWork(db),
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
  if (error.code === RECALL_ERROR.NO_NEW_CONTENT) return "no_new_content";
  // A page too short to generate from (H14) is tracked as empty.
  if (error.code === AI_ERROR.PAGE_EMPTY || error.code === PAGE_TOO_SHORT_CODE)
    return "empty";
  return "failed";
}

function toView(question: RecallQuestion): RecallQuestionView {
  return {
    id: question.id,
    pageId: question.pageId,
    prompt: question.prompt,
    keyConcepts: [...question.rubric.keyConcepts],
    acceptableAnswerSummary: question.rubric.acceptableAnswerSummary,
    origin: question.origin,
  };
}

// "Active recall → Generar" (§3.3, §8.4 generate_recall_questions): one
// generation of the daily limit creates 10 AI open questions with their
// rubric and study items; a failed generation consumes nothing. The action
// runs a long provider call: Next applies `maxDuration` from the route
// segment that hosts the action (the notebook page route).
export async function generateRecallQuestionsAction(
  input: unknown,
): Promise<Result<RecallGenerationView, RecallGenerationActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(generateInput, input);
    if (!parsed.ok) return parsed;

    const { env, ai, pages, questions, fingerprints, uow, analytics } =
      generationDeps();
    const result = await requestRecallGeneration(
      { pageId: parsed.value.pageId },
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
        onLimiterFailure: (error) => Sentry.captureException(error),
      },
      ownerId.value,
    );

    const purpose = "generate_recall_questions";
    if (!result.ok) {
      await trackSafely(analytics, "generation_requested", ownerId.value, {
        pageId: parsed.value.pageId,
        purpose,
        provider: null,
        model: null,
        status: statusFor(result.error),
        truncated: false,
      });
      const error: RecallGenerationActionError = toActionError(result.error);
      if (result.error instanceof PageTooShortError) {
        return err({ ...error, ...pageTooShortDetails(result.error) });
      }
      return err(
        result.error instanceof RecallDailyLimitReachedError
          ? { ...error, resetAt: result.error.resetAt.toISOString() }
          : error,
      );
    }

    const value = result.value;
    revalidateActiveRecall();
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

// The page's active questions with their rubric, oldest first: what the
// recall edit page edits (Phase 8 H18). Another owner's page reads empty.
export async function listRecallQuestionsAction(
  input: unknown,
): Promise<Result<RecallQuestionView[], ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const { questions } = generationDeps();
    const listed = await questions.listActiveByPage(
      parsed.value.pageId,
      ownerId.value,
    );
    return ok(listed.map(toView));
  });
}

// "Guardar" on the recall edit page (Phase 8 H18): the draft's edits,
// additions and real deletions, applied together in one transaction
// (applyRecallEdits) or not at all. Answers the page's questions.
export async function saveRecallEditsAction(
  input: unknown,
): Promise<Result<RecallQuestionView[], ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(saveRecallEditsInput, input);
    if (!parsed.ok) return parsed;

    const { pages, uow } = generationDeps();
    const result = await applyRecallEdits(
      parsed.value,
      { pages, uow, clock: systemClock, ids: { next: createId } },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateActiveRecall();
    return ok(result.value.questions.map(toView));
  });
}
