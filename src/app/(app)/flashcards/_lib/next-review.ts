// Phase 8 H17: when an up-to-date deck's next review falls, in calendar
// days of the student's time zone ("Al día · repaso mañana" / "en 3 días").

function localDay(instant: Date, timeZone: string): number {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(instant)
    .split("-")
    .map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / 86_400_000;
}

// Calendar days from `now` to `instant` in `timeZone` (0 = same day).
export function daysUntil(instant: Date, now: Date, timeZone: string): number {
  return localDay(instant, timeZone) - localDay(now, timeZone);
}

// "mañana" or "en N días"; null when nothing is scheduled. A deck shown as
// up to date has nothing due today, so a review on or before today (a
// card that became due after the page loaded) still reads "mañana".
export function nextReviewLabel(
  nextDueAt: string | null,
  now: Date,
  timeZone: string,
): string | null {
  if (nextDueAt === null) return null;
  const days = daysUntil(new Date(nextDueAt), now, timeZone);
  return days <= 1 ? "mañana" : `en ${days} días`;
}
