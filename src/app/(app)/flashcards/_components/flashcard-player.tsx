"use client";

import { CheckCircle2, ChevronLeft, Eye, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { FlipCard } from "@/shared/ui/flip-card";
import { IconTile } from "@/shared/ui/icon-tile";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { RatingButton, type RatingTone } from "@/shared/ui/rating-button";
import { SessionSummary } from "@/shared/ui/session-summary";
import { StatDots } from "@/shared/ui/stat-dots";
import type { SampleCard } from "../_data/sample";

export interface FlashcardPlayerProps {
  notebookId: string;
  deckLabel: string;
  cards: SampleCard[];
}

const RATINGS: { tone: RatingTone; label: string; hint: string }[] = [
  { tone: "again", label: "Otra vez", hint: "< 1 min" },
  { tone: "hard", label: "Difícil", hint: "Repasar pronto" },
  { tone: "good", label: "Bien", hint: "Mañana" },
  { tone: "easy", label: "Fácil", hint: "4 días" },
];

// Client flip-card study session (design preview, mockups flashcard.png/
// flashcard2.png). All state — current card, flip, rating tally, whether
// the summary is showing — is local and resets on remount; nothing is
// persisted, matching the "validar el diseño" scope (no backend yet).
export function FlashcardPlayer({
  notebookId,
  deckLabel,
  cards,
}: FlashcardPlayerProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [finished, setFinished] = useState(false);

  const total = cards.length;
  const reviewed = tally.again + tally.hard + tally.good + tally.easy;
  const progress = total > 0 ? Math.round((index / total) * 100) : 0;
  const card = cards[index];
  const decksHref = `/flashcards/${notebookId}`;

  function rate(tone: RatingTone) {
    setTally((prev) => ({ ...prev, [tone]: prev[tone] + 1 }));
    if (index + 1 >= total) {
      setFinished(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setFlipped(false);
  }

  function restart() {
    setIndex(0);
    setFlipped(false);
    setTally({ again: 0, hard: 0, good: 0, easy: 0 });
    setFinished(false);
  }

  if (total === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[660px] flex-1 flex-col items-center justify-center gap-6 py-16">
        <BackLink href={decksHref}>Todos los mazos</BackLink>
        <EmptyState
          variant="success"
          icon={
            <IconTile size="56" radius="xl" tone="success">
              <CheckCircle2 aria-hidden="true" size={26} strokeWidth={1.5} />
            </IconTile>
          }
          title="Sin tarjetas en este mazo"
          titleClassName="text-lg"
          description={`${deckLabel} no tiene tarjetas aún.`}
          action={
            <Button asChild variant="outline">
              <Link href={decksHref}>Volver al mazo</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div
      data-testid="flashcard-player"
      className="mx-auto flex w-full max-w-[660px] flex-1 flex-col gap-6 py-8"
    >
      <BackLink href={decksHref}>Todos los mazos</BackLink>

      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-[16px] text-fg">{deckLabel}</p>
          <p className="mt-0.5 text-fg-muted text-xs">
            {total} tarjetas en esta sesión
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatDots counts={tally} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-fg-muted"
            onClick={() => setFinished(true)}
          >
            <X aria-hidden="true" size={13} strokeWidth={2} />
            Terminar
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-fg-secondary">
            Tarjeta {index + 1} de {total}
          </span>
          <span className="text-fg-muted text-xs">{progress}%</span>
        </div>
        <ProgressBar
          value={progress}
          className="h-1.5"
          fillClassName="bg-warning-500 transition-[width] duration-[400ms] ease-out"
        />
      </div>

      {card && (
        <FlipCard
          key={card.id}
          front={card.front}
          back={card.back}
          flipped={flipped}
          onToggle={() => setFlipped((prev) => !prev)}
        />
      )}

      {flipped ? (
        <div className="flex flex-col gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
            onClick={() => setFlipped(false)}
          >
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
            Ver pregunta
          </Button>
          <div className="flex gap-2.5">
            {RATINGS.map((rating) => (
              <RatingButton
                key={rating.tone}
                tone={rating.tone}
                label={rating.label}
                hint={rating.hint}
                onClick={() => rate(rating.tone)}
              />
            ))}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          className="w-full justify-center font-medium text-[15px]"
          onClick={() => setFlipped(true)}
        >
          <Eye aria-hidden="true" size={16} strokeWidth={2} />
          Mostrar respuesta
        </Button>
      )}

      {finished && (
        <SessionSummary
          deckLabel={deckLabel}
          reviewedCount={reviewed}
          nextReviewCount={total}
          stats={tally}
          backHref={decksHref}
          onRestart={restart}
        />
      )}
    </div>
  );
}
