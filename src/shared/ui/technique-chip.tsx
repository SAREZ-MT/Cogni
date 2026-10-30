import Link from "next/link";
import type * as React from "react";
import type { ReactNode } from "react";
import {
  TECHNIQUE_ACCENT_CLASS,
  type TechniqueTone,
} from "@/shared/ui/technique-card";
import { cn } from "@/shared/ui/utils";

export interface TechniqueChipProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  tone: TechniqueTone;
  // The event's title (the page).
  label: ReactNode;
  // Lighter subline under the title (the page's notebook on the week grid).
  meta?: ReactNode;
  // One truncated title line (the month grid) instead of up to two.
  compact?: boolean;
  // Renders the chip as a link.
  href?: string;
  // "dot-when-narrow": inside a container narrower than 42rem (the
  // CalendarGrid frame) the chip shrinks to a dot in the technique's strong
  // hue; its label and meta stay in the DOM as screen-reader text.
  collapse?: "dot-when-narrow";
}

const COLLAPSE_CLASS =
  "@max-2xl:size-2.5 @max-2xl:shrink-0 @max-2xl:rounded-full @max-2xl:border-0 @max-2xl:p-0";

// The narrow dot takes the technique accent: the chip has no fill of its
// own. Literal classes so Tailwind generates the container variants.
const COLLAPSED_DOT_CLASS: Record<TechniqueTone, string> = {
  yellow: "@max-2xl:bg-technique-flashcards-accent",
  green: "@max-2xl:bg-technique-recall-accent",
  rose: "@max-2xl:bg-technique-exam-accent",
};

const CHIP_CLASS =
  "relative flex min-w-0 flex-col rounded-sm border border-border-default bg-card py-1.5 pr-2 pl-3.5 text-left";

// Calendar event chip (Phase 7; Phase 8 H3, user reviews 2026-10-19): an
// outlined card — thin grey border, small radius, no fill — with a 3px bar
// in the technique's accent on the left (Flashcards yellow, Recordación
// activa mint, Examen red), the page title in semibold black over an
// optional muted subline. No count: the caller's aria-label / title
// carries it.
export function TechniqueChip({
  tone,
  label,
  meta,
  compact = false,
  href,
  collapse,
  className,
  ...props
}: TechniqueChipProps) {
  const collapsed = collapse === "dot-when-narrow";
  const classes = cn(
    CHIP_CLASS,
    collapsed && cn(COLLAPSE_CLASS, COLLAPSED_DOT_CLASS[tone]),
    href &&
      "transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  const content = (
    <>
      <span
        aria-hidden="true"
        data-part="accent"
        className={cn(
          "absolute inset-y-1.5 left-1.5 w-[3px] rounded-full",
          TECHNIQUE_ACCENT_CLASS[tone],
          collapsed && "@max-2xl:hidden",
        )}
      />
      <span
        data-part="label"
        className={cn(
          "font-semibold text-fg text-xs leading-snug",
          compact ? "truncate" : "line-clamp-2 break-words",
          collapsed && "@max-2xl:sr-only",
        )}
      >
        {label}
      </span>
      {meta !== undefined && (
        <span
          data-part="meta"
          className={cn(
            "truncate font-medium text-[11px] text-fg-muted leading-snug",
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
