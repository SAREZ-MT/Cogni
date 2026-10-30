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
  revalidateAfterDelete,
  revalidateDecks,
  withBoundary,
} from "./action-support";
import {
  applyDeckEdits as applyDeckEditsUseCase,
  DailyLimitReachedError,
  type DeckDeletionPreview,
  deleteDeck as deleteDeckUseCase,
  getGenerationStatus as getGenerationStatusUseCase,
  listDecks as listDecksUseCase,
  listFlashcardsByPage as listFlashcardsByPageUseCase,
  MAX_CARD_COUNT,
  MIN_CARD_COUNT,
  previewDeckDeletion as previewDeckDeletionUseCase,
  requestGeneration as requestGenerationUseCase,
} from "./application";
import { FLASHCARD_ERROR } from "./domain/errors";
import type { Flashcard } from "./domain/flashcard";
import {
  DrizzleDeckDeletion,
  DrizzleDeckUnitOfWork,
  DrizzleFlashcardFingerprints,
  DrizzleFlashcardRepository,
} from "./infrastructure";

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
  // ISO; the edit page sends it back so a stale save is refused (V10).
  updatedAt: string;
}

export interface GenerationView {
  cards: FlashcardView[];
  remainingToday: number;
  truncated: boolean;
  wordsUsed: number;
  wordsTotal: number;
}

// One deck = one page with cards; its due count comes from scheduling's
// "Repasos de hoy".
export interface DeckView {
  pageId: string;
  notebookId: string;
  pageTitle: string;
  notebookTitle: string;
  notebookColor: string | null;
  count: number;
  // ISO instant of the newest active card (Phase 8 H17: hub recency).
  latestCardAt: string;
  // ISO instant of the deck's earliest scheduled review; null when none.
  nextDueAt: string | null;
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
  // AI_PAGE_TOO_SHORT (Phase 8 H14): the new paragraphs' words, the words
  // the request needs and the items those words carry.
  readonly words?: number;
  readonly minWords?: number;
  readonly maxItems?: number;
}

const pageInput = z.object({ pageId: z.uuid() });
const generateInput = z.object({
  pageId: z.uuid(),
  count: z.number().int().min(MIN_CARD_COUNT).max(MAX_CARD_COUNT).optional(),
});

// One edit page save (Phase 8 H18). The bounds only keep the payload sane;
// the domain trims and checks each side (non-blank, at most 1000).
const MAX_DRAFT_ITEMS = 200;
const sideText = z.string().max(4000);
const cardSides = z.object({ front: sideText, back: sideText });
const saveDeckEditsInput = z.object({
  pageId: z.uuid(),
  updates: z
    .array(
      cardSides.extend({
        id: z.uuid(),
        expectedUpdatedAt: z.iso.datetime().optional(),
      }),
    )
    .max(MAX_DRAFT_ITEMS),
  creates: z.array(cardSides).max(MAX_DRAFT_ITEMS),
  deletes: z.array(z.uuid()).max(MAX_DRAFT_ITEMS),
});
const deckInput = z.object({ pageId: z.uuid() });

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
    deck: new DrizzleDeckUnitOfWork(db),
    deckDeletion: new DrizzleDeckDeletion(db),
    fingerprints: new DrizzleFlashcardFingerprints(db),
    analytics: createServerAnalytics({
      key: env.NEXT_PUBLIC_POSTHOG_KEY,
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
    }),
  };
}

function toView(card: Flashcard): FlashcardView {
  return {
    id: card.id,
    pageId: card.pageId,
    front: card.front,
    back: card.back,
    position: card.position,
    updatedAt: card.updatedAt.toISOString(),
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
  if (error.code === FLASHCARD_ERROR.NO_NEW_CONTENT) return "no_new_content";
  // A page too short to generate from (H14) is tracked as empty.
  if (error.code === AI_ERROR.PAGE_EMPTY || error.code === PAGE_TOO_SHORT_CODE)
    return "empty";
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

    const { env, ai, pages, deck, fingerprints, analytics } = deps();
    const result = await requestGenerationUseCase(
      parsed.value,
      {
        limiter: ai.generationLimiter,
        pages,
        ai,
        deck,
        fingerprints,
        clock: systemClock,
        ids: { next: createId },
        tokenCap: env.AI_PAGE_TOKEN_CAP,
        defaultCount: 10,
      },
      ownerId.value,
    );

    if (!result.ok) {
      await trackSafely(analytics, "generation_requested", ownerId.value, {
        pageId: parsed.value.pageId,
        provider: null,
        model: null,
        status: statusFor(result.error),
        truncated: false,
      });
      const error: GenerationActionError = toActionError(result.error);
      if (result.error instanceof PageTooShortError) {
        return err({ ...error, ...pageTooShortDetails(result.error) });
      }
      return err(
        result.error instanceof DailyLimitReachedError
          ? { ...error, resetAt: result.error.resetAt.toISOString() }
          : error,
      );
    }

    const value = result.value;
    await trackSafely(analytics, "generation_requested", ownerId.value, {
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
    return ok(
      result.value.map((deck) => ({
        ...deck,
        latestCardAt: deck.latestCardAt.toISOString(),
        nextDueAt: deck.nextDueAt?.toISOString() ?? null,
      })),
    );
  });
}

export type DeckDeletionView = DeckDeletionPreview;

// "Eliminar mazo" (Phase 8 H19): the confirmation dialog reads what goes
// right before the user confirms.
export async function previewDeckDeletionAction(
  input: unknown,
): Promise<Result<DeckDeletionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(deckInput, input);
    if (!parsed.ok) return parsed;

    const result = await previewDeckDeletionUseCase(
      parsed.value,
      { deletion: deps().deckDeletion },
      ownerId.value,
    );
    return result.ok ? result : err(toActionError(result.error));
  });
}

// Deletes the page's whole deck for real: every card, its study item and
// review history, the deck's sessions and feedback; the page's mastery is
// rewritten from what is left.
export async function deleteDeckAction(
  input: unknown,
): Promise<Result<{ pageId: string }, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(deckInput, input);
    if (!parsed.ok) return parsed;

    const result = await deleteDeckUseCase(
      parsed.value,
      { deletion: deps().deckDeletion, clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateAfterDelete();
    return result;
  });
}

export interface DeckEditsView {
  // The deck after saving, by position.
  cards: FlashcardView[];
}

// "Guardar" on the deck's edit page (Phase 8 H18): the draft's edits,
// additions and real deletions, applied together in one transaction
// (applyDeckEdits) or not at all.
export async function saveDeckEditsAction(
  input: unknown,
): Promise<Result<DeckEditsView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(saveDeckEditsInput, input);
    if (!parsed.ok) return parsed;

    const { deck, pages } = deps();
    const result = await applyDeckEditsUseCase(
      parsed.value,
      { pages, deck, clock: systemClock, ids: { next: createId } },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateDecks();
    return ok({ cards: result.value.cards.map(toView) });
  });
}
