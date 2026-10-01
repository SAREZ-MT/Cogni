import Link from "next/link";
import { cn } from "@/shared/ui/utils";

export type DashboardRange = 7 | 15 | 30;

const RANGE_OPTIONS: readonly { value: DashboardRange; label: string }[] = [
  { value: 7, label: "7 días" },
  { value: 15, label: "15 días" },
  { value: 30, label: "30 días" },
];

export interface PeriodFilterProps {
  value: DashboardRange;
  hrefFor: (range: DashboardRange) => string;
  className?: string;
}

// Segmented 7/30/90-day control (chart spec §Widgets I). Same server-
// rendered `Link` pattern as `ViewToggle` — the choice lives in the `?range=`
// URL param, not client state, so filtering never needs its own "use
// client" boundary.
export function PeriodFilter({ value, hrefFor, className }: PeriodFilterProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 self-start rounded-input border border-border-subtle bg-neutral-100 p-1",
        className,
      )}
    >
      {RANGE_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={hrefFor(option.value)}
          aria-current={value === option.value ? "true" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium text-[12px] text-fg-muted transition-colors",
            value === option.value && "bg-card text-fg shadow-xs",
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
