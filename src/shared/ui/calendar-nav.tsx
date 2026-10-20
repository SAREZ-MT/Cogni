import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

interface NavLink {
  href: string;
  label: string;
  // Inert and dimmed: a direction that is closed ("Día anterior" on today).
  disabled?: boolean;
}

export interface CalendarNavProps {
  "aria-label": string;
  prev: NavLink;
  next: NavLink;
  className?: string;
}

const ITEM_CLASS =
  "inline-flex size-8 items-center justify-center rounded-full text-fg-muted";
const ACTIVE_CLASS =
  "transition-colors hover:bg-neutral-100 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const DISABLED_CLASS = "cursor-not-allowed opacity-35";

function Arrow({ link, children }: { link: NavLink; children: ReactNode }) {
  if (link.disabled) {
    // Inert: no href, not focusable; the name stays as screen-reader text.
    return (
      <span aria-disabled="true" className={cn(ITEM_CLASS, DISABLED_CLASS)}>
        {children}
        <span className="sr-only">{link.label}</span>
      </span>
    );
  }
  return (
    <Link
      href={link.href}
      aria-label={link.label}
      className={cn(ITEM_CLASS, ACTIVE_CLASS)}
    >
      {children}
    </Link>
  );
}

// Calendar period navigation (Phase 7 T2; Phase 8 H3, user reference
// 2026-10-19): two bare muted chevrons — no container, no middle button
// (the view tabs return to the current period) — that darken on hover over
// a faint round wash. Server-rendered links, so the shown period lives in
// the URL; each carries its label as accessible name. A closed direction
// ("Día anterior" on today) is an inert, dimmed span with `aria-disabled`.
export function CalendarNav({
  "aria-label": ariaLabel,
  prev,
  next,
  className,
}: CalendarNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      data-slot="calendar-nav"
      className={cn("inline-flex shrink-0 items-center gap-1", className)}
    >
      <Arrow link={prev}>
        <ChevronLeft aria-hidden="true" size={20} strokeWidth={2} />
      </Arrow>
      <Arrow link={next}>
        <ChevronRight aria-hidden="true" size={20} strokeWidth={2} />
      </Arrow>
    </nav>
  );
}
