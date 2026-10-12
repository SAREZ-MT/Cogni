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
}

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
  className,
  ...props
}: TechniqueChipProps) {
  const classes = cn(
    CHIP_CLASS,
    TECHNIQUE_PAIR_CLASS[tone],
    href &&
      "transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  const content = (
    <>
      <span className="truncate">{label}</span>
      {meta !== undefined && (
        <span
          data-part="meta"
          className="shrink-0 font-medium tabular-nums opacity-80"
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
      className={classes}
      {...props}
    >
      {content}
    </span>
  );
}
