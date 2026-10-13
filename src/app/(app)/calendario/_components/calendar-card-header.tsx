import type { ReactNode } from "react";
import { CalendarNav } from "@/shared/ui/calendar-nav";
import { DateBadge } from "@/shared/ui/date-badge";

interface NavLink {
  href: string;
  label: string;
}

export interface CalendarCardHeaderProps {
  now: Date;
  // Profile time zone today's badge is read in.
  timeZone: string;
  title: string;
  subtitle: ReactNode;
  nav?: { prev: NavLink; today: NavLink; next: NavLink };
  navLabel?: string;
}

// Calendar card header (Untitled UI month calendar): today's date badge,
// the period title over its range or summary, and — for Mes / Semana — the
// prev / Hoy / next navigation on the right (wrapping below on phones).
export function CalendarCardHeader({
  now,
  timeZone,
  title,
  subtitle,
  nav,
  navLabel = "Navegar el calendario",
}: CalendarCardHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-border-subtle border-b px-4 py-4 md:px-6 md:py-5">
      <DateBadge date={now} timeZone={timeZone} />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-fg text-lg leading-tight">{title}</h2>
        <p className="mt-0.5 text-fg-muted text-sm">{subtitle}</p>
      </div>
      {nav && (
        <CalendarNav
          aria-label={navLabel}
          prev={nav.prev}
          today={nav.today}
          next={nav.next}
        />
      )}
    </div>
  );
}
