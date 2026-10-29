import { Sparkles } from "lucide-react";
import type * as React from "react";
import { cn } from "@/shared/ui/utils";

export interface GenerationsLeftProps extends React.ComponentProps<"p"> {
  // Generations left today; 0 or less reads as the reached limit (warning).
  remaining: number;
}

// The daily AI budget line of the generate dialogs (Phase 8 H12): a small
// sparkle and the caller's copy ("Te quedan N generaciones hoy"), amber
// once the limit is reached.
export function GenerationsLeft({
  remaining,
  className,
  children,
  ...props
}: GenerationsLeftProps) {
  const reached = remaining <= 0;
  return (
    <p
      data-slot="generations-left"
      data-reached={reached || undefined}
      className={cn(
        "flex items-center gap-1.5 text-xs",
        reached ? "font-medium text-warning-700" : "text-fg-muted",
        className,
      )}
      {...props}
    >
      <Sparkles aria-hidden="true" size={13} strokeWidth={1.75} />
      <span>{children}</span>
    </p>
  );
}
