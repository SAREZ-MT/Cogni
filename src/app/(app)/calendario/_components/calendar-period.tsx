import type { ReactNode } from "react";
import { CalendarDayCell, CalendarGrid } from "@/shared/ui/calendar-grid";
import { TechniqueChip } from "@/shared/ui/technique-chip";
import type { CalendarPeriodView } from "../_lib/calendar-view";
import { WEEKDAYS_SHORT } from "../_lib/day-names";

export interface CalendarPeriodProps {
  view: CalendarPeriodView;
  // month: capped cells whose one-line chips collapse to dots in a narrow
  // grid; week: day numbers in the weekday header ("Lun 19"), two-line chips
  // with the notebook, and the days stack in a narrow grid.
  variant: "month" | "week";
  // Month only: the selected day's panel beside the grid (when the card is
  // 64rem wide; under it otherwise).
  aside?: ReactNode;
}

// Body of the calendar's "Mes" and "Semana" tabs (documento-maestro §3.5,
// Phase 8 H3): the day grid with one technique-coloured chip per page and
// technique due that day — the page title, opening the page; the count
// stays in its accessible name.
export function CalendarPeriod({ view, variant, aside }: CalendarPeriodProps) {
  const week = variant === "week";
  const grid = (
    <CalendarGrid
      aria-label={view.title}
      weekdays={WEEKDAYS_SHORT}
      weekdayNumbers={
        week
          ? view.cells.map((cell) => ({
              dayNumber: cell.dayNumber,
              isToday: cell.isToday,
            }))
          : undefined
      }
      stackWhenNarrow={week}
      fill={week}
    >
      {view.cells.map((cell) => (
        <CalendarDayCell
          key={cell.day}
          day={cell.day}
          dayNumber={cell.dayNumber}
          label={cell.label}
          weekday={week ? cell.weekday : undefined}
          isToday={cell.isToday}
          outside={cell.outside}
          more={cell.more}
          variant={week ? "week" : "month"}
          selectHref={cell.selectHref}
          isSelected={cell.isSelected}
          className={week ? "@2xl:min-h-[240px]" : undefined}
        >
          {cell.events.map((event) => (
            <TechniqueChip
              key={event.key}
              tone={event.tone}
              label={event.label}
              meta={week ? event.meta : undefined}
              compact={!week}
              href={event.href}
              aria-label={event.ariaLabel}
              title={event.ariaLabel}
              collapse={week ? undefined : "dot-when-narrow"}
              className={week ? "w-full" : "@2xl:w-full"}
            />
          ))}
        </CalendarDayCell>
      ))}
    </CalendarGrid>
  );
  if (aside == null) return grid;
  return (
    // Beside the grid only when the card body is at least 64rem wide (a
    // container query, not the viewport: with the sidebar open a 1280px
    // screen would squeeze the grid under 42rem and collapse its chips).
    <div className="@container/period">
      <div className="grid grid-cols-1 @5xl/period:grid-cols-[minmax(0,1fr)_320px]">
        {grid}
        <div
          data-part="aside"
          className="min-w-0 border-border-subtle border-t px-4 py-5 md:px-6 @5xl/period:border-t-0 @5xl/period:border-l @5xl/period:px-5"
        >
          {aside}
        </div>
      </div>
    </div>
  );
}
