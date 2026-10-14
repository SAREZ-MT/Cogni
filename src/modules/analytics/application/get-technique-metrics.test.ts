import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { getTechniqueMetrics } from "./get-technique-metrics";
import { seededStore } from "./testing/seeded-store";

// Tuesday 13 Oct 15:00 UTC; the range is the last 7 days, 7–13 Oct.
const NOW = new Date("2026-10-13T15:00:00.000Z");
const RANGE = { fromDay: "2026-10-07", toDay: "2026-10-14" };
const at = (iso: string) => new Date(iso);

describe("getTechniqueMetrics", () => {
  it("counts reviews, accuracy and streaks per technique for the range and the one before", async () => {
    const store = seededStore();
    const review = (
      technique: "flashcards" | "recall" | "exam",
      quality: number,
      iso: string,
    ) =>
      store.addReview({
        pageId: "p-1",
        technique,
        quality,
        reviewedAt: at(iso),
      });
    // Current range.
    review("flashcards", 5, "2026-10-11T10:00:00Z");
    review("flashcards", 1, "2026-10-12T10:00:00Z");
    review("flashcards", 4, "2026-10-13T10:00:00Z");
    review("exam", 3, "2026-10-13T11:00:00Z");
    // Previous range (30 Sep – 6 Oct).
    review("flashcards", 2, "2026-10-06T10:00:00Z");
    review("recall", 4, "2026-09-30T10:00:00Z");
    // Before both ranges: only the streaks see it.
    review("recall", 4, "2026-09-29T10:00:00Z");
    store.addExamAnswer({
      pageId: "p-1",
      isCorrect: true,
      answeredAt: at("2026-10-13T11:00:00Z"),
      finished: true,
    });
    store.addExamAnswer({
      pageId: "p-1",
      isCorrect: false,
      answeredAt: at("2026-10-13T11:01:00Z"),
      finished: true,
    });
    store.addExamAnswer({
      pageId: "p-1",
      isCorrect: false,
      answeredAt: at("2026-10-01T11:00:00Z"),
      finished: true,
    });
    store.addRecallAnswer({
      pageId: "p-2",
      selfRating: 4,
      aiScore: 3,
      status: "done",
      answeredAt: at("2026-10-08T09:00:00Z"),
    });
    store.addRecallAnswer({
      pageId: "p-2",
      selfRating: 4,
      aiScore: 2,
      status: "done",
      answeredAt: at("2026-10-02T09:00:00Z"),
    });

    const report = await getTechniqueMetrics(
      { ownerId: "owner-1", ...RANGE, timeZone: "UTC" },
      { reviews: store, answers: store, clock: createFixedClock(NOW) },
    );

    expect(report.today).toBe("2026-10-13");
    expect(report.range).toEqual(RANGE);
    expect(report.previousRange).toEqual({
      fromDay: "2026-09-30",
      toDay: "2026-10-07",
    });
    expect(report.overall).toEqual({
      reviewsCompleted: 4,
      previousReviewsCompleted: 2,
      streakDays: 3,
      // As of 6 Oct only the 6 Oct review counts toward a run.
      streakDaysWeekAgo: 1,
    });
    expect(report.techniques).toEqual([
      {
        technique: "flashcards",
        reviewsCompleted: 3,
        previousReviewsCompleted: 1,
        accuracy: { correct: 2, total: 3, rate: 2 / 3 },
        previousAccuracy: { correct: 0, total: 1, rate: 0 },
        streakDays: 3,
      },
      {
        technique: "recall",
        reviewsCompleted: 0,
        previousReviewsCompleted: 1,
        accuracy: { correct: 1, total: 1, rate: 1 },
        previousAccuracy: { correct: 0, total: 1, rate: 0 },
        streakDays: 0,
      },
      {
        technique: "exam",
        reviewsCompleted: 1,
        previousReviewsCompleted: 0,
        accuracy: { correct: 1, total: 2, rate: 0.5 },
        previousAccuracy: { correct: 0, total: 1, rate: 0 },
        streakDays: 1,
      },
    ]);
    expect(report.daily.map((day) => day.day)).toEqual([
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
    ]);
    expect(report.daily.at(-1)).toEqual({
      day: "2026-10-13",
      reviews: { flashcards: 1, recall: 0, exam: 1 },
    });
  });

  it("buckets reviews and streak days by the local day in the profile zone", async () => {
    const store = seededStore();
    // 13 Oct 03:00 UTC is 12 Oct in Bogotá; 13 Oct 15:00 UTC is 13 Oct.
    store.addReview({
      pageId: "p-1",
      technique: "flashcards",
      quality: 4,
      reviewedAt: at("2026-10-13T03:00:00Z"),
    });
    store.addReview({
      pageId: "p-1",
      technique: "flashcards",
      quality: 4,
      reviewedAt: at("2026-10-13T14:00:00Z"),
    });

    const report = await getTechniqueMetrics(
      { ownerId: "owner-1", ...RANGE, timeZone: "America/Bogota" },
      { reviews: store, answers: store, clock: createFixedClock(NOW) },
    );

    expect(report.daily.slice(-2).map((day) => day.reviews.flashcards)).toEqual(
      [1, 1],
    );
    expect(report.overall.streakDays).toBe(2);
  });

  it("measures the overall streak as of seven days ago, ignoring later days", async () => {
    const store = seededStore();
    for (const iso of [
      "2026-10-04T10:00:00Z",
      "2026-10-05T10:00:00Z",
      "2026-10-06T10:00:00Z",
      "2026-10-10T10:00:00Z",
      "2026-10-11T10:00:00Z",
      "2026-10-12T10:00:00Z",
      "2026-10-13T10:00:00Z",
    ]) {
      store.addReview({
        pageId: "p-1",
        technique: "flashcards",
        quality: 4,
        reviewedAt: at(iso),
      });
    }

    const report = await getTechniqueMetrics(
      { ownerId: "owner-1", ...RANGE, timeZone: "UTC" },
      { reviews: store, answers: store, clock: createFixedClock(NOW) },
    );

    expect(report.overall.streakDays).toBe(4);
    expect(report.overall.streakDaysWeekAgo).toBe(3);
  });

  it("keeps the week-ago anchor day open, like today: a run ending the day before still counts", async () => {
    const store = seededStore();
    // No review on 6 Oct (the anchor, today − 7); reviews on 4 and 5 Oct.
    for (const iso of ["2026-10-04T10:00:00Z", "2026-10-05T10:00:00Z"]) {
      store.addReview({
        pageId: "p-1",
        technique: "flashcards",
        quality: 4,
        reviewedAt: at(iso),
      });
    }

    const report = await getTechniqueMetrics(
      { ownerId: "owner-1", ...RANGE, timeZone: "UTC" },
      { reviews: store, answers: store, clock: createFixedClock(NOW) },
    );

    expect(report.overall.streakDays).toBe(0);
    expect(report.overall.streakDaysWeekAgo).toBe(2);
  });

  it("reports empty tallies without activity", async () => {
    const report = await getTechniqueMetrics(
      { ownerId: "owner-1", ...RANGE, timeZone: "UTC" },
      {
        reviews: seededStore(),
        answers: seededStore(),
        clock: createFixedClock(NOW),
      },
    );

    expect(report.overall).toEqual({
      reviewsCompleted: 0,
      previousReviewsCompleted: 0,
      streakDays: 0,
      streakDaysWeekAgo: 0,
    });
    expect(report.techniques[0]?.accuracy).toEqual({
      correct: 0,
      total: 0,
      rate: null,
    });
  });
});
