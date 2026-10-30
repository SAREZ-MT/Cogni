import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/utils";

export interface ReviewRowProps {
  // Pre-built leading visual (Home passes a technique-coloured IconTile).
  icon: ReactNode;
  title: string;
  // Secondary line under the title (notebook, technique). The "list"
  // layout shows none.
  meta?: ReactNode;
  // Optional status next to the action (Home: the "N pendientes" pill).
  badge?: ReactNode;
  href: string;
  actionLabel: string;
  // Full accessible name of the action link, since several rows share the
  // same visible label.
  actionAriaLabel: string;
  // "inline" (default): a bordered card, one line, button on the right.
  // "tile" (H2-T5n, Home's "Para repasar hoy"): the whole tile is one link
  // (named by `actionAriaLabel`) with a neutral border, the icon, the bold
  // title over the meta (notebook) and a chevron; `actionLabel` and the
  // badge are not shown.
  layout?: "inline" | "tile";

  className?: string;
}

const SURFACE =
  "rounded-xl border border-border-subtle bg-card shadow-xs transition-[translate,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px hover:border-border-default hover:shadow-card";

// Action row (Phase 8 H2-T5d, reference "Continue learning" row): a
// rounded bordered card with an icon, a bold title over a muted meta line,
// an optional badge and a solid near-black button on the right that goes
// straight to the action. Hover lifts the row a pixel and firms its border.
// The "tile" layout (H2-T5n) is a white list tile for Home's review column
// (reference: a course list with a round logo, bold name, a muted provider
// line and a chevron).
export function ReviewRow({
  icon,
  title,
  meta,
  badge,
  href,
  actionLabel,
  actionAriaLabel,
  layout = "inline",
  className,
}: ReviewRowProps) {
  if (layout === "tile") {
    return (
      <Link
        href={href}
        aria-label={actionAriaLabel}
        data-slot="review-row"
        data-layout="tile"
        className={cn(
          "group/row flex items-center gap-3.5 rounded-2xl border border-border-subtle bg-card py-3 pr-4 pl-3.5 no-underline shadow-xs outline-none transition-[translate,border-color,box-shadow] duration-200 ease-out hover:-translate-y-px hover:border-border-default hover:shadow-card focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        {icon}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 break-words font-semibold text-[13.5px] text-fg leading-snug">
            {title}
          </span>
          {meta ? (
            <span className="truncate text-[12px] text-fg-muted">{meta}</span>
          ) : null}
        </span>
        <ChevronRight
          aria-hidden="true"
          size={18}
          strokeWidth={1.75}
          className="shrink-0 text-fg-secondary transition-transform duration-200 ease-out group-hover/row:translate-x-0.5"
        />
      </Link>
    );
  }
  return (
    <div
      data-slot="review-row"
      data-layout="inline"
      className={cn("flex items-center gap-3.5 px-4 py-3", SURFACE, className)}
    >
      {icon}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate font-semibold text-[15px] text-fg">{title}</p>
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-fg-secondary">
          {meta}
        </div>
      </div>
      {badge}
      <Button asChild className="h-9 rounded-input px-4 text-[13px]">
        <Link href={href} aria-label={actionAriaLabel}>
          {actionLabel}
        </Link>
      </Button>
    </div>
  );
}
