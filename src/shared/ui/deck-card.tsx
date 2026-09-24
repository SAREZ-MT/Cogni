import { BookOpen } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/shared/ui/pill";
import { cn } from "@/shared/ui/utils";

// Deck-color cycle (studyplatform-flashcards-style.md §2 DECK_COLORS),
// translated onto existing semantic/pastel tokens instead of new hex
// literals: amber → warning, blue → info, green → success, then two
// pastel pairs for the remaining two colors in the cycle.
export type DeckTone = "warning" | "info" | "success" | "orange" | "pink";

const TONE_BORDER: Record<DeckTone, string> = {
  warning: "border-warning-500/[13%]",
  info: "border-info-600/[13%]",
  success: "border-success-600/[13%]",
  orange: "border-pastel-orange-fg/[13%]",
  pink: "border-pastel-pink-fg/[13%]",
};

const TONE_TILE: Record<DeckTone, string> = {
  warning: "bg-warning-500/[14%] text-warning-600",
  info: "bg-info-600/[14%] text-info-600",
  success: "bg-success-600/[14%] text-success-600",
  orange: "bg-pastel-orange-fg/[14%] text-pastel-orange-fg",
  pink: "bg-pastel-pink-fg/[14%] text-pastel-pink-fg",
};

export interface DeckCardProps {
  href: string;
  tone: DeckTone;
  label: string;
  cardCount: number;
  dueCount: number;
  className?: string;
}

// Deck grid item (studyplatform-flashcards-style.md §2, notebook's own
// deck list): a fixed-height link card with a cycling deck-color border/
// icon tile, a due/al-día status pill, a centered two-line-clamped label
// and a footer card count. Links straight into the study session for that
// deck.
export function DeckCard({
  href,
  tone,
  label,
  cardCount,
  dueCount,
  className,
}: DeckCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-[200px] flex-col justify-between rounded-2xl border-[1.5px] bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        TONE_BORDER[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-[30px] shrink-0 items-center justify-center rounded-md",
            TONE_TILE[tone],
          )}
        >
          <BookOpen size={15} strokeWidth={1.75} />
        </span>
        {dueCount > 0 ? (
          <Pill size="sm" tone="error" dot>
            {dueCount} pendientes
          </Pill>
        ) : (
          <Pill size="sm" tone="success" dot>
            Al día
          </Pill>
        )}
      </div>

      <p className="line-clamp-2 text-center font-bold text-fg text-lg">
        {label}
      </p>

      <div className="flex items-center justify-between">
        <span className="font-medium text-[11px] text-fg-muted">
          Flashcards
        </span>
        <span className="font-semibold text-fg-secondary text-xs">
          {cardCount} tarjetas
        </span>
      </div>
    </Link>
  );
}
