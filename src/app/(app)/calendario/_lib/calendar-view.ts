import type { DailyReviews } from "@/modules/analytics";
import {
  addDays,
  type CalendarDayPageView,
  type DayKey,
  type DueKind,
  isCalendarDay,
  monthGridDays,
  monthOf,
  weekDays,
  weekdayIndex,
} from "@/modules/scheduling";
import type { TechniqueTone } from "@/shared/ui/technique-card";
import { MONTHS, WEEKDAYS_LONG, WEEKDAYS_SHORT } from "./day-names";
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
// The month panel's "Próximos repasos" covers the seven days after the
// selected one.
const NEXT_DAYS = 7;

export interface CalendarEventView {
  key: string;
  tone: TechniqueTone;
  techniqueLabel: string;
  // Page title; `meta` is its notebook (the week chip's subline).
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
  // Mes only (Phase 8 H3): an in-month day links to its selection, and the
  // selected day is marked.
  selectHref?: string;
  isSelected?: boolean;
}

export interface NavLink {
  href: string;
  label: string;
  // "Día anterior" on today: Hoy never goes back in time.
  disabled?: true;
}

// Bare prev / next arrows (Phase 8 H3): the view tabs return to the current
// period, so there is no middle button.
export interface CalendarNavView {
  prev: NavLink;
  next: NavLink;
}

export interface CalendarPeriodView {
  // The period, said once (Phase 8 H3): "Octubre 2026", "19 – 25 de
  // octubre".
  title: string;
  nav: CalendarNavView;
  cells: CalendarCellView[];
  // The day the header's date badge shows: today when it is in the shown
  // period, else the period's first day (the week's Monday, the 1st).
  badgeDay: DayKey;
  // Small line over the title ("Semana 4"); Semana only.
  overline?: string;
}

// One review card of the month's right panel: the selected day's reviews
// and the next seven days', one page × technique each.
export interface PanelReviewView {
  key: string;
  tone: TechniqueTone;
  techniqueLabel: string;
  // Page title over its notebook.
  title: string;
  detail: string;
  href: string;
  ariaLabel: string;
}

export interface MonthPeriodView extends CalendarPeriodView {
  // The selected day (in the shown month): the `date` of the URL.
  selected: DayKey;
}

export interface MonthDayPanelView {
  // "Martes 20 de octubre".
  title: string;
  // "2 repasos programados", "1 repaso programado", "Sin repasos".
  summary: string;
  rows: PanelReviewView[];
  // The seven days after the selected one, flat, in calendar order.
  upcoming: PanelReviewView[];
}

