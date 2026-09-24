import { cn } from "@/shared/ui/utils";

interface StreakDotsProps {
  days: readonly boolean[];
}

// "Índice de constancia" stat card (Home study-metrics decisions): a row of
// 14 tiny dots, oldest (left) to today (right) — active days in success
// green, inactive days neutral.
export function StreakDots({ days }: StreakDotsProps) {
  return (
    <div className="mt-2.5 flex gap-[3px]" aria-hidden="true">
      {days.map((active, index) => (
        <span
          key={`${index}-${active}`}
          className={cn(
            "h-1.5 flex-1 rounded-pill",
            active ? "bg-success-500" : "bg-neutral-200",
          )}
        />
      ))}
    </div>
  );
}
