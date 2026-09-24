import { cn } from "@/shared/ui/utils";

export interface StatDotsCounts {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

// Rating-tone dot color per key (studyplatform-flashcards-style.md §3
// session header tally: again/hard/good/easy map to error/warning/success/
// primary respectively — the same tone vocabulary RatingButton uses).
const DOT_CLASS: Record<keyof StatDotsCounts, string> = {
  again: "bg-error-500",
  hard: "bg-warning-500",
  good: "bg-success-500",
  easy: "bg-primary-600",
};

const ORDER: (keyof StatDotsCounts)[] = ["again", "hard", "good", "easy"];

export interface StatDotsProps {
  counts: StatDotsCounts;
  className?: string;
}

// Live session tally (Flashcards design preview): 4 fixed-order dot+count
// pairs next to the "Terminar" action, purely presentational — the caller
// (FlashcardPlayer) owns incrementing the counts as the learner rates
// cards.
export function StatDots({ counts, className }: StatDotsProps) {
  return (
    <div
      data-testid="stat-dots"
      className={cn("flex items-center gap-3", className)}
    >
      {ORDER.map((tone) => (
        <span key={tone} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", DOT_CLASS[tone])}
          />
          <span className="font-medium text-[12px] text-fg-secondary">
            {counts[tone]}
          </span>
        </span>
      ))}
    </div>
  );
}