// One technique of the "Progreso de la semana" card, in study ITEMS.
export interface TechniqueProgressView {
  tone: TechniqueTone;
  label: string;
  done: number;
  total: number;
  percent: number;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// `?view=semana|mes` picks the tab (Hoy by default) and `?date=YYYY-MM-DD`
// the shown period (today by default); anything else falls back, including
// days outside the calendar window (1970-01-01 … 9998-12-31), whose grids
// would overflow four-digit years. The window's edge months still render;
// their outward navigation link lands on an out-of-window date and so
// falls back to today.
export function parseCalendarQuery(
  params: { view?: string | string[]; date?: string | string[] },
  today: DayKey,
): { view: CalendarViewName; anchor: DayKey } {
  const view = first(params.view);
  const date = first(params.date);
  const viewName = VIEWS.find((candidate) => candidate === view) ?? "hoy";
  return {
    view: viewName,
    anchor: isCalendarDay(date) ? clampAnchor(viewName, date, today) : today,
  };
}

// Hoy only looks ahead: there is no per-page history read, so a past day
// in its URL reads as today. Mes and Semana browse both ways.
function clampAnchor(
  view: CalendarViewName,
  date: DayKey,
  today: DayKey,
): DayKey {
  return view === "hoy" && date < today ? today : date;
}

export function calendarHref(view: CalendarViewName, date?: DayKey): string {
  if (view === "hoy") return date ? `/calendario?date=${date}` : "/calendario";
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
        techniqueLabel: label,
        label: page.pageTitle,
        meta: page.notebookTitle,
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

// The day a month opens on: today when it is in that month, else its 1st.
function monthDefaultDay(first: DayKey, today: DayKey): DayKey {
  return today.slice(0, 7) === first.slice(0, 7) ? today : first;
}

// A day of the month starting on `first`: the day itself when it is in
// that month, else the month's default (today if it is in it, else the 1st).
export function monthDay(first: DayKey, day: DayKey, today: DayKey): DayKey {
  return day.slice(0, 7) === first.slice(0, 7)
    ? day
    : monthDefaultDay(first, today);
}

// "Mes" (Phase 8 H3): the grid of the anchor's month with the anchor as
// the selected day — the URL's `date` both picks the month and the day.
// Every in-month day links to its own selection; the arrows land on the
// neighbouring month's default day.
export function monthView(input: {
  anchor: DayKey;
  today: DayKey;
  days: readonly CalendarDayPageView[];
}): MonthPeriodView {
  const { first: firstDay, days: length } = monthOf(input.anchor);
  const { year, month } = parts(firstDay);
  const lastDay = addDays(firstDay, length - 1);
  const events = eventsByDay(input.days);
  const selected = monthDay(firstDay, input.anchor, input.today);
  const prevFirst = monthOf(addDays(firstDay, -1)).first;
  const nextFirst = addDays(lastDay, 1);
  return {
    title: `${capitalize(MONTHS[month] ?? "")} ${year}`,
    selected,
    badgeDay: selected,
    nav: {
      prev: {
        href: calendarHref("mes", monthDefaultDay(prevFirst, input.today)),
        label: "Mes anterior",
      },
      next: {
        href: calendarHref("mes", monthDefaultDay(nextFirst, input.today)),
        label: "Mes siguiente",
      },
    },
    cells: monthGridDays(input.anchor).map((day) => {
      const outside = day.slice(0, 7) !== firstDay.slice(0, 7);
      return {
        ...cellOf(day, {
          today: input.today,
          outside,
          events: events.get(day) ?? [],
          cap: MONTH_CELL_CAP,
        }),
        ...(!outside && {
          selectHref: calendarHref("mes", day),
          isSelected: day === selected,
        }),
      };
    }),
  };
}

// Days to read for the month panel's "Próximos repasos": the seven days
// after the selected one, end exclusive (it may cross into the next month).
export function nextSevenDays(selected: DayKey): {
  fromDay: DayKey;
  toDay: DayKey;
} {
  return {
    fromDay: addDays(selected, 1),
    toDay: addDays(selected, NEXT_DAYS + 1),
  };
}

function panelRowsOf(
  days: readonly CalendarDayPageView[],
  from: DayKey,
  to: DayKey,
): PanelReviewView[] {
  const events = eventsByDay(days);
  const rows: PanelReviewView[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    for (const event of events.get(day) ?? []) {
      rows.push({
        key: `${day}:${event.key}`,
        tone: event.tone,
        techniqueLabel: event.techniqueLabel,
        title: event.label,
        detail: event.meta,
        href: event.href,
        ariaLabel: event.ariaLabel,
      });
    }
  }
  return rows;
}

// The month's right panel (Phase 8 H3, approved mockup 2026-10-19): the
// selected day by name with its reviews (from the grid's read: today's
// already fold the overdue items in), then the reviews of the seven days
// after it (from their own read), flat and in calendar order.
export function monthDayPanel(input: {
  selected: DayKey;
  days: readonly CalendarDayPageView[];
  window: readonly CalendarDayPageView[];
}): MonthDayPanelView {
  const { selected } = input;
  const { day, month } = parts(selected);
  const rows = panelRowsOf(input.days, selected, selected);
  return {
    title: `${capitalize(WEEKDAYS_LONG[weekdayIndex(selected)] ?? "")} ${day} de ${MONTHS[month]}`,
    summary:
      rows.length === 0
        ? "Sin repasos"
        : rows.length === 1
          ? "1 repaso programado"
          : `${rows.length} repasos programados`,
    rows,
    upcoming: panelRowsOf(
      input.window,
      addDays(selected, 1),
      addDays(selected, NEXT_DAYS),
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
  const events = eventsByDay(input.days);
  return {
    title: weekTitle(monday, days[6] as DayKey, parts(input.today).year),
    overline: `Semana ${weekOfMonth(monday).week}`,
    badgeDay: days.includes(input.today) ? input.today : monday,
    nav: {
      prev: {
        href: calendarHref("semana", addDays(monday, -7)),
        label: "Semana anterior",
      },
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

// "19 – 25 de octubre", "28 de septiembre – 4 de octubre"; the year only
// when the week is not in the current year ("4 – 10 de enero de 2027"),
// on both ends when the week spans two years.
function weekTitle(from: DayKey, to: DayKey, currentYear: number): string {
  const start = parts(from);
  const end = parts(to);
  if (start.year !== end.year) {
    return `${start.day} de ${MONTHS[start.month]} de ${start.year} – ${end.day} de ${MONTHS[end.month]} de ${end.year}`;
  }
  const year = end.year === currentYear ? "" : ` de ${end.year}`;
  return start.month === end.month
    ? `${start.day} – ${end.day} de ${MONTHS[end.month]}${year}`
    : `${start.day} de ${MONTHS[start.month]} – ${end.day} de ${MONTHS[end.month]}${year}`;
}

// "Hoy" header (Phase 8 H3-T4 day navigation): today is "Hoy"; a later
// day is named in full ("Martes 20 de octubre"). Hoy never goes back
// before today, so "Día anterior" is inactive there.
export function dayView(input: { anchor: DayKey; today: DayKey }): {
  title: string;
  isToday: boolean;
  nav: CalendarNavView;
  badgeDay: DayKey;
} {
  const { anchor, today } = input;
  const isToday = anchor === today;
  const { month, day } = parts(anchor);
  const dayHref = (key: DayKey) =>
    key === today ? calendarHref("hoy") : calendarHref("hoy", key);
  return {
    title: isToday
      ? "Hoy"
      : `${capitalize(WEEKDAYS_LONG[weekdayIndex(anchor)] ?? "")} ${day} de ${MONTHS[month]}`,
    isToday,
    nav: {
      prev: {
        href: dayHref(addDays(anchor, -1)),
        label: "Día anterior",
        ...(isToday && { disabled: true }),
      },
      next: { href: dayHref(addDays(anchor, 1)), label: "Día siguiente" },
    },
    badgeDay: anchor,
  };
}

// Analytics' technique key for each scheduling kind.
const REVIEW_KEY: Record<DueKind, keyof DailyReviews["reviews"]> = {
  flashcard: "flashcards",
  recall_question: "recall",
  exam_question: "exam",
};

// "Progreso de la semana" per technique, counted in study ITEMS on both
// sides so the ratio is consistent: done = completed reviews (one review
// = one item answered) of the shown week from analytics' daily series;
// pending = items still due on the week's days from the calendar read
// (overdue items already fold into today). total = done + pending. All three
// techniques, in the panel's order (one ring each); null when the reviews
// could not be read.
export function weekTechniqueProgress(input: {
  days: readonly CalendarDayPageView[];
  daily: readonly DailyReviews[] | null;
}): TechniqueProgressView[] | null {
  const { daily } = input;
  if (daily === null) return null;
  return TECHNIQUES.map(({ kind, tone, label }) => {
    const done = daily.reduce(
      (sum, entry) => sum + entry.reviews[REVIEW_KEY[kind]],
      0,
    );
    const pending = input.days.reduce((sum, page) => sum + page.due[kind], 0);
    const total = done + pending;
    return {
      tone,
      label,
      done,
      total,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  });
}

// Week of the month for the "Semana X" overline (Phase 8 H3): a Monday-first
// week belongs to the month holding its Thursday (ISO-style, so a week that
// spans two months is unambiguous), and X counts that month's week rows:
// the Thursday's day of month, in sevens.
export function weekOfMonth(monday: DayKey): { month: string; week: number } {
  const thursday = addDays(monday, 3);
  return {
    month: thursday.slice(0, 7),
    week: Math.floor((parts(thursday).day - 1) / 7) + 1,
  };
}
