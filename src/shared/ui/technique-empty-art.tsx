import { Check, EyeOff, RotateCw, Sparkle } from "lucide-react";
import type { ReactNode } from "react";
import type { TechniqueTheme } from "@/shared/ui/technique-theme";
import { cn } from "@/shared/ui/utils";

// Decorative hero of a technique hub's empty state (Phase 8 H11, the
// user-approved v2 mock of 2026-10-29, replacing H10's fanned cards): each
// technique shows itself at work, with generic content only.
// - Flashcards: a tidy deck (no rotation), four cards behind the front one
//   stepping 7px right and 8px up from pale to deeper amber, the front with
//   "Pregunta", "1 / 12", a question, "Toca para voltear" and position dots.
// - Recordación activa: the open question in a speech bubble over a ruled
//   answer sheet — "De memoria, sin mirar tu apunte", a handwritten answer
//   in Caveat (--font-handwriting) with a blinking caret, the word count and
//   the self-rating chips.
// - Exámenes: a clean test sheet with its header, a tilted 8/10 score, a
//   ten-step progress strip and options A–D with B chosen.
// The look lives in globals.css (`.tea-*`, the mock's CSS); the stage
// shrinks with its column through container queries (`zoom`), so it never
// overflows. The caret rests under reduced motion (CSS). Hidden from
// assistive technology; no client JavaScript.

function DeckArt() {
  return (
    <div className="tea-deck">
      {[4, 3, 2, 1].map((depth) => (
        <span
          key={depth}
          data-part="deck-back"
          data-depth={depth}
          className="tea-deck-card tea-deck-back"
        />
      ))}
      <div data-part="deck-front" className="tea-deck-card tea-deck-front">
        <div className="tea-deck-top">
          <span className="tea-kicker">Pregunta</span>
          <span className="tea-counter">1 / 12</span>
        </div>
        <p className="tea-deck-q">
          ¿Qué describe el concepto clave de esta página?
        </p>
        <div className="tea-deck-foot">
          <span className="tea-flip">
            <RotateCw aria-hidden="true" size={13} strokeWidth={2.2} />
            Toca para voltear
          </span>
          <span className="tea-deck-dots">
            {[0, 1, 2, 3, 4].map((index) => (
              <i
                key={index}
                data-part="deck-dot"
                data-on={index === 0 ? "" : undefined}
              />
            ))}
          </span>
        </div>
      </div>
      <span className="tea-deck-shadow" />
    </div>
  );
}

const RATINGS = ["Me faltó", "A medias", "Lo recordé"] as const;

function RecallArt() {
  return (
    <div className="tea-recall">
      <div className="tea-bubble">
        <span className="tea-bubble-icon">
          <Sparkle aria-hidden="true" size={14} strokeWidth={2} />
        </span>
        <div>
          <span className="tea-kicker">Pregunta abierta</span>
          <p className="tea-bubble-q">
            ¿Cómo le explicarías esta idea a alguien que no la conoce?
          </p>
        </div>
      </div>
      <div className="tea-sheet">
        <div className="tea-sheet-head">
          <span className="tea-memory">
            <EyeOff aria-hidden="true" size={13} strokeWidth={2} />
            De memoria, sin mirar tu apunte
          </span>
        </div>
        <div className="tea-lines">
          <p data-part="handwriting" className="tea-hand">
            Es la idea que conecta las otras partes del tema, porque explica
            <span data-part="caret" className="tea-caret" />
          </p>
        </div>
        <div className="tea-sheet-foot">
          <span className="tea-wc">24 palabras</span>
          <span className="tea-rate">
            {RATINGS.map((rating) => {
              const on = rating === "A medias";
              return (
                <span
                  key={rating}
                  data-part="rating-chip"
                  data-on={on ? "" : undefined}
                  className="tea-chip"
                >
                  {on && (
                    <Check aria-hidden="true" size={11} strokeWidth={2.6} />
                  )}
                  {rating}
                </span>
              );
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

const OPTIONS = ["A", "B", "C", "D"] as const;
const SELECTED = "B";

function ExamArt() {
  return (
    <div className="tea-exam">
      <div className="tea-paper tea-paper-under" />
      <div className="tea-paper">
        <div className="tea-exam-head">
          <div>
            <span className="tea-kicker">Examen · 10 preguntas</span>
            <p className="tea-exam-sub">Pregunta 3</p>
          </div>
          <span data-part="score" className="tea-score">
            <b>8</b>
            <small>/10</small>
          </span>
        </div>
        <div className="tea-exam-steps">
          {Array.from({ length: 10 }, (_, index) => (
            <i
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, static strip
              key={index}
              data-part="exam-step"
              data-state={index < 2 ? "done" : index === 2 ? "now" : "todo"}
            />
          ))}
        </div>
        <p className="tea-exam-q">¿Qué idea resume mejor el concepto clave?</p>
        <ul className="tea-opts">
          {OPTIONS.map((key) => {
            const selected = key === SELECTED;
            return (
              <li
                key={key}
                data-part="option"
                data-selected={selected ? "" : undefined}
              >
                <span className="tea-opt-key">
                  {selected ? (
                    <Check aria-hidden="true" size={11} strokeWidth={2.8} />
                  ) : (
                    key
                  )}
                </span>
                <span>Opción {key}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const ART: Record<TechniqueTheme, () => ReactNode> = {
  flashcards: DeckArt,
  recall: RecallArt,
  exams: ExamArt,
};

export interface TechniqueEmptyArtProps {
  technique: TechniqueTheme;
  className?: string;
}

export function TechniqueEmptyArt({
  technique,
  className,
}: TechniqueEmptyArtProps) {
  const Art = ART[technique];
  return (
    <div
      aria-hidden="true"
      data-slot="technique-empty-art"
      data-technique={technique}
      className={cn("tea", className)}
    >
      <div className="tea-stage">
        <Art />
      </div>
    </div>
  );
}
