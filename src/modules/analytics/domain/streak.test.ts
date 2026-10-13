import { describe, expect, it } from "vitest";
import { currentStreak, reviewDays } from "./streak";

const set = (...days: string[]) => new Set(days);

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(
      currentStreak(
        set("2026-10-11", "2026-10-12", "2026-10-13"),
        "2026-10-13",
      ),
    ).toBe(3);
  });

  it("stops at the first day without reviews", () => {
    expect(
      currentStreak(
        set("2026-10-09", "2026-10-11", "2026-10-12", "2026-10-13"),
        "2026-10-13",
      ),
    ).toBe(3);
  });

  it("keeps yesterday's streak alive while today has no review yet", () => {
    expect(currentStreak(set("2026-10-11", "2026-10-12"), "2026-10-13")).toBe(
      2,
    );
  });

  it("is zero when neither today nor yesterday has a review", () => {
    expect(currentStreak(set("2026-10-10", "2026-10-11"), "2026-10-13")).toBe(
      0,
    );
    expect(currentStreak(set(), "2026-10-13")).toBe(0);
  });

  it("ignores days after today", () => {
    expect(currentStreak(set("2026-10-14", "2026-10-13"), "2026-10-13")).toBe(
      1,
    );
  });

  it("crosses month and year boundaries", () => {
    expect(currentStreak(set("2025-12-31", "2026-01-01"), "2026-01-01")).toBe(
      2,
    );
  });
});

describe("reviewDays", () => {
  it("collects the local days with reviews, overall and per technique", () => {
    const days = reviewDays(
      [
        // 04:00 UTC is still the 12th in Bogotá (UTC-5).
        { technique: "flashcards", startsAt: new Date("2026-10-13T04:00:00Z") },
        { technique: "flashcards", startsAt: new Date("2026-10-13T15:00:00Z") },
        { technique: "exam", startsAt: new Date("2026-10-13T15:15:00Z") },
      ],
      "America/Bogota",
    );

    expect(days.overall).toEqual(set("2026-10-12", "2026-10-13"));
    expect(days.byTechnique.flashcards).toEqual(
      set("2026-10-12", "2026-10-13"),
    );
    expect(days.byTechnique.exam).toEqual(set("2026-10-13"));
    expect(days.byTechnique.recall).toEqual(set());
  });
});
