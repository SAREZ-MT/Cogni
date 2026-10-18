import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export interface PageLinkCardProps {
  href: string;
  title: string;
  // Secondary line under the title (Home: notebook colour dot + name).
  // Optional small header above the title (Home's cards show none since
  // H2-T5s, so the title sits at the top).
  meta?: ReactNode;
  // Optional muted label on the right (Home: "Editada hace 2h").
  trailing?: ReactNode;
  // Optional decorative layer behind the content (Home: the forgetting
  // curve, H2-T5r). Rendered aria-hidden.
  backdrop?: ReactNode;
  // Full accessible name of the link (page and notebook), since the
  // visible text is split across lines.
  ariaLabel: string;
  // Extra classes for the title (Home nudges it right to clear the
  // forgetting curve's start, H2-T5s).
  titleClassName?: string;
  className?: string;
}

// Page link card (Phase 8 H2-T5h, "Continúa donde lo dejaste"; restyled in
// H2-T5q after kokonutui's "Widget Grid" cards, no icons): the whole card
// is one link. A small meta header (the notebook), the page title larger
// below it, and the trailing label pinned to the bottom-right corner. On
// hover it lifts with a soft layered shadow and firms its border.
export function PageLinkCard({
  href,
  title,
  meta,
  trailing,
  backdrop,
  ariaLabel,
  titleClassName,
  className,
}: PageLinkCardProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      data-slot="page-link-card"
      className={cn(
        "relative isolate flex min-h-[96px] flex-col overflow-hidden rounded-2xl border border-border-subtle bg-card p-4 pt-3 shadow-xs outline-none transition-[translate,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-border-default hover:shadow-[0_18px_36px_-16px_rgb(0_0_0/0.16),0_6px_12px_-8px_rgb(0_0_0/0.08)] focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {backdrop !== undefined && (
        <span
          aria-hidden="true"
          data-part="backdrop"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          {backdrop}
        </span>
      )}
      {meta !== undefined && (
        <span
          data-part="meta"
          className="flex h-7 min-w-0 items-center text-[12px] text-fg-secondary"
        >
          {meta}
        </span>
      )}
      <span
        className={cn(
          meta !== undefined ? "mt-1" : "pt-1",
          "line-clamp-2 break-words font-semibold text-[15px] text-fg leading-snug tracking-[-0.01em]",
          titleClassName,
        )}
      >
        {title}
      </span>
      {trailing !== undefined && (
        <span
          data-part="trailing"
          className="mt-auto self-end pt-2 text-[11px] text-fg-muted tabular-nums"
        >
          {trailing}
        </span>
      )}
    </Link>
  );
}
