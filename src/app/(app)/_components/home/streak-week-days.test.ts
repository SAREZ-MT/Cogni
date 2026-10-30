import { describe, expect, it } from "vitest";
import { streakWeekDays } from "./streak-week-days";

const counts = (flashcards: number, recall = 0, exam = 0) => ({
  flashcards,
  recall,
  exam,
});

describe("streakWeekDays", () => {
  it("maps each local day to its Spanish initial, a studied flag and today", () => {
    // 12 Oct 2026 is a Monday; 18 Oct is the Sunday "today".
    const days = streakWeekDays(
      [
        { day: "2026-10-12", reviews: counts(0) },
        { day: "2026-10-13", reviews: counts(0, 1) },
        { day: "2026-10-14", reviews: counts(0) },
        { day: "2026-10-15", reviews: counts(0, 0, 2) },
        { day: "2026-10-16", reviews: counts(0) },
        { day: "2026-10-17", reviews: counts(0) },
        { day: "2026-10-18", reviews: counts(3) },
      ],
      "2026-10-18",
    );

    expect(days.map((day) => day.initial).join(" ")).toBe("L M M J V S D");
    expect(days.map((day) => day.name)).toEqual([
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
      "domingo",
    ]);
    expect(days.map((day) => day.studied)).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      true,
    ]);
    expect(days.filter((day) => day.isToday).map((day) => day.key)).toEqual([
      "2026-10-18",
    ]);
  });
});
