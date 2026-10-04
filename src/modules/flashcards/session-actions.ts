"use server";

import { z } from "zod";
import { createNotebooksServerApi } from "@/modules/notebooks";
import {
  createFlashcardSessionsServerApi,
  type DueFlashcard,
  FLASHCARD_QUALITY,
  type FlashcardRating,
} from "@/modules/study-engine";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { type ActionError, toActionError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  parseInput,
  requireOwnerId,
  revalidateDecks,
  withBoundary,
} from "./action-support";
import type { Flashcard } from "./domain/flashcard";
import type { FlashcardRepository } from "./domain/flashcard-repository";
import { DrizzleFlashcardRepository } from "./infrastructure";

// Server Actions of the flashcard review session (documento-maestro §3.3,
// §7.2): study-engine schedules (SM-2, logs, mastery), this module adds the
// card text. Same boundary as actions.ts: session, Zod, ActionError, never
// throws.

export interface ReviewCardView {
  itemId: string;
  flashcardId: string;
  front: string;
  back: string;
  // Days each button would schedule, for the button hints.
  nextIntervalDays: Record<FlashcardRating, number>;
}

export interface ReviewSessionView {
  sessionId: string;
  cards: ReviewCardView[];
}

export interface GradeView {
  reviewedCount: number;
  againCount: number;
  // The graded card's page level after this answer (§7.3).
  masteryLevel: string;
}

// Counts only: the product never shows study time.
export interface ReviewSummaryView {
  reviewedCount: number;
  againCount: number;
}

const RATINGS = Object.keys(FLASHCARD_QUALITY) as [
  FlashcardRating,
  ...FlashcardRating[],
];

const startInput = z.object({ pageId: z.uuid().optional() });
const gradeInput = z.object({
  sessionId: z.uuid(),
  itemId: z.uuid(),
  rating: z.enum(RATINGS),
});
const finishInput = z.object({ sessionId: z.uuid() });

function deps() {
  const db = getDb();
  return {
    sessions: createFlashcardSessionsServerApi({
      db,
      pages: createNotebooksServerApi({ db, clock: systemClock }),
      clock: systemClock,
      ids: { next: createId },
    }),
    flashcards: new DrizzleFlashcardRepository(db),
  };
}

// Attaches each due item's card text, keeping the due order. A card that is
// no longer readable (archived after its item was listed) is left out.
async function withText(
  items: readonly DueFlashcard[],
  flashcards: FlashcardRepository,
  ownerId: string,
): Promise<ReviewCardView[]> {
  const cards = new Map<string, Flashcard>();
  for (const pageId of new Set(items.map((item) => item.pageId))) {
    for (const card of await flashcards.listByPage(pageId, ownerId)) {
      cards.set(card.id, card);
    }
  }
  return items.flatMap((item) => {
    const card = cards.get(item.flashcardId);
    return card
      ? [
          {
            itemId: item.itemId,
            flashcardId: card.id,
            front: card.front,
            back: card.back,
            nextIntervalDays: item.nextIntervalDays,
          },
        ]
      : [];
  });
}

export async function startFlashcardSessionAction(
  input: unknown,
): Promise<Result<ReviewSessionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(startInput, input);
    if (!parsed.ok) return parsed;

    const { sessions, flashcards } = deps();
    const started = await sessions.start(ownerId.value, parsed.value);
    if (!started.ok) return err(toActionError(started.error));
    return ok({
      sessionId: started.value.session.id,
      cards: await withText(started.value.items, flashcards, ownerId.value),
    });
  });
}

export async function gradeFlashcardAction(
  input: unknown,
): Promise<Result<GradeView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(gradeInput, input);
    if (!parsed.ok) return parsed;

    // No revalidation here: the deck re-renders once, when the session ends.
    const graded = await deps().sessions.grade(ownerId.value, parsed.value);
    if (!graded.ok) return err(toActionError(graded.error));
    return ok({
      reviewedCount: graded.value.session.reviewedCount,
      againCount: graded.value.session.againCount,
      masteryLevel: graded.value.mastery.level,
    });
  });
}

export async function finishFlashcardSessionAction(
  input: unknown,
): Promise<Result<ReviewSummaryView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(finishInput, input);
    if (!parsed.ok) return parsed;

    const finished = await deps().sessions.finish(ownerId.value, parsed.value);
    if (!finished.ok) return err(toActionError(finished.error));
    revalidateDecks();
    return ok({
      reviewedCount: finished.value.reviewedCount,
      againCount: finished.value.againCount,
    });
  });
}
