import { CalendarDayCell, CalendarGrid } from "@/shared/ui/calendar-grid";
import { TechniqueChip } from "@/shared/ui/technique-chip";
import type { CalendarPeriodView } from "../_lib/calendar-view";
import { WEEKDAYS_SHORT } from "../_lib/day-names";

export interface CalendarPeriodProps {
  view: CalendarPeriodView;
  // month: capped cells whose chips collapse to dots in a narrow grid;
  // week: the days stack in a narrow grid and keep whole chips.
  variant: "month" | "week";
}

// Body of the calendar's "Mes" and "Semana" tabs (documento-maestro §3.5):
// the day grid with one technique-coloured chip per page and technique due
// that day — page title, item count — opening the page.
export function CalendarPeriod({ view, variant }: CalendarPeriodProps) {
  const week = variant === "week";
  return (
    <CalendarGrid
      aria-label={view.title}
      weekdays={WEEKDAYS_SHORT}
      stackWhenNarrow={week}
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
          className={week ? "@2xl:min-h-[320px]" : undefined}
        >
          {cell.events.map((event) => (
            <TechniqueChip
              key={event.key}
              tone={event.tone}
              label={event.label}
              meta={event.meta}
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
}
