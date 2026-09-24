import type * as React from "react";
import { cn } from "@/shared/ui/utils";

interface ProgressBarProps extends React.ComponentProps<"div"> {
  // A real ratio (0-100); clamped the same way StatCard used to clamp it
  // inline.
  value: number;
  // Overrides the fill (e.g. "gradient-streak" for the two-week streak
  // card once it's at least half full) instead of the default solid
  // violet.
  fillClassName?: string;
}

// Design-system progress bar (figma-make-design-system.md ProgressSection
// "Bar"): a thin rounded-pill track with a colored fill, used by StatCard's
// optional metric progress. `data-slot`s are unchanged from the inline
// version so existing `[data-slot="progress-bar"]`/`[data-slot="progress-
// fill"]` test queries keep working untouched.
function ProgressBar({
  value,
  fillClassName,
  className,
  ...props
}: ProgressBarProps) {
  return (
    <div
      data-slot="progress-bar"
      className={cn(
        "h-[5px] overflow-hidden rounded-pill bg-neutral-200/60",
        className,
      )}
      {...props}
    >
      <div
        data-slot="progress-fill"
        className={cn("h-full rounded-pill bg-primary-500", fillClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export { ProgressBar };
