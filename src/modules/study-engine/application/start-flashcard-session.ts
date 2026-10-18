import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { STUDY_ENGINE_ERROR } from "../domain/errors";
import {
  type FlashcardSession,
  newFlashcardSession,
} from "../domain/flashcard-session";
import type { FlashcardSessionRepository } from "../domain/flashcard-session-repository";
import { applySm2 } from "../domain/sm2";
import {
  type DueCutoff,
  FLASHCARD_QUALITY,
  type FlashcardRating,
  type StudyItem,
} from "../domain/study-item";
import type { StudyItemRepository } from "../domain/study-item-repository";

// The page check this use case needs: an error (PAGE_NOT_FOUND) when the
// page is missing, archived or another owner's. notebooks' PageTextReader
// satisfies it structurally; study-engine does not depend on its shape.
export interface PageAccess {
  getPageText(
    pageId: string,
    ownerId: string,
  ): Promise<Result<unknown, DomainError>>;
}

export interface StartFlashcardSessionDeps {
  pages: PageAccess;
  studyItems: Pick<StudyItemRepository, "listDue">;
  sessions: Pick<FlashcardSessionRepository, "insert">;
  clock: Clock;
  // The owner's "due" bound (start of their next local day): a card due
  // later today is already in the session.
  dueCutoff: DueCutoff;
  ids: { next(): string };
}

// One due card of the session; flashcardId is the item's source, so the
// flashcards module can attach the card's text.
export interface DueFlashcard {
  itemId: string;
  flashcardId: string;
  pageId: string;
  // What each button would schedule now (§7.1), for the button hints.
  nextIntervalDays: Record<FlashcardRating, number>;
}

export interface StartedFlashcardSession {
  session: FlashcardSession;
  items: DueFlashcard[];
}

const RATINGS = Object.keys(FLASHCARD_QUALITY) as FlashcardRating[];

// Opens a flashcard review session (§3.3): the flashcards due today (per
// local day, deps.dueCutoff) of one page, or of every page of the owner
// when pageId is absent ("Repasos de hoy").
// Nothing due answers NOTHING_DUE and opens no session.
export async function startFlashcardSession(
  input: { pageId?: string },
  deps: StartFlashcardSessionDeps,
  ownerId: string,
): Promise<Result<StartedFlashcardSession, DomainError>> {
  if (input.pageId !== undefined) {
    const page = await deps.pages.getPageText(input.pageId, ownerId);
    if (!page.ok) return page;
  }

  const now = deps.clock.now();
  const due = (
    await deps.studyItems.listDue(ownerId, deps.dueCutoff(now), input.pageId)
  ).filter((item) => item.kind === "flashcard");
  if (due.length === 0) {
    return err(
      new DomainError(STUDY_ENGINE_ERROR.NOTHING_DUE, "No flashcard is due"),
    );
  }

  const session = newFlashcardSession({
    id: deps.ids.next(),
    ownerId,
    pageId: input.pageId ?? null,
    now,
  });
  await deps.sessions.insert(session);

  return ok({
    session,
    items: due.map((item) => ({
      itemId: item.id,
      flashcardId: item.sourceId,
      pageId: item.pageId,
      nextIntervalDays: previewIntervals(item, now),
    })),
  });
}

function previewIntervals(
  item: StudyItem,
  now: Date,
): Record<FlashcardRating, number> {
  const preview = {} as Record<FlashcardRating, number>;
  for (const rating of RATINGS) {
    const next = applySm2(item, FLASHCARD_QUALITY[rating], now);
    // FLASHCARD_QUALITY only holds valid qualities, so applySm2 never fails.
    preview[rating] = next.ok ? next.value.intervalDays : 0;
  }
  return preview;
}
