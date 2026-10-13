import { describe, expect, it } from "vitest";
import {
  countReviews,
  dailyReviews,
  type ReviewFact,
  trendWeekStarts,
  weeklyQualityTrends,
} from "./review-activity";
import { ANALYTICS_TECHNIQUES } from "./technique";

const review = (overrides: Partial<ReviewFact> = {}): ReviewFact => ({
  pageId: "p-1",
  notebookId: "nb-1",
  technique: "flashcards",
  quality: 4,
  reviewedAt: new Date("2026-10-13T12:00:00.000Z"),
  ...overrides,
});

describe("ANALYTICS_TECHNIQUES", () => {
  it("lists the techniques in the panel order", () => {
    expect(ANALYTICS_TECHNIQUES).toEqual(["flashcards", "recall", "exam"]);
  });
});

describe("trendWeekStarts", () => {
  it("lists the Mondays of the last weeks, oldest first, ending with today's week", () => {
    expect(trendWeekStarts("2026-10-15", 3)).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
    ]);
  });
});

describe("weeklyQualityTrends", () => {
  const weekStarts = ["2026-10-05", "2026-10-12"];

  it("averages the review quality per key and local week", () => {
    const trends = weeklyQualityTrends(
      [
        review({ quality: 2, reviewedAt: new Date("2026-10-06T12:00:00Z") }),
        review({ quality: 5, reviewedAt: new Date("2026-10-13T12:00:00Z") }),
        review({ quality: 4, reviewedAt: new Date("2026-10-14T12:00:00Z") }),
        review({ pageId: "p-2", quality: 1 }),
      ],
      (fact) => fact.pageId,
      { weekStarts, timeZone: "UTC" },
    );

    expect(trends.get("p-1")).toEqual([
      { weekStart: "2026-10-05", reviews: 1, averageQuality: 2 },
      { weekStart: "2026-10-12", reviews: 2, averageQuality: 4.5 },
    ]);
    expect(trends.get("p-2")).toEqual([
      { weekStart: "2026-10-05", reviews: 0, averageQuality: null },
      { weekStart: "2026-10-12", reviews: 1, averageQuality: 1 },
    ]);
  });

  it("buckets by the local day in the zone", () => {
    // Monday 12 Oct 02:00 UTC is still Sunday 11 Oct in Bogotá.
    const trends = weeklyQualityTrends(
      [review({ reviewedAt: new Date("2026-10-12T02:00:00Z") })],
      (fact) => fact.pageId,
      { weekStarts, timeZone: "America/Bogota" },
    );

    expect(trends.get("p-1")?.map((week) => week.reviews)).toEqual([1, 0]);
  });

  it("ignores reviews outside the weeks", () => {
    const trends = weeklyQualityTrends(
      [
        review({ reviewedAt: new Date("2026-10-04T12:00:00Z") }),
        review({ reviewedAt: new Date("2026-10-19T12:00:00Z") }),
      ],
      (fact) => fact.pageId,
      { weekStarts, timeZone: "UTC" },
    );

    expect(trends.size).toBe(0);
  });
});

describe("dailyReviews", () => {
  it("counts reviews per local day and technique, with every day listed", () => {
    expect(
      dailyReviews(
        [
          review({ reviewedAt: new Date("2026-10-12T09:00:00Z") }),
          review({
            technique: "exam",
            reviewedAt: new Date("2026-10-12T10:00:00Z"),
          }),
          review({
            technique: "recall",
            reviewedAt: new Date("2026-10-14T23:30:00Z"),
          }),
          review({ reviewedAt: new Date("2026-10-11T23:00:00Z") }),
        ],
        { days: ["2026-10-12", "2026-10-13", "2026-10-14"], timeZone: "UTC" },
      ),
    ).toEqual([
      { day: "2026-10-12", reviews: { flashcards: 1, recall: 0, exam: 1 } },
      { day: "2026-10-13", reviews: { flashcards: 0, recall: 0, exam: 0 } },
      { day: "2026-10-14", reviews: { flashcards: 0, recall: 1, exam: 0 } },
    ]);
  });
});

describe("countReviews", () => {
  it("counts reviews per technique", () => {
    expect(
      countReviews([review(), review(), review({ technique: "recall" })]),
    ).toEqual({ flashcards: 2, recall: 1, exam: 0 });
  });
});
