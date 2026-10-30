import type { DailyReviews } from "@/modules/analytics";
import type { StreakWeekDay } from "@/shared/ui/streak-week";

// Indexed by Date#getUTCDay (0 = Sunday).
const WEEKDAYS = [
  { initial: "D", name: "domingo" },
  { initial: "L", name: "lunes" },
  { initial: "M", name: "martes" },
  { initial: "M", name: "miércoles" },
  { initial: "J", name: "jueves" },
  { initial: "V", name: "viernes" },
  { initial: "S", name: "sábado" },
] as const;

// Home's streak dots: the analytics daily review counts (local days, oldest
// first) as one StreakWeek day each — studied when any technique has a
// review that day.
export function streakWeekDays(
  daily: readonly DailyReviews[],
  today: string,
): StreakWeekDay[] {
  return daily.map(({ day, reviews }) => {
    // Noon UTC keeps the calendar date whatever the runtime zone.
    const weekday = WEEKDAYS[new Date(`${day}T12:00:00.000Z`).getUTCDay()];
    return {
      key: day,
      initial: weekday.initial,
      name: weekday.name,
      studied: reviews.flashcards + reviews.recall + reviews.exam > 0,
      isToday: day === today,
    };
  });
}
