import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "./errors";

export type FlashcardOrigin = "ai" | "manual";

// Upper bound per side for hand-written cards, counted after trimming
// (createManualFlashcard, with no UI caller since Phase 8 H13: cards are
// created by AI only). AI cards have no bound of their own; this one keeps a
// manual card readable on the flip card and the payload small.
export const MAX_FLASHCARD_SIDE_LENGTH = 1000;

// One card of a page's deck (documento-maestro §6.1). `generationId` links
// AI-made cards to the audited generation; null for manual cards.
export interface Flashcard {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string;
  readonly generationId: string | null;
  readonly front: string;
  readonly back: string;
  readonly origin: FlashcardOrigin;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // Logical delete (§6.1): an archived card leaves every read and its study
  // item is suspended.
  readonly archivedAt: Date | null;
}

export interface NewFlashcard {
  id: string;
  ownerId: string;
  pageId: string;
  generationId: string | null;
  front: string;
  back: string;
  origin: FlashcardOrigin;
  position: number;
}

// A deck never holds an empty card: front and back are trimmed and must be
// non-blank (the database enforces the same with CHECK constraints).
export function createFlashcard(
  input: NewFlashcard,
  now: Date,
): Result<Flashcard, DomainError> {
  const front = input.front.trim();
  const back = input.back.trim();
  if (front === "" || back === "") {
    return err(
      new DomainError(
        FLASHCARD_ERROR.EMPTY,
        "A flashcard needs a non-empty front and back",
      ),
    );
  }
  return ok({
    ...input,
    front,
    back,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });
}
