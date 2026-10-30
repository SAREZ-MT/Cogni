import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { getProgress } from "./get-progress";
import { seededStore } from "./testing/seeded-store";

// Tuesday 13 Oct 03:00 UTC is still Monday 12 Oct in Bogotá (UTC-5).
const NOW = new Date("2026-10-13T03:00:00.000Z");

describe("getProgress", () => {
  it("builds the page and notebook progress with weekly trends in the profile zone", async () => {
    const store = seededStore();
    store.setMastery("p-1", { level: "Consolidando", score: 0.5 });
    store.addItem({
      pageId: "p-1",
      dueAt: new Date(NOW.getTime() - 1),
      suspended: false,
    });
    // Due later today (22:00 → 23:59 local): reviews are due per local
    // day, so it is already pending.
    store.addItem({
      pageId: "p-1",
      dueAt: new Date(NOW.getTime() + 1),
      suspended: false,
    });
    // 00:00 on Tuesday 13 Oct in Bogotá: tomorrow, not due yet.
    store.addItem({
      pageId: "p-1",
      dueAt: new Date("2026-10-13T05:00:00.000Z"),
      suspended: false,
    });
    // Sunday 4 Oct in Bogotá: before the first week.
    store.addReview({
      pageId: "p-1",
      technique: "flashcards",
      quality: 0,
      reviewedAt: new Date("2026-10-05T04:00:00.000Z"),
    });
    // Monday 5 Oct in Bogotá: first week.
    store.addReview({
      pageId: "p-1",
      technique: "exam",
      quality: 2,
      reviewedAt: new Date("2026-10-05T06:00:00.000Z"),
    });
    // Monday 12 Oct 21:00 in Bogotá: current week.
    store.addReview({
      pageId: "p-1",
      technique: "recall",
      quality: 5,
      reviewedAt: new Date("2026-10-13T02:00:00.000Z"),
    });

    const progress = await getProgress(
      { ownerId: "owner-1", timeZone: "America/Bogota", weeks: 2 },
      { pages: store, reviews: store, clock: createFixedClock(NOW) },
    );

    const trend = [
      { weekStart: "2026-10-05", reviews: 1, averageQuality: 2 },
      { weekStart: "2026-10-12", reviews: 1, averageQuality: 5 },
    ];
    expect(progress.weekStarts).toEqual(["2026-10-05", "2026-10-12"]);
    expect(progress.pages).toEqual([
      {
        pageId: "p-1",
        pageTitle: "Mitocondria",
        notebookId: "nb-1",
        level: "Consolidando",
        score: 0.5,
        itemsTotal: 3,
        itemsDue: 2,
        trend,
      },
      {
        pageId: "p-2",
        pageTitle: "Ribosomas",
        notebookId: "nb-1",
        level: "Nuevo",
        score: 0,
        itemsTotal: 0,
        itemsDue: 0,
        trend: [
          { weekStart: "2026-10-05", reviews: 0, averageQuality: null },
          { weekStart: "2026-10-12", reviews: 0, averageQuality: null },
        ],
      },
    ]);
    expect(progress.notebooks).toEqual([
      {
        notebookId: "nb-1",
        title: "Biología",
        color: "green",
        pages: 2,
        itemsTotal: 3,
        itemsDue: 2,
        averageScore: 0.5,
        trend,
      },
    ]);
  });

  it("is empty for an owner without pages", async () => {
    const progress = await getProgress(
      { ownerId: "owner-9", timeZone: "UTC", weeks: 1 },
      {
        pages: seededStore(),
        reviews: seededStore(),
        clock: createFixedClock(NOW),
      },
    );

    expect(progress).toEqual({
      weekStarts: ["2026-10-12"],
      notebooks: [],
      pages: [],
    });
  });
});
