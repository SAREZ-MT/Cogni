import { cn } from "@/shared/ui/utils";

export interface DotStreakProps {
  // One entry per day in the window (chart spec §Widgets E: 14 dots; the
  // dashboard passes the last days of the selected period, at most 14),
  // oldest first — `true` means "studied that day".
  days: readonly boolean[];
  streakDays: number;
  toneClassName?: string;
  className?: string;
}

// Per-technique streak row (chart spec §Widgets E "DotStreak 14 dots +
// racha count"): a compact row of filled/empty dots plus the "Racha · N
// días" caption. `toneClassName` lets each technique card use its own
// accent (violet/green/rose) for the filled dots.
export function DotStreak({
  days,
  streakDays,
  toneClassName = "bg-primary-600",
  className,
}: DotStreakProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        role="img"
        aria-label={`${days.filter(Boolean).length} de ${days.length} días con repasos`}
        className="flex items-center gap-[3px]"
      >
        {days.map((studied, index) => (
          <span
            // Positional window of days, index is stable across renders.
            key={`${index}-${studied}`}
            aria-hidden="true"
            className={cn(
              "size-[7px] rounded-full",
              studied ? toneClassName : "bg-neutral-200",
            )}
          />
        ))}
      </div>
      <span className="font-medium text-[11.5px] text-fg-secondary">
        Racha · {streakDays} día{streakDays === 1 ? "" : "s"}
      </span>
    </div>
  );
}
