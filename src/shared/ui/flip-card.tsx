"use client";

import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  flipped: boolean;
  onToggle: () => void;
  frontEyebrow?: string;
  backEyebrow?: string;
  frontHint?: string;
  backHint?: string;
  className?: string;
}

// 3D flip card (studyplatform-flashcards-style.md §3, mockups
// flashcard.png/flashcard2.png): a 660px-wide, 300px-tall perspective card
// that rotates on the Y axis between a plain question face and a violet
// gradient answer face. It's a real `<button>` (native keyboard/Space/
// Enter activation + `aria-pressed`), so the caller only owns `flipped`/
// `onToggle`. Caller keys this component per card so a new card starts
// unflipped without animating in from the previous card's angle.
export function FlipCard({
  front,
  back,
  flipped,
  onToggle,
  frontEyebrow = "Frente · Pregunta",
  backEyebrow = "Reverso · Respuesta",
  frontHint = "Toca la tarjeta para ver la respuesta",
  backHint = "Califica tu respuesta abajo · Toca la tarjeta para ver la pregunta",
  className,
}: FlipCardProps) {
  return (
    <div className={cn("h-[300px] w-full [perspective:1000px]", className)}>
      <button
        type="button"
        data-testid="flip-card"
        data-flipped={flipped}
        aria-pressed={flipped}
        onClick={onToggle}
        className={cn(
          "relative size-full cursor-pointer text-left [transform-style:preserve-3d] transition-transform duration-[550ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          flipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]",
        )}
      >
        {/* Front face — the question */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-neutral-200/70 bg-card p-9 text-center shadow-card [backface-visibility:hidden]">
          <p className="mb-4 font-medium text-[11px] text-fg-muted uppercase tracking-wide">
            {frontEyebrow}
          </p>
          <p className="font-semibold text-fg text-lg leading-relaxed">
            {front}
          </p>
          <p className="mt-4 flex items-center gap-1 text-fg-muted text-xs">
            <Eye aria-hidden="true" size={12} strokeWidth={2} />
            {frontHint}
          </p>
        </div>

        {/* Back face — the answer */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-primary-300/40 bg-gradient-to-br from-primary-50 to-primary-100 p-9 text-center shadow-card [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="mb-4 font-medium text-[11px] text-primary-400 uppercase tracking-wide">
            {backEyebrow}
          </p>
          <p className="font-semibold text-lg text-primary-900 leading-relaxed">
            {back}
          </p>
          <p className="mt-4 flex items-center gap-1 text-primary-400 text-xs">
            <Eye aria-hidden="true" size={12} strokeWidth={2} />
            {backHint}
          </p>
        </div>
      </button>
    </div>
  );
}
