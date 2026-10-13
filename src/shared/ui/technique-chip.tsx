import Link from "next/link";
import type * as React from "react";
import type { ReactNode } from "react";
import {
  TECHNIQUE_PAIR_CLASS,
  type TechniqueTone,
} from "@/shared/ui/technique-card";
import { cn } from "@/shared/ui/utils";

export interface TechniqueChipProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  tone: TechniqueTone;
  label: ReactNode;
  // Trailing, lighter detail: a due count on "Hoy", a time or count on the
  // month/week grid.
  meta?: ReactNode;
  // Renders the chip as a link (opens that technique's session).
  href?: string;
  // "dot-when-narrow": inside a container narrower than 42rem (the
  // CalendarGrid frame) the chip shrinks to a dot in the technique's strong
  // hue; its label and meta stay in the DOM as screen-reader text.
  collapse?: "dot-when-narrow";
}

const COLLAPSE_CLASS =
  "@max-2xl:size-2.5 @max-2xl:shrink-0 @max-2xl:gap-0 @max-2xl:rounded-full @max-2xl:border-0 @max-2xl:bg-current @max-2xl:p-0";

const CHIP_CLASS =
  "inline-flex min-w-0 items-center justify-between gap-2 rounded-md border border-current/15 px-2 py-1 font-semibold text-xs";

// Calendar event chip (Phase 7, calendar look decision 2026-10-12; Untitled
// UI month calendar event): pastel background + stronger text of the same
// hue, coloured by its technique with the techniques panel's pairs —
// Flashcards yellow, Recordación activa green, Examen rose. Used by the
// "Hoy" tab rows and, from T2, the month/week grid events.
export function TechniqueChip({
  tone,
  label,
  meta,
  href,
  collapse,
  className,
  ...props
}: TechniqueChipProps) {
  const collapsed = collapse === "dot-when-narrow";
  const classes = cn(
    CHIP_CLASS,
    TECHNIQUE_PAIR_CLASS[tone],
    collapsed && COLLAPSE_CLASS,
    href &&
      "transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  const content = (
    <>
      <span
        data-part="label"
        className={cn("truncate", collapsed && "@max-2xl:sr-only")}
      >
        {label}
      </span>
      {meta !== undefined && (
        <span
          data-part="meta"
          className={cn(
            "shrink-0 font-medium tabular-nums opacity-80",
            collapsed && "@max-2xl:sr-only",
          )}
        >
          {meta}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        data-slot="technique-chip"
        data-tone={tone}
        data-collapse={collapse}
        className={classes}
        {...props}
      >
        {content}
      </Link>
    );
  }
  return (
    <span
      data-slot="technique-chip"
      data-tone={tone}
      data-collapse={collapse}
      className={classes}
      {...props}
    >
      {content}
    </span>
  );
}
