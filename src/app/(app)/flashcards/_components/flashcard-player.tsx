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
import {
  SessionSummary,
  type SessionSummaryStat,
} from "@/shared/ui/session-summary";
import { type StatDotItem, StatDots } from "@/shared/ui/stat-dots";
import { plural } from "../_lib/plural";
// One card of the session. `hints` overrides the default hint under each
// rating button (a real session shows the days SM-2 would schedule).
export interface PlayerCard {
  id: string;
  front: string;
  back: string;
  hints?: Partial<Record<RatingTone, string>>;
}

export type RateOutcome =
  | { ok: true; masteryLevel?: string }
  | { ok: false; message: string };

export interface FlashcardPlayerProps {
  notebookId: string;
  deckLabel: string;
  cards: PlayerCard[];
  // Graded session: every answer goes through onRate and the player
  // advances only when it resolves ok. Without it the session is local
  // (design preview on sample data).
  onRate?: (card: PlayerCard, tone: RatingTone) => Promise<RateOutcome>;
  // Called once when the session ends (last card graded or "Terminar").
  onFinish?: () => void | Promise<void>;
  // Graded session: the summary's primary action leaves the player instead
  // of restarting it (graded cards are no longer due).
  onExit?: () => void;
}

const RATINGS: { tone: RatingTone; label: string; hint: string }[] = [
  { tone: "again", label: "Otra vez", hint: "< 1 min" },
  { tone: "hard", label: "Difícil", hint: "Repasar pronto" },
  { tone: "good", label: "Bien", hint: "Mañana" },
  { tone: "easy", label: "Fácil", hint: "4 días" },
];

// Tally tone lookup shared by the header StatDots and the SessionSummary
// stats grid (StatDots/SessionSummary generalized 2026-09-24 so both
// Flashcards and Active recall can reuse them — see each atom's own docs).
const TALLY_TONE: {
  tone: RatingTone;
  label: string;
  dotClassName: string;
  toneClassName: string;
}[] = [
  {
    tone: "again",
    label: "Otra vez",
    dotClassName: "bg-error-500",
    toneClassName: "text-error-600",
  },
  {
    tone: "hard",
    label: "Difícil",
    dotClassName: "bg-warning-500",
    toneClassName: "text-warning-600",
  },
  {
    tone: "good",
    label: "Bien",
    dotClassName: "bg-success-500",
    toneClassName: "text-success-600",
  },
  {
    tone: "easy",
    label: "Fácil",
    dotClassName: "bg-primary-600",
    toneClassName: "text-primary-600",
  },
];

// Client flip-card study session (mockups flashcard.png/flashcard2.png).
// Presentational: the current card, flip, tally and summary state are local;
// persistence is the caller's, through onRate/onFinish (the page deck's
// DeckReview wires them to the review-session Server Actions). Without
// them it plays the design-preview sample deck locally.
export function FlashcardPlayer({
  notebookId,
  deckLabel,
  cards,
  onRate,
  onFinish,
  onExit,
}: FlashcardPlayerProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masteryLevel, setMasteryLevel] = useState<string | null>(null);

  const total = cards.length;
  const reviewed = tally.again + tally.hard + tally.good + tally.easy;
  const progress = total > 0 ? Math.round((index / total) * 100) : 0;
  const card = cards[index];
  const decksHref = `/flashcards/${notebookId}`;

  const statDotItems: StatDotItem[] = TALLY_TONE.map(
    ({ tone, dotClassName }) => ({
      key: tone,
      count: tally[tone],
      dotClassName,
    }),
  );
  const summaryStats: SessionSummaryStat[] = TALLY_TONE.map(
    ({ tone, label, toneClassName }) => ({
      key: tone,
      label,
      value: tally[tone],
      toneClassName,
    }),
  );

  function finish() {
    setFinished(true);
    void onFinish?.();
  }

  async function rate(tone: RatingTone) {
    if (!card || saving) return;
    if (onRate) {
      setSaving(true);
      setError(null);
      const outcome = await onRate(card, tone);
      setSaving(false);
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      if (outcome.masteryLevel) setMasteryLevel(outcome.masteryLevel);
    }
    setTally((prev) => ({ ...prev, [tone]: prev[tone] + 1 }));
    if (index + 1 >= total) {
      finish();
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
            {plural(total, "tarjeta", "tarjetas")} en esta sesión
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatDots items={statDotItems} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-fg-muted"
            disabled={saving || finished}
            onClick={finish}
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
                hint={card?.hints?.[rating.tone] ?? rating.hint}
                disabled={saving}
                onClick={() => void rate(rating.tone)}
              />
            ))}
          </div>
          {error && (
            <p role="alert" className="text-center text-error-600 text-xs">
              {error}
            </p>
          )}
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
          title="¡Sesión completada!"
          subtitle={`${deckLabel} — ${plural(reviewed, "tarjeta revisada", "tarjetas revisadas")}`}
          stats={summaryStats}
          highlight={
            onRate ? (
              masteryLevel && (
                <>
                  <p className="text-[13px] text-fg-muted">
                    Nivel de dominio de la página
                  </p>
                  <p className="mt-0.5 font-semibold text-[15px] text-fg">
                    {masteryLevel}
                  </p>
                </>
              )
            ) : (
              <>
                <p className="text-[13px] text-fg-muted">Próxima revisión</p>
                <p className="mt-0.5 font-semibold text-[15px] text-fg">
                  Mañana · {total} tarjetas programadas
                </p>
              </>
            )
          }
          secondaryAction={
            onExit
              ? { label: "Todos los mazos", href: decksHref }
              : { label: "Volver al mazo", href: decksHref }
          }
          primaryAction={
            onExit
              ? { label: "Volver al mazo", onClick: onExit }
              : { label: "Repasar de nuevo →", onClick: restart }
          }
        />
      )}
    </div>
  );
}
