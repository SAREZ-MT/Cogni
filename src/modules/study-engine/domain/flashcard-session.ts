// One flashcard review session (documento-maestro §6.1). pageId is null for
// the multi-page "Repasos de hoy" session. A session is open while
// finishedAt is null; it records only counts, never study time (product
// rule: no time metric).
export interface FlashcardSession {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string | null;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly reviewedCount: number;
  // Answers graded "Otra vez" (quality 1).
  readonly againCount: number;
}

export interface NewFlashcardSessionInput {
  id: string;
  ownerId: string;
  pageId: string | null;
  now: Date;
}

export function newFlashcardSession(
  input: NewFlashcardSessionInput,
): FlashcardSession {
  return {
    id: input.id,
    ownerId: input.ownerId,
    pageId: input.pageId,
    startedAt: input.now,
    finishedAt: null,
    reviewedCount: 0,
    againCount: 0,
  };
}
