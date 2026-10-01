import { cn } from "@/shared/ui/utils";

export interface StatDotItem {
  // React key for this dot+count pair (e.g. "again", "reforzar").
  key: string;
  count: number;
  // The dot's own bg color class (e.g. "bg-error-500") — generalized from a
  // fixed 4-tone lookup (design/shell-look, Active recall preview
  // 2026-09-24) so both Flashcards' again/hard/good/easy tally and Active
  // recall's 3-tone por-reforzar/regular/dominadas tally can reuse this
  // atom instead of hand-rolling the same dot+count markup twice.
  dotClassName: string;
}

export interface StatDotsProps {
  items: StatDotItem[];
  className?: string;
}

// Live session tally (Flashcards/Active recall design previews): a row of
// dot+count pairs next to the "Terminar" action, purely presentational —
// the caller owns incrementing the counts and choosing each dot's tone.
export function StatDots({ items, className }: StatDotsProps) {
  return (
    <div
      data-testid="stat-dots"
      className={cn("flex items-center gap-3", className)}
    >
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", item.dotClassName)}
          />
          <span className="font-medium text-[12px] text-fg-secondary">
            {item.count}
          </span>
        </span>
      ))}
    </div>
  );
}
