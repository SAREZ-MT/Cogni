"use client";

import { useState } from "react";
import { FlipCard } from "@/shared/ui/flip-card";

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardReviewListProps {
  cards: ReviewCard[];
}

// Ungraded review of a page's real deck: every card is a FlipCard that flips
// on click. The graded study session (ratings, SM-2 scheduling) is Phase 4 and
// lives in FlashcardPlayer, which still runs on sample data. Each card keeps
// its own flipped state and is anchored by its id so the techniques panel can
// link straight to it.
export function FlashcardReviewList({ cards }: FlashcardReviewListProps) {
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
        <div key={card.id} id={card.id} className="scroll-mt-4">
          <FlipCard
            front={card.front}
            back={card.back}
            flipped={flipped.has(card.id)}
            onToggle={() => toggle(card.id)}
            backHint="Toca la tarjeta para ver la pregunta"
          />
        </div>
      ))}
    </div>
  );
}
