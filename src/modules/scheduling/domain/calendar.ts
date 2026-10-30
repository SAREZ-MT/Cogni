import { type DueCounts, type DueKind, emptyDueCounts } from "./due-today";

// Calendar read model (documento-maestro §3.5, Phase 7 T2): "Mes" and
// "Semana" show, per local day, the pages whose study items have their next
// due date that day, with counts per technique. Only the next due_at of each
// item is shown (no projection of later repetitions); an overdue item is
// still pending, so it is shown on today.

// A calendar day as an ISO date, "YYYY-MM-DD". Day arithmetic runs on UTC
// midnights so it never depends on the runtime zone or on DST.
export type DayKey = string;

const DAY_MS = 86_400_000;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcMidnight(key: DayKey): number {
  const [year, month, day] = key.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return Date.UTC(year, month - 1, day);
}

// Throws rather than return a malformed key: past year 9999 (or before
// 0000) toISOString switches to expanded years ("+010000-01-01"), which
// would leak into labels, hrefs and range checks.
function keyOfUtc(ms: number): DayKey {
  const date = new Date(ms);
  const key = Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, 10);
  if (!DAY_KEY.test(key)) {
    throw new RangeError(`day outside four-digit years: ${ms}`);
  }
  return key;
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string" || !DAY_KEY.test(value)) return false;
  // Round-trip rejects impossible dates such as 2026-02-30. A shape-valid
  // key that rolls over past year 9999 (9999-12-32) makes keyOfUtc throw;
  // it is not a day either.
  try {
    return keyOfUtc(utcMidnight(value)) === value;
  } catch {
    return false;
  }
}

// The days the calendar accepts as an anchor or a range bound. Every grid
// and range around them (six weeks at most, padded by a day) stays within
// four-digit years: the last full year before 9999 leaves room for the
// month grid's trailing week and the action's 42-day range. The epoch is
// the floor; no study item can be due before it.
export const FIRST_CALENDAR_DAY: DayKey = "1970-01-01";
export const LAST_CALENDAR_DAY: DayKey = "9998-12-31";

export function isCalendarDay(value: unknown): value is DayKey {
  return (
    isDayKey(value) && value >= FIRST_CALENDAR_DAY && value <= LAST_CALENDAR_DAY
  );
}

// True for a zone Intl can format in (the profile stores ICU's canonical
// IANA spelling; this only guards untrusted Server Action input).
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function addDays(key: DayKey, days: number): DayKey {
  return keyOfUtc(utcMidnight(key) + days * DAY_MS);
}

// 0 = Monday … 6 = Sunday: the calendar weeks start on Monday.
export function weekdayIndex(key: DayKey): number {
  return (new Date(utcMidnight(key)).getUTCDay() + 6) % 7;
}

