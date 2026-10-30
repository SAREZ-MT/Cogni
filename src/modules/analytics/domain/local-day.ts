// Local days for the dashboard (documento-maestro §3.6): streaks, daily
// counts and weekly trends are bucketed by the day in the profile's time
// zone. Same day-key rules as scheduling's calendar (ISO "YYYY-MM-DD",
// arithmetic on UTC midnights, numeric Intl parts only); the domain may
// not import another module (§5.3), so analytics keeps its own copy of
// these few helpers.

export type DayKey = string;

const DAY_MS = 86_400_000;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Every UTC offset in use lies within ±14 h, so a window padded by it
// holds every instant of the requested local days in any zone; the domain
// then keeps only the instants whose local day is in range.
const MAX_OFFSET_MS = 14 * 3_600_000;

// The days a dashboard range may start or end on: the epoch is the floor
// (no review predates it) and the cap keeps every derived range (the
// previous period, padded windows) within four-digit years.
export const FIRST_ANALYTICS_DAY: DayKey = "1970-01-01";
export const LAST_ANALYTICS_DAY: DayKey = "9998-12-31";

function utcMidnight(key: DayKey): number {
  const [year, month, day] = key.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return Date.UTC(year, month - 1, day);
}

// Throws rather than return a malformed key: past year 9999
// toISOString switches to expanded years ("+010000-01-01").
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
  // The round trip rejects impossible dates (2026-02-30) and keys that
  // roll over past year 9999 (keyOfUtc throws).
  try {
    return keyOfUtc(utcMidnight(value)) === value;
  } catch {
    return false;
  }
}

export function addDays(key: DayKey, days: number): DayKey {
  return keyOfUtc(utcMidnight(key) + days * DAY_MS);
}

// The Monday of the week holding `key` (weeks run Monday to Sunday, as in
// the calendar).
export function weekStartOf(key: DayKey): DayKey {
  const weekday = (new Date(utcMidnight(key)).getUTCDay() + 6) % 7;
  return addDays(key, -weekday);
}

// Every day of [fromDay, toDay), in order.
export function daysBetween(fromDay: DayKey, toDay: DayKey): DayKey[] {
  const days: DayKey[] = [];
  for (let day = fromDay; day < toDay; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

// Formats instants as day keys in one zone.
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

// The first instant of the local day after the one `now` falls on in
// `timeZone`: reviews are due per local day (user decision 2026-10-18), so
// an item is pending today while its due_at is before this bound. Local
// days only move forward in time and no day lasts longer than 48 h, so a
// binary search over (now, now + 48 h] finds the first instant whose day
// is no longer today, to the millisecond; DST days and skipped midnights
// need no offset arithmetic. Mirrors scheduling's startOfTomorrowIn.
export function startOfTomorrowIn(now: Date, timeZone: string): Date {
  const dayOf = dayKeyFormatter(timeZone);
  const today = dayOf(now);
  let stillToday = now.getTime();
  let later = stillToday + 2 * DAY_MS;
  while (later - stillToday > 1) {
    const middle = Math.floor((stillToday + later) / 2);
    if (dayOf(new Date(middle)) === today) stillToday = middle;
    else later = middle;
  }
  return new Date(later);
}

// [from, to) instants that contain every instant of the local days
// [fromDay, toDay) in any zone.
export function paddedWindow(
  fromDay: DayKey,
  toDay: DayKey,
): { from: Date; to: Date } {
  return {
    from: new Date(utcMidnight(fromDay) - MAX_OFFSET_MS),
    to: new Date(utcMidnight(toDay) + MAX_OFFSET_MS),
  };
}

// True for a zone Intl can format in (guards untrusted action input; the
// profile already stores ICU's canonical IANA spelling).
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// A non-empty range [fromDay, toDay) of at most `maxDays` days that starts
// and ends inside the analytics window.
export function isAnalyticsRange(
  fromDay: unknown,
  toDay: unknown,
  maxDays: number,
): boolean {
  return (
    isDayKey(fromDay) &&
    isDayKey(toDay) &&
    fromDay >= FIRST_ANALYTICS_DAY &&
    fromDay <= LAST_ANALYTICS_DAY &&
    fromDay < toDay &&
    toDay <= addDays(fromDay, maxDays)
  );
}
