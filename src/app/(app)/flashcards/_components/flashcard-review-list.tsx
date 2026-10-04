"use client";

import { useState } from "react";
import { FlipCard } from "@/shared/ui/flip-card";
import { ArchiveFlashcardButton } from "./archive-flashcard-button";

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardReviewListProps {
  cards: ReviewCard[];
  // Adds an "Archivar" action under each card (the real page deck).
  archivable?: boolean;
}

// Ungraded review of a page's real deck: every card is a FlipCard that flips
// on click. The graded study session (ratings, SM-2 scheduling) is Phase 4 and
// lives in FlashcardPlayer, which still runs on sample data. Each card keeps
// its own flipped state and is anchored by its id so the techniques panel can
// link straight to it. The archive action sits outside the FlipCard so
// clicking it never flips the card.
export function FlashcardReviewList({
  cards,
  archivable = false,
}: FlashcardReviewListProps) {
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string) {
    setFlipped((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[660px] flex-col gap-5">
      {cards.map((card) => (
        <div
          key={card.id}
          id={card.id}
          className="flex scroll-mt-4 flex-col gap-1.5"
          data-testid="review-card"
        >
          <FlipCard
            front={card.front}
            back={card.back}
            flipped={flipped.has(card.id)}
            onToggle={() => toggle(card.id)}
            backHint="Toca la tarjeta para ver la pregunta"
          />
          {archivable && (
            <div className="flex justify-end">
              <ArchiveFlashcardButton flashcardId={card.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