// Monday to Sunday of the week holding `key` ("Semana").
export function weekDays(key: DayKey): DayKey[] {
  const monday = addDays(key, -weekdayIndex(key));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

// First day and length of the month holding `key`.
export function monthOf(key: DayKey): { first: DayKey; days: number } {
  const first = `${key.slice(0, 7)}-01`;
  const date = new Date(utcMidnight(first));
  const days = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return { first, days };
}

// The "Mes" grid: whole Monday-first weeks covering the month holding `key`
// (4 to 6 weeks), outside-month days included.
export function monthGridDays(key: DayKey): DayKey[] {
  const { first, days } = monthOf(key);
  const start = addDays(first, -weekdayIndex(first));
  const last = addDays(first, days - 1);
  const end = addDays(last, 6 - weekdayIndex(last));
  const length = (utcMidnight(end) - utcMidnight(start)) / DAY_MS + 1;
  return Array.from({ length }, (_, index) => addDays(start, index));
}

// Formats instants as day keys in one zone. Numeric parts only, so the
// result does not depend on the ICU version's locale data.
export function dayKeyFormatter(timeZone: string): (instant: Date) => DayKey {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (instant) => {
    const parts: Record<string, string> = {};
    for (const part of format.formatToParts(instant)) {
      parts[part.type] = part.value;
    }
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
}

export function dayKeyIn(instant: Date, timeZone: string): DayKey {
  return dayKeyFormatter(timeZone)(instant);
}

// Offset of `timeZone` from UTC at `instant`, in ms (east positive), read
// from Intl's wall-clock parts at second precision.
function zoneOffsetMs(instant: number, timeZone: string): number {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const part of format.formatToParts(new Date(instant))) {
    parts[part.type] = Number(part.value);
  }
  const wall = Date.UTC(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  return wall - Math.floor(instant / 1000) * 1000;
}

// The first instant of the local day `day` in `timeZone`: local midnight,
// or the transition instant when a DST jump skips midnight. Two offset
// probes cover any day with at most one transition near midnight; the
// earliest candidate that already reads as `day` wins.
export function startOfDayIn(day: DayKey, timeZone: string): Date {
  const midnight = utcMidnight(day);
  const first = midnight - zoneOffsetMs(midnight, timeZone);
  const second = midnight - zoneOffsetMs(first, timeZone);
  const dayOf = dayKeyFormatter(timeZone);
  const candidates = [first, second]
    .filter((instant) => dayOf(new Date(instant)) === day)
    .sort((a, b) => a - b);
  return new Date(candidates[0] ?? first);
}

// The first instant of the local day `now` falls on in `timeZone` (Home's
// "reviewed today" bound, H2-T5i).
export function startOfTodayIn(now: Date, timeZone: string): Date {
  return startOfDayIn(dayKeyIn(now, timeZone), timeZone);
}

// The first instant of the local day after the one `now` falls on in
// `timeZone`. Reviews are due per local day (user decision 2026-10-18,
// SM-2 schedules days, not hours): an item is due today while its due_at
// is before this bound, so the whole day is review time.
export function startOfTomorrowIn(now: Date, timeZone: string): Date {
  return startOfDayIn(addDays(dayKeyIn(now, timeZone), 1), timeZone);
}

// Every UTC offset in use lies within ±14 h, so local midnight of a day is
// never further than this from the day's UTC midnight. Readers query a
// window padded by it and the grouping keeps only the requested local days,
// which needs no DST-aware "start of day in a zone" arithmetic.
const MAX_OFFSET_MS = 14 * 3_600_000;

// [from, to) instants that contain every instant of the local days
// [fromDay, toDay) in any zone.
export function paddedRange(
  fromDay: DayKey,
  toDay: DayKey,
): { from: Date; to: Date } {
  return {
    from: new Date(utcMidnight(fromDay) - MAX_OFFSET_MS),
    to: new Date(utcMidnight(toDay) + MAX_OFFSET_MS),
  };
}

// One study item as the calendar reader returns it.
export interface CalendarItem {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  kind: DueKind;
  dueAt: Date;
}

// The overdue items of one page and technique, counted in the read: they
// all show on today, so the calendar never reads them one by one.
export interface OverdueCount {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  kind: DueKind;
  count: number;
  earliestDueAt: Date;
}

// One page on one local day, with its items due that day per technique.
export interface CalendarDayPage {
  day: DayKey;
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  due: DueCounts;
}

// Groups items by local day (in `timeZone`) and page. Items due before
// `today` are overdue and still pending, so they count on `today`, as do
// the already aggregated `overdue` counts. Ordered by day, then by each
// page's earliest item that day, then page id.
export function groupCalendarDays(
  items: readonly CalendarItem[],
  options: {
    timeZone: string;
    today: DayKey;
    overdue?: readonly OverdueCount[];
  },
): CalendarDayPage[] {
  const dayOf = dayKeyFormatter(options.timeZone);
  const groups = new Map<string, { row: CalendarDayPage; earliest: number }>();
  const add = (
    day: DayKey,
    entry: Omit<CalendarItem, "dueAt">,
    count: number,
    dueAt: Date,
  ) => {
    const key = `${day}|${entry.pageId}`;
    const group = groups.get(key) ?? {
      row: {
        day,
        pageId: entry.pageId,
        pageTitle: entry.pageTitle,
        notebookId: entry.notebookId,
        notebookTitle: entry.notebookTitle,
        due: emptyDueCounts(),
      },
      earliest: dueAt.getTime(),
    };
    group.row.due[entry.kind] += count;
    group.earliest = Math.min(group.earliest, dueAt.getTime());
    groups.set(key, group);
  };
  for (const overdue of options.overdue ?? []) {
    add(options.today, overdue, overdue.count, overdue.earliestDueAt);
  }
  for (const item of items) {
    const local = dayOf(item.dueAt);
    add(local < options.today ? options.today : local, item, 1, item.dueAt);
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        compareText(a.row.day, b.row.day) ||
        a.earliest - b.earliest ||
        compareText(a.row.pageId, b.row.pageId),
    )
    .map(({ row }) => row);
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
