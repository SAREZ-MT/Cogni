import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryDueTodayReader } from "./application/testing/in-memory-due-today-reader";

// getTechniqueOverview is Home's server-side read (the page passes the
// instant it renders with); getTechniqueOverviewAction is the client-
// reachable twin that only ever uses the system clock and the profile's
// zone, read server-side. Session, database
// and Sentry are mocked.
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
let failure: Error | null = null;
vi.mock("./infrastructure", () => ({
  DrizzleTechniqueOverviewReader: class {
    readTechniqueSnapshot(
      ownerId: string,
      bounds: { reviewedFrom: Date; dueBefore: Date },
    ) {
      if (failure) return Promise.reject(failure);
      return reader.readTechniqueSnapshot(ownerId, bounds);
    }
  },
}));

import { getTechniqueOverviewAction } from "./actions";
import { getTechniqueOverview } from "./technique-overview";

// The page rendered at 23:00 on Sunday 18 Oct (UTC); the system clock has
// already moved to Monday when the read runs.
const RENDERED_AT = new Date("2026-10-18T23:00:00.000Z");
const SYSTEM_NOW = new Date("2026-10-19T00:00:00.500Z");

function seed() {
  reader.addNotebook({
    id: "nb-1",
    ownerId: "owner-1",
    title: "Biología",
    color: "green",
  });
  reader.addPage({
    id: "p-1",
    ownerId: "owner-1",
    notebookId: "nb-1",
    title: "Mitosis",
  });
  // Due Monday 19 Oct at 09:00 UTC: "tomorrow" for the rendered instant,
  // already "today" for the system clock.
  reader.addItem({
    pageId: "p-1",
    kind: "flashcard",
    dueAt: new Date("2026-10-19T09:00:00.000Z"),
    suspended: false,
  });
}

describe("getTechniqueOverview (server read)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SYSTEM_NOW);
    reader = new InMemoryDueTodayReader();
    failure = null;
    getCurrentUser.mockReset();
    captureException.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the caller's totals with tomorrow taken from the given instant", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    seed();

    const result = await getTechniqueOverview({
      timeZone: "UTC",
      now: RENDERED_AT,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        flashcard: {
          total: 1,
          nextDueAt: new Date("2026-10-19T09:00:00.000Z"),
          pendingUnits: 0,
          doneUnits: 0,
        },
        exam_question: {
          total: 0,
          nextDueAt: null,
          pendingUnits: 0,
          doneUnits: 0,
        },
        recall_question: {
          total: 0,
          nextDueAt: null,
          pendingUnits: 0,
          doneUnits: 0,
        },
      },
    });
  });

  it("requires a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    expect(
      await getTechniqueOverview({ timeZone: "UTC", now: RENDERED_AT }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_SESSION_REQUIRED" }),
    });
  });

  it("rejects an unknown time zone without reading", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    const spy = vi.spyOn(reader, "readTechniqueSnapshot");

    expect(
      await getTechniqueOverview({
        timeZone: "Mars/Olympus",
        now: RENDERED_AT,
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_INVALID_RANGE" }),
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("never throws: an infrastructure failure becomes an ActionError", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    failure = new Error("db down");

    expect(
      await getTechniqueOverview({ timeZone: "UTC", now: RENDERED_AT }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_UNEXPECTED" }),
    });
    expect(captureException).toHaveBeenCalledWith(failure);
  });
});

describe("getTechniqueOverviewAction", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SYSTEM_NOW);
    reader = new InMemoryDueTodayReader();
    failure = null;
    getCurrentUser.mockReset();
    getCurrentTimeZoneSetting.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function profileZone(timeZone: string) {
    getCurrentTimeZoneSetting.mockResolvedValue({
      status: "ok",
      timeZone,
      chosen: true,
    });
  }

  // Client-reachable: a forged `now` in the input cannot move "tomorrow".
  it("ignores a client-supplied now and uses the system clock", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    profileZone("UTC");
    seed();

    const result = await (
      getTechniqueOverviewAction as (
        input: unknown,
      ) => ReturnType<typeof getTechniqueOverviewAction>
    )({ now: RENDERED_AT });

    // From Monday's point of view the item is due today (one pending page),
    // not upcoming.
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        flashcard: {
          total: 1,
          nextDueAt: null,
          pendingUnits: 1,
          doneUnits: 0,
        },
      }),
    });
  });

  // Client-reachable: the zone comes from the profile, never from the input.
  it("ignores a client-supplied zone and reads the profile's", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    // Sunday 19:00 in Bogotá: the Monday 09:00 UTC item is due tomorrow.
    profileZone("America/Bogota");
    seed();

    const result = await (
      getTechniqueOverviewAction as (
        input: unknown,
      ) => ReturnType<typeof getTechniqueOverviewAction>
    )({ timeZone: "UTC" });

    expect(getCurrentTimeZoneSetting).toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        flashcard: {
          total: 1,
          nextDueAt: new Date("2026-10-19T09:00:00.000Z"),
          pendingUnits: 0,
          doneUnits: 0,
        },
      }),
    });
  });
});
