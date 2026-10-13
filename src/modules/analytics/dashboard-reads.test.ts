import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InMemoryAnalyticsStore } from "./application/testing/in-memory-analytics-store";
import { seededStore } from "./application/testing/seeded-store";

// The dashboard's server reads: session first, input checked, every
// failure returned as an ActionError with Spanish copy (Next.js control
// flow rethrown), "today" taken from the instant the page renders with.
// Session, database and Sentry are mocked; the readers are the in-memory
// store.
vi.mock("server-only", () => ({}));
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

let store: InMemoryAnalyticsStore;
vi.mock("./infrastructure", () => ({
  DrizzleReviewHistoryReader: class {
    listReviews(ownerId: string, from: Date, to: Date) {
      return store.listReviews(ownerId, from, to);
    }
    listReviewBuckets(ownerId: string) {
      return store.listReviewBuckets(ownerId);
    }
  },
  DrizzlePageProgressReader: class {
    listPageProgress(ownerId: string, now: Date) {
      return store.listPageProgress(ownerId, now);
    }
  },
  DrizzleAnswerOutcomeReader: class {
    listExamAnswers(ownerId: string, from: Date, to: Date) {
      return store.listExamAnswers(ownerId, from, to);
    }
    listRecallAnswers(ownerId: string, from: Date, to: Date) {
      return store.listRecallAnswers(ownerId, from, to);
    }
  },
}));

import {
  getCalibrationAction,
  getProgressAction,
  getTechniqueMetricsAction,
} from "./actions";
import {
  getDashboardCalibration,
  getDashboardProgress,
  getDashboardTechniqueMetrics,
} from "./dashboard-reads";

// The page rendered at 23:59:59.999 UTC on Monday 12 Oct; by the time the
// read runs, the system clock is already Tuesday 13 Oct.
const RENDERED_AT = new Date("2026-10-12T23:59:59.999Z");
const SYSTEM_NOW = new Date("2026-10-13T00:00:00.500Z");
const WEEK = { fromDay: "2026-10-06", toDay: "2026-10-13", timeZone: "UTC" };

const SESSION_REQUIRED = {
  ok: false,
  error: {
    code: "ANALYTICS_SESSION_REQUIRED",
    message: "Debes iniciar sesión para continuar.",
  },
};
const INVALID_INPUT = {
  ok: false,
  error: {
    code: "ANALYTICS_INVALID_INPUT",
    message: "El período o la zona horaria no son válidos.",
  },
};
const UNEXPECTED = {
  ok: false,
  error: {
    code: "ANALYTICS_UNEXPECTED",
    message: "No pudimos cargar tus métricas. Inténtalo de nuevo.",
  },
};

describe("dashboard reads", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SYSTEM_NOW);
    store = seededStore();
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    captureException.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getDashboardProgress", () => {
    it("reads the caller's progress with the trend weeks ending at the given instant's week", async () => {
      store.addReview({
        pageId: "p-1",
        technique: "flashcards",
        quality: 4,
        reviewedAt: new Date("2026-10-12T10:00:00.000Z"),
      });

      const result = await getDashboardProgress({
        timeZone: "UTC",
        weeks: 1,
        now: RENDERED_AT,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.weekStarts).toEqual(["2026-10-12"]);
      expect(result.value.pages[0]?.trend).toEqual([
        { weekStart: "2026-10-12", reviews: 1, averageQuality: 4 },
      ]);
    });

    it("requires a session", async () => {
      getCurrentUser.mockResolvedValue(null);

      expect(
        await getDashboardProgress({
          timeZone: "UTC",
          weeks: 4,
          now: RENDERED_AT,
        }),
      ).toEqual(SESSION_REQUIRED);
    });

    it.each([
      { timeZone: "Mars/Olympus", weeks: 4 },
      { timeZone: "UTC", weeks: 0 },
      { timeZone: "UTC", weeks: 27 },
      { timeZone: "UTC", weeks: 2.5 },
    ])("rejects invalid input %o", async (input) => {
      expect(
        await getDashboardProgress({ ...input, now: RENDERED_AT }),
      ).toEqual(INVALID_INPUT);
    });
  });

  describe("getDashboardTechniqueMetrics", () => {
    it("computes today and the streaks from the given instant, not the system clock", async () => {
      store.addReview({
        pageId: "p-1",
        technique: "exam",
        quality: 4,
        reviewedAt: new Date("2026-10-12T10:00:00.000Z"),
      });

      const result = await getDashboardTechniqueMetrics({
        ...WEEK,
        now: RENDERED_AT,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.today).toBe("2026-10-12");
      expect(result.value.overall.streakDays).toBe(1);
    });

    it.each([
      { fromDay: "2026-10-13", toDay: "2026-10-13", timeZone: "UTC" },
      { fromDay: "2026-06-01", toDay: "2026-10-13", timeZone: "UTC" },
      { fromDay: "2026-10-06", toDay: "2026-10-13", timeZone: "Nowhere" },
      { fromDay: "13/10/2026", toDay: "2026-10-14", timeZone: "UTC" },
    ])("rejects an invalid range %o", async (input) => {
      expect(
        await getDashboardTechniqueMetrics({ ...input, now: RENDERED_AT }),
      ).toEqual(INVALID_INPUT);
    });
  });

  describe("getDashboardCalibration", () => {
    it("rolls up the caller's recall calibration in the range", async () => {
      store.addRecallAnswer({
        pageId: "p-1",
        selfRating: 5,
        aiScore: 1,
        status: "done",
        answeredAt: new Date("2026-10-08T10:00:00.000Z"),
      });

      const result = await getDashboardCalibration(WEEK);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.totals).toEqual({
        answers: 1,
        overconfident: 1,
        underconfident: 0,
        calibrated: 0,
      });
    });

    it("rejects an invalid range", async () => {
      expect(
        await getDashboardCalibration({ ...WEEK, toDay: WEEK.fromDay }),
      ).toEqual(INVALID_INPUT);
    });
  });

  it("reports an unexpected failure to Sentry and returns the Spanish error", async () => {
    const failure = new Error("connection reset");
    getCurrentUser.mockRejectedValue(failure);

    expect(await getDashboardCalibration(WEEK)).toEqual(UNEXPECTED);
    expect(captureException).toHaveBeenCalledWith(failure);
  });

  it("rethrows Next.js control flow instead of reporting it", async () => {
    getCurrentUser.mockImplementation(async () => redirect("/login"));

    await expect(
      getDashboardProgress({ timeZone: "UTC", weeks: 1, now: RENDERED_AT }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(captureException).not.toHaveBeenCalled();
  });

  describe("Server Actions", () => {
    it("read with the system clock and never accept one from the input", async () => {
      store.addReview({
        pageId: "p-1",
        technique: "flashcards",
        quality: 4,
        reviewedAt: new Date("2026-10-13T00:00:00.100Z"),
      });

      const metrics = await getTechniqueMetricsAction({
        ...WEEK,
        toDay: "2026-10-14",
        now: RENDERED_AT,
      } as never);
      const progress = await getProgressAction({ timeZone: "UTC", weeks: 1 });

      expect(metrics.ok && metrics.value.today).toBe("2026-10-13");
      expect(progress.ok && progress.value.weekStarts).toEqual(["2026-10-12"]);
    });

    it("share the session check", async () => {
      getCurrentUser.mockResolvedValue(null);

      expect(await getCalibrationAction(WEEK)).toEqual(SESSION_REQUIRED);
    });
  });
});
