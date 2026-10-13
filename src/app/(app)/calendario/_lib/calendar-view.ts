import {
  addDays,
  type CalendarDayPageView,
  type DayKey,
  isDayKey,
  monthGridDays,
  monthOf,
  weekDays,
  weekdayIndex,
} from "@/modules/scheduling";
import type { TechniqueTone } from "@/shared/ui/technique-card";
import {
  MONTHS,
  MONTHS_SHORT,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
} from "./day-names";
import { TECHNIQUES } from "./today-rows";

// View models of the calendar's "Mes" and "Semana" tabs (documento-maestro
// §3.5, Phase 7 T2). Day keys are already local to the profile time zone
// (scheduling groups by it), so every label here is plain arithmetic on
// "YYYY-MM-DD" with fixed Spanish names — no Intl formatting that could
// differ between ICU versions or runtime zones.

export type CalendarViewName = "hoy" | "semana" | "mes";

const VIEWS: readonly CalendarViewName[] = ["hoy", "semana", "mes"];

// A month view shows at most three events per day; the rest go to "N más…".
const MONTH_CELL_CAP = 3;

export interface CalendarEventView {
  key: string;
  tone: TechniqueTone;
  label: string;
  meta: string;
  href: string;
  ariaLabel: string;
}

export interface CalendarCellView {
  day: DayKey;
  dayNumber: number;
  label: string;
  weekday: string;
  isToday: boolean;
  outside: boolean;
  events: CalendarEventView[];
  more?: { count: number; href: string };
}

interface NavLink {
  href: string;
  label: string;
}

export interface CalendarPeriodView {
  title: string;
  rangeLabel: string;
  nav: { prev: NavLink; today: NavLink; next: NavLink };
  cells: CalendarCellView[];
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// `?view=semana|mes` picks the tab (Hoy by default) and `?date=YYYY-MM-DD`
// the shown period (today by default); anything else falls back.
export function parseCalendarQuery(
  params: { view?: string | string[]; date?: string | string[] },
  today: DayKey,
): { view: CalendarViewName; anchor: DayKey } {
  const view = first(params.view);
  const date = first(params.date);
  return {
    view: VIEWS.find((candidate) => candidate === view) ?? "hoy",
    anchor: isDayKey(date) ? date : today,
  };
}

export function calendarHref(view: CalendarViewName, date?: DayKey): string {
  if (view === "hoy") return "/calendario";
  return date
    ? `/calendario?view=${view}&date=${date}`
    : `/calendario?view=${view}`;
}

const parts = (key: DayKey) => ({
  year: Number(key.slice(0, 4)),
  month: Number(key.slice(5, 7)) - 1,
  day: Number(key.slice(8, 10)),
});

function longDay(key: DayKey): string {
  const { month, day } = parts(key);
  return `${WEEKDAYS_LONG[weekdayIndex(key)]}, ${day} de ${MONTHS[month]}`;
}

function shortDate(key: DayKey): string {
  const { year, month, day } = parts(key);
  return `${day} ${MONTHS_SHORT[month]} ${year}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function items(count: number): string {
  return `${count} ${count === 1 ? "ítem" : "ítems"}`;
}

// One event per page and technique with items due that day, pages in
// scheduling's order, techniques in the panel's order (Flashcards,
// Recordación activa, Examen). Future items are not due yet, so an event
// opens the page, not a session.
function eventsByDay(
  days: readonly CalendarDayPageView[],
): Map<DayKey, CalendarEventView[]> {
  const byDay = new Map<DayKey, CalendarEventView[]>();
  for (const page of days) {
    const events = byDay.get(page.day) ?? [];
    for (const { kind, tone, label } of TECHNIQUES) {
      const count = page.due[kind];
      if (count === 0) continue;
      events.push({
        key: `${page.pageId}:${kind}`,
        tone,
        label: page.pageTitle,
        meta: String(count),
        href: `/notebooks/${page.notebookId}/pages/${page.pageId}`,
        ariaLabel: `${label} de ${page.pageTitle}: ${items(count)}`,
      });
    }
    byDay.set(page.day, events);
  }
  return byDay;
}

function cellOf(
  day: DayKey,
  options: {
    today: DayKey;
    outside: boolean;
    events: CalendarEventView[];
    cap?: number;
  },
): CalendarCellView {
  const { cap, events } = options;
  const shown = cap === undefined ? events : events.slice(0, cap);
  const hidden = events.length - shown.length;
  return {
    day,
    dayNumber: parts(day).day,
    label: longDay(day),
    weekday: WEEKDAYS_SHORT[weekdayIndex(day)] ?? "",
    isToday: day === options.today,
    outside: options.outside,
    events: shown,
    ...(hidden > 0 && {
      more: { count: hidden, href: calendarHref("semana", day) },
    }),
  };
}

// Days to read for the "Mes" grid: [first grid day, last grid day + 1).
export function monthRange(anchor: DayKey): { fromDay: DayKey; toDay: DayKey } {
  const grid = monthGridDays(anchor);
  return {
    fromDay: grid[0] as DayKey,
    toDay: addDays(grid.at(-1) as DayKey, 1),
  };
}

// Days to read for "Semana": Monday to the next Monday (exclusive).
export function weekRange(anchor: DayKey): { fromDay: DayKey; toDay: DayKey } {
  const days = weekDays(anchor);
  return {
    fromDay: days[0] as DayKey,
    toDay: addDays(days[6] as DayKey, 1),
  };
}

export function monthView(input: {
  anchor: DayKey;
  today: DayKey;
  days: readonly CalendarDayPageView[];
}): CalendarPeriodView {
  const { first: firstDay, days: length } = monthOf(input.anchor);
  const { year, month } = parts(firstDay);
  const lastDay = addDays(firstDay, length - 1);
  const events = eventsByDay(input.days);
  return {
    title: `${capitalize(MONTHS[month] ?? "")} ${year}`,
    rangeLabel: `${shortDate(firstDay)} – ${shortDate(lastDay)}`,
    nav: {
      prev: {
        href: calendarHref("mes", monthOf(addDays(firstDay, -1)).first),
        label: "Mes anterior",
      },
      today: { href: calendarHref("mes"), label: "Hoy" },
      next: {
        href: calendarHref("mes", addDays(lastDay, 1)),
        label: "Mes siguiente",
      },
    },
    cells: monthGridDays(input.anchor).map((day) =>
      cellOf(day, {
        today: input.today,
        outside: day.slice(0, 7) !== firstDay.slice(0, 7),
        events: events.get(day) ?? [],
        cap: MONTH_CELL_CAP,
      }),
    ),
  };
}

export function weekView(input: {
  anchor: DayKey;
  today: DayKey;
  days: readonly CalendarDayPageView[];
}): CalendarPeriodView {
  const days = weekDays(input.anchor);
  const monday = days[0] as DayKey;
  const { month, day } = parts(monday);
  const events = eventsByDay(input.days);
  return {
    title: `Semana del ${day} de ${MONTHS[month]}`,
    rangeLabel: `${shortDate(monday)} – ${shortDate(days[6] as DayKey)}`,
    nav: {
      prev: {
        href: calendarHref("semana", addDays(monday, -7)),
        label: "Semana anterior",
      },
      today: { href: calendarHref("semana"), label: "Hoy" },
      next: {
        href: calendarHref("semana", addDays(monday, 7)),
        label: "Semana siguiente",
      },
    },
    cells: days.map((key) =>
      cellOf(key, {
        today: input.today,
        outside: false,
        events: events.get(key) ?? [],
      }),
    ),
  };
}
