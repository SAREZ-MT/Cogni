import { describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import type { InMemoryAnalyticsStore } from "./application/testing/in-memory-analytics-store";
import { seededStore } from "./application/testing/seeded-store";

// createAnalyticsServerApi composes the use cases with the Drizzle readers;
// the readers are swapped for the in-memory store so this proves the
// wiring (owner, injected clock) without a database.
vi.mock("server-only", () => ({}));
let store: InMemoryAnalyticsStore;
vi.mock("./infrastructure", () => ({
  DrizzleReviewHistoryReader: vi.fn(function Reader() {
    return store;
  }),
  DrizzlePageProgressReader: vi.fn(function Reader() {
    return store;
  }),
  DrizzleAnswerOutcomeReader: vi.fn(function Reader() {
    return store;
  }),
}));

import { createAnalyticsServerApi } from "./server-api";

const NOW = new Date("2026-10-13T12:00:00.000Z");
const RANGE = { fromDay: "2026-10-07", toDay: "2026-10-14", timeZone: "UTC" };

describe("createAnalyticsServerApi", () => {
  it("reads the given owner's dashboard with the injected clock", async () => {
    store = seededStore();
    store.addReview({
      pageId: "p-1",
      technique: "recall",
      quality: 3,
      reviewedAt: new Date("2026-10-13T08:00:00.000Z"),
    });
    store.addRecallAnswer({
      pageId: "p-1",
      selfRating: 0,
      aiScore: 5,
      status: "done",
      answeredAt: new Date("2026-10-13T08:00:00.000Z"),
    });
    const api = createAnalyticsServerApi({
      db: {} as never,
      clock: createFixedClock(NOW),
    });

    const progress = await api.getProgress("owner-1", {
      timeZone: "UTC",
      weeks: 1,
    });
    const metrics = await api.getTechniqueMetrics("owner-1", RANGE);
    const calibration = await api.getCalibration("owner-1", RANGE);
    const someoneElse = await api.getProgress("owner-2", {
      timeZone: "UTC",
      weeks: 1,
    });

    expect(progress.weekStarts).toEqual(["2026-10-12"]);
    expect(progress.pages.map((page) => page.pageId)).toEqual(["p-1", "p-2"]);
    expect(metrics.today).toBe("2026-10-13");
    expect(metrics.techniques[1]).toMatchObject({
      technique: "recall",
      reviewsCompleted: 1,
      streakDays: 1,
    });
    expect(calibration.totals.underconfident).toBe(1);
    expect(someoneElse.pages).toEqual([]);
  });

  it("defaults to the system clock", async () => {
    store = seededStore();
    const api = createAnalyticsServerApi({ db: {} as never });

    const metrics = await api.getTechniqueMetrics("owner-1", RANGE);

    expect(metrics.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
