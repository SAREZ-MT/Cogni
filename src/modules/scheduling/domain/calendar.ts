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

function keyOfUtc(ms: number): DayKey {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string" || !DAY_KEY.test(value)) return false;
  // Round-trip rejects impossible dates such as 2026-02-30.
  return keyOfUtc(utcMidnight(value)) === value;
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
  kind: DueKind;
  dueAt: Date;
}

// One page on one local day, with its items due that day per technique.
export interface CalendarDayPage {
  day: DayKey;
  pageId: string;
  pageTitle: string;
  notebookId: string;
  due: DueCounts;
}

// Groups items by local day (in `timeZone`) and page. Items due before
// `today` are overdue and still pending, so they count on `today`. Ordered
// by day, then by each page's earliest item that day, then page id.
export function groupCalendarDays(
  items: readonly CalendarItem[],
  options: { timeZone: string; today: DayKey },
): CalendarDayPage[] {
  const dayOf = dayKeyFormatter(options.timeZone);
  const groups = new Map<string, { row: CalendarDayPage; earliest: number }>();
  for (const item of items) {
    const local = dayOf(item.dueAt);
    const day = local < options.today ? options.today : local;
    const key = `${day}|${item.pageId}`;
    const group = groups.get(key) ?? {
      row: {
        day,
        pageId: item.pageId,
        pageTitle: item.pageTitle,
        notebookId: item.notebookId,
        due: emptyDueCounts(),
      },
      earliest: item.dueAt.getTime(),
    };
    group.row.due[item.kind] += 1;
    group.earliest = Math.min(group.earliest, item.dueAt.getTime());
    groups.set(key, group);
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
