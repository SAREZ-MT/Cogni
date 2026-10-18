import type { StreakWeekDay } from "@/shared/ui/streak-week";

// "Sábado 18 de octubre": the local date in the profile's zone, shown with
// the Home greeting.
export function longDateLabel(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  const weekday = part("weekday");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${part("day")} de ${part("month")}`;
}

// The streak's helper line, by whether today already has a review and how
// long the streak is.
export function streakHelper(
  streakDays: number,
  days: readonly StreakWeekDay[],
): string {
  if (streakDays === 0) return "Repasa hoy para empezar una racha.";
  const reviewedToday = days.some((day) => day.isToday && day.studied);
  if (!reviewedToday) return "Repasa hoy para no perder tu racha.";
  if (streakDays === 1) return "Buen comienzo. Vuelve mañana para seguir.";
  if (streakDays >= 7) return "Una semana o más sin fallar. Gran constancia.";
  return "Ya repasaste hoy. ¡Sigue así!";
}
