import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/shared/ui/utils";

interface NavLink {
  href: string;
  label: string;
}

export interface CalendarNavProps {
  "aria-label": string;
  prev: NavLink;
  today: NavLink;
  next: NavLink;
  className?: string;
}

const ITEM_CLASS =
  "inline-flex h-9 items-center justify-center text-fg-secondary transition-colors hover:bg-neutral-50 hover:text-fg focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Calendar period navigation (Phase 7 T2, the Untitled UI month calendar's
// "← | Today | →" button group): one bordered group of three
// server-rendered links, so the shown period lives in the URL. The arrows
// carry their label as accessible name; "Hoy" is visible text.
export function CalendarNav({
  "aria-label": ariaLabel,
  prev,
  today,
  next,
  className,
}: CalendarNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      data-slot="calendar-nav"
      className={cn(
        "inline-flex shrink-0 divide-x divide-border-default overflow-hidden rounded-input border border-border-default bg-card shadow-xs",
        className,
      )}
    >
      <Link
        href={prev.href}
        aria-label={prev.label}
        className={cn(ITEM_CLASS, "w-10")}
      >
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
      </Link>
      <Link
        href={today.href}
        className={cn(ITEM_CLASS, "px-4 font-semibold text-[13px] text-fg")}
      >
        {today.label}
      </Link>
      <Link
        href={next.href}
        aria-label={next.label}
        className={cn(ITEM_CLASS, "w-10")}
      >
        <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
      </Link>
    </nav>
  );
}
