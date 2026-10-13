import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryDueTodayReader } from "./application/testing/in-memory-due-today-reader";

// getCalendarDays is the server-side read behind the calendar page: same
// session and range checks as listCalendarDaysAction, but "today" comes
// from the instant the page rendered with, so the today cell and the
// overdue folding agree. Session, database and Sentry are mocked.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

let reader: InMemoryDueTodayReader;
vi.mock("./infrastructure", () => ({
  DrizzleDueInRangeReader: class {
    listDueInRange(ownerId: string, from: Date, to: Date) {
      return reader.listDueInRange(ownerId, from, to);
    }
    listOverdueCounts(ownerId: string, before: Date) {
      return reader.listOverdueCounts(ownerId, before);
    }
  },
}));

import { listCalendarDaysAction } from "./actions";
import { getCalendarDays } from "./calendar-days";

// The page rendered at 23:59:59.999 UTC on Monday 12 Oct; by the time the
// read runs, the system clock is already Tuesday 13 Oct.
const RENDERED_AT = new Date("2026-10-12T23:59:59.999Z");
const SYSTEM_NOW = new Date("2026-10-13T00:00:00.500Z");
const WEEK = { fromDay: "2026-10-12", toDay: "2026-10-19", timeZone: "UTC" };

function seedOverdue() {
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
  reader.addItem({
    pageId: "p-1",
    kind: "flashcard",
    dueAt: new Date("2026-10-01T09:00:00.000Z"),
    suspended: false,
  });
}

describe("getCalendarDays", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SYSTEM_NOW);
    reader = new InMemoryDueTodayReader();
    getCurrentUser.mockReset();
    captureException.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("folds overdue items into the day of the given instant, not the system clock's", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    seedOverdue();

    const result = await getCalendarDays({ ...WEEK, now: RENDERED_AT });

    expect(result).toEqual({
      ok: true,
      value: [expect.objectContaining({ day: "2026-10-12", pageId: "p-1" })],
    });
  });

  it("requires a session", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await getCalendarDays({ ...WEEK, now: RENDERED_AT })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_SESSION_REQUIRED" }),
    });
  });

  it("rejects an invalid range without reading", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    const spy = vi.spyOn(reader, "listDueInRange");

    expect(
      await getCalendarDays({ ...WEEK, toDay: WEEK.fromDay, now: RENDERED_AT }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_INVALID_RANGE" }),
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("listCalendarDaysAction clock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SYSTEM_NOW);
    reader = new InMemoryDueTodayReader();
    getCurrentUser.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // The Server Action is client-reachable: it never takes a clock from its
  // input, so a forged `now` cannot move "today".
  it("ignores a client-supplied now and uses the system clock", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    seedOverdue();

    const result = await listCalendarDaysAction({
      ...WEEK,
      now: RENDERED_AT,
    } as typeof WEEK);

    expect(result).toEqual({
      ok: true,
      value: [expect.objectContaining({ day: "2026-10-13", pageId: "p-1" })],
    });
  });
});
