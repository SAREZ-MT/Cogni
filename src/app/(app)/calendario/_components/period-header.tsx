import type { ReactNode } from "react";
import { CalendarNav } from "@/shared/ui/calendar-nav";
import type { CalendarNavView } from "../_lib/calendar-view";

export interface PeriodHeaderProps {
  // Small line over the title ("Semana 4"); Semana only.
  overline?: string;
  // The shown period, said once: "Hoy", "Martes 20 de octubre", "19 – 25 de
  // octubre", "Octubre 2026".
  title: string;
  // Hoy only: the long date and the day's summary, a muted suffix.
  subtitle?: ReactNode;
  nav: CalendarNavView;
  navLabel: string;
}

// The calendar's period block, on the view tabs' row (Phase 8 H3, user
// reviews 2026-10-19): one line — the period title, an optional muted
// suffix and the two bare prev / next arrows — vertically centred on the
// tabs. The "Semana X" overline hangs above that line (absolutely
// positioned, so it never moves the line off the tabs' centre). The view
// tabs return to the current period, so there is no "today" button.
export function PeriodHeader({
  overline,
  title,
  subtitle,
  nav,
  navLabel,
}: PeriodHeaderProps) {
  return (
    <div data-testid="calendar-period" className="relative min-w-0">
      {overline && (
        <p
          data-part="overline"
          className="absolute bottom-full left-0 mb-0.5 font-semibold text-[11px] text-primary-600 uppercase leading-none tracking-wide"
        >
          {overline}
        </p>
      )}
      <div
        data-part="line"
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
      >
        <div className="flex min-w-0 items-baseline gap-x-2">
          <h2 className="shrink-0 font-semibold text-fg text-lg leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="min-w-0 truncate text-[13px] text-fg-muted">
              {subtitle}
            </p>
          )}
        </div>
        <CalendarNav aria-label={navLabel} prev={nav.prev} next={nav.next} />
      </div>
    </div>
  );
}
