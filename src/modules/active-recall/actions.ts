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
  RecallDailyLimitReachedError,
  requestRecallGeneration,
} from "./application";
import type {
  RecallQuestion,
  RecallQuestionOrigin,
} from "./domain/recall-question";
import {
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
}

const generateInput = z.object({ pageId: z.uuid() });

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

function statusFor(error: DomainError): "limit" | "empty" | "failed" {
  if (error.code === AI_ERROR.DAILY_LIMIT_REACHED) return "limit";
  if (error.code === AI_ERROR.PAGE_EMPTY) return "empty";
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

    const { env, ai, pages, questions, uow, analytics } = generationDeps();
    const result = await requestRecallGeneration(
      { pageId: parsed.value.pageId },
      {
        limiter: ai.generationLimiter,
        pages,
        ai,
        questions,
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
