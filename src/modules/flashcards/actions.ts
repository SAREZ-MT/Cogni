"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { AI_ERROR, createAiServerApi } from "@/modules/ai";
import { getCurrentUser } from "@/modules/identity";
import { createNotebooksServerApi } from "@/modules/notebooks";
import { serverEnv } from "@/shared/config/env.server";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import { createServerAnalytics } from "@/shared/observability/analytics";
import {
  DailyLimitReachedError,
  getGenerationStatus as getGenerationStatusUseCase,
  listDecks as listDecksUseCase,
  listFlashcardsByPage as listFlashcardsByPageUseCase,
  MAX_CARD_COUNT,
  MIN_CARD_COUNT,
  requestGeneration as requestGenerationUseCase,
} from "./application";
import { FLASHCARD_ERROR } from "./domain/errors";
import type { Flashcard } from "./domain/flashcard";
import { DrizzleFlashcardRepository } from "./infrastructure";

// Server Actions are the only client-reachable entry point of this module:
// session first, Zod validation, then the use case, and every DomainError
// leaves as the plain ActionError shape. None of them throws to the client.
//
// The generation action runs a long provider call: Next applies
// `maxDuration` from the route segment that hosts the action (the page
// route, see notebooks/[notebookId]/pages/[pageId]/page.tsx).

export interface FlashcardView {
  id: string;
  pageId: string;
  front: string;
  back: string;
  position: number;
}

export interface GenerationView {
  cards: FlashcardView[];
  remainingToday: number;
  truncated: boolean;
  wordsUsed: number;
  wordsTotal: number;
}

// One deck = one page with cards (no due count until the Phase 4 scheduler).
export interface DeckView {
  pageId: string;
  notebookId: string;
  pageTitle: string;
  notebookTitle: string;
  notebookColor: string | null;
  count: number;
}

export interface GenerationStatusView {
  remainingToday: number;
  // ISO instant when the daily window resets.
  resetAt: string;
}

// `resetAt` (ISO) accompanies AI_DAILY_LIMIT_REACHED so the UI can say when
// generation is available again.
export interface GenerationActionError extends ActionError {
  readonly resetAt?: string;
}

const pageInput = z.object({ pageId: z.uuid() });
const generateInput = z.object({
  pageId: z.uuid(),
  count: z.number().int().min(MIN_CARD_COUNT).max(MAX_CARD_COUNT).optional(),
});

const UNEXPECTED_ERROR: ActionError = {
  code: FLASHCARD_ERROR.UNEXPECTED,
  message: "unexpected flashcards action failure",
};

function actionError(code: string, message: string): ActionError {
  return toActionError(new DomainError(code, message));
}

async function requireOwnerId(): Promise<Result<string, ActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return err(
      actionError(
        FLASHCARD_ERROR.SESSION_REQUIRED,
        "Debes iniciar sesión para continuar.",
      ),
    );
  }
  return ok(user.id);
}

function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): Result<T, ActionError> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return err(
      actionError(FLASHCARD_ERROR.INVALID_INPUT, "Invalid flashcards input"),
    );
  }
  return ok(parsed.data);
}

// Adapters are built per call, like ingestion/actions.ts: serverless
// functions are short-lived, so no module-level singletons.
function deps() {
  const db = getDb();
  const env = serverEnv();
  const ai = createAiServerApi({
    env,
    db,
    clock: systemClock,
    ids: { next: createId },
  });
  return {
    env,
    ai,
    pages: createNotebooksServerApi({ db, clock: systemClock }),
    flashcards: new DrizzleFlashcardRepository(db),
    analytics: createServerAnalytics({
      key: env.NEXT_PUBLIC_POSTHOG_KEY,
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
    }),
  };
}

async function withBoundary<T>(
  run: () => Promise<Result<T, ActionError>>,
): Promise<Result<T, ActionError>> {
  try {
    return await run();
  } catch (error) {
    Sentry.captureException(error);
    return err(UNEXPECTED_ERROR);
  }
}

function toView(card: Flashcard): FlashcardView {
  return {
    id: card.id,
    pageId: card.pageId,
    front: card.front,
    back: card.back,
    position: card.position,
  };
}

function statusFor(error: DomainError): "limit" | "empty" | "failed" {
  if (error.code === AI_ERROR.DAILY_LIMIT_REACHED) return "limit";
  if (error.code === AI_ERROR.PAGE_EMPTY) return "empty";
  return "failed";
}

export async function generateFlashcardsAction(
  input: unknown,
): Promise<Result<GenerationView, GenerationActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(generateInput, input);
    if (!parsed.ok) return parsed;

    const { env, ai, pages, flashcards, analytics } = deps();
    const result = await requestGenerationUseCase(
      parsed.value,
      {
        limiter: ai.generationLimiter,
        pages,
        ai,
        flashcards,
        clock: systemClock,
        ids: { next: createId },
        tokenCap: env.AI_PAGE_TOKEN_CAP,
        defaultCount: 10,
      },
      ownerId.value,
    );

    if (!result.ok) {
      await analytics.track("generation_requested", ownerId.value, {
        pageId: parsed.value.pageId,
        provider: null,
        model: null,
        status: statusFor(result.error),
        truncated: false,
      });
      const error: GenerationActionError = toActionError(result.error);
      return err(
        result.error instanceof DailyLimitReachedError
          ? { ...error, resetAt: result.error.resetAt.toISOString() }
          : error,
      );
    }

    const value = result.value;
    await analytics.track("generation_requested", ownerId.value, {
      pageId: parsed.value.pageId,
      provider: value.provider,
      model: value.model,
      status: "done",
      truncated: value.truncated,
    });
    return ok({
      cards: value.cards.map(toView),
      remainingToday: value.remainingToday,
      truncated: value.truncated,
      wordsUsed: value.wordsUsed,
      wordsTotal: value.wordsTotal,
    });
  });
}

export async function listFlashcardsAction(
  input: unknown,
): Promise<Result<FlashcardView[], ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const { flashcards } = deps();
    const result = await listFlashcardsByPageUseCase(
      parsed.value,
      { flashcards },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok(result.value.map(toView));
  });
}

export async function getGenerationStatusAction(): Promise<
  Result<GenerationStatusView, ActionError>
> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;

    const { ai } = deps();
    const result = await getGenerationStatusUseCase(
      { limiter: ai.generationLimiter },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok({
      remainingToday: result.value.remainingToday,
      resetAt: result.value.resetAt.toISOString(),
    });
  });
}

export async function listDecksAction(): Promise<
  Result<DeckView[], ActionError>
> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;

    const { flashcards } = deps();
    const result = await listDecksUseCase({ flashcards }, ownerId.value);
    if (!result.ok) return err(toActionError(result.error));
    return ok(result.value.map((deck) => ({ ...deck })));
  });
}
