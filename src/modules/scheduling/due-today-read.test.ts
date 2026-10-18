import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryDueTodayReader } from "./application/testing/in-memory-due-today-reader";

// getDueToday is Home's and the calendar's server-side read (zone and
// instant from the page); getCurrentDueCutoff gives the technique modules
// the same per-day bound. Session, profile zone, database and Sentry are
// mocked.
const { getCurrentUser, getCurrentTimeZoneSetting } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getCurrentTimeZoneSetting: vi.fn(),
}));
vi.mock("@/modules/identity", () => ({
  getCurrentUser,
  getCurrentTimeZoneSetting,
}));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

let reader: InMemoryDueTodayReader;
vi.mock("./infrastructure", () => ({
  DrizzleDueTodayReader: class {
    listDueToday(ownerId: string, dueBefore: Date) {
      return reader.listDueToday(ownerId, dueBefore);
    }
  },
}));

import { getCurrentDueCutoff, getDueToday } from "./due-today-read";

// 15:00 on Sunday 18 Oct in Bogotá (-05).
const RENDERED_AT = new Date("2026-10-18T20:00:00.000Z");

function seed(pageId: string, dueAt: Date) {
  reader.addNotebook({
    id: `nb-${pageId}`,
    ownerId: "owner-1",
    title: "Biología",
    color: "green",
  });
  reader.addPage({
    id: pageId,
    ownerId: "owner-1",
    notebookId: `nb-${pageId}`,
    title: "Mitosis",
  });
  reader.addItem({ pageId, kind: "recall_question", dueAt, suspended: false });
}

describe("getDueToday", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // The system clock is already Monday in UTC; the page's instant wins.
    vi.setSystemTime(new Date("2026-10-19T06:00:00.000Z"));
    reader = new InMemoryDueTodayReader();
    getCurrentUser.mockReset();
    getCurrentTimeZoneSetting.mockReset();
    captureException.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts what is due during the page's local day in the given zone", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    seed("p-tonight", new Date("2026-10-19T03:00:00.000Z")); // 22:00 local
    seed("p-monday", new Date("2026-10-19T05:30:00.000Z")); // 00:30 Monday

    const result = await getDueToday({
      timeZone: "America/Bogota",
      now: RENDERED_AT,
    });

    expect(result.ok && result.value.map((row) => row.pageId)).toEqual([
      "p-tonight",
    ]);
    expect(getCurrentTimeZoneSetting).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    expect(
      await getDueToday({ timeZone: "America/Bogota", now: RENDERED_AT }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_SESSION_REQUIRED" }),
    });
  });

  it("refuses an unknown zone", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });

    expect(
      await getDueToday({ timeZone: "Mars/Olympus", now: RENDERED_AT }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_INVALID_RANGE" }),
    });
  });
});

describe("getCurrentDueCutoff", () => {
  it("bounds 'due' at the start of tomorrow in the profile's zone", async () => {
    getCurrentTimeZoneSetting.mockResolvedValue({
      status: "ok",
      timeZone: "America/Bogota",
      chosen: true,
    });

    const cutoff = await getCurrentDueCutoff();

    expect(cutoff(RENDERED_AT)).toEqual(new Date("2026-10-19T05:00:00.000Z"));
  });

  it("falls back to the zone the failed read reports", async () => {
    getCurrentTimeZoneSetting.mockResolvedValue({
      status: "failed",
      timeZone: "UTC",
    });

    const cutoff = await getCurrentDueCutoff();

    expect(cutoff(RENDERED_AT)).toEqual(new Date("2026-10-19T00:00:00.000Z"));
  });
});
