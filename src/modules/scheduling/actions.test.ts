import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryDueTodayReader } from "./application/testing/in-memory-due-today-reader";

// Session, database and Sentry are mocked so this proves the Server Action
// boundary (session first, owner scoping, never throws) without Postgres;
// the reader itself is covered by its shared contract.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

let reader: InMemoryDueTodayReader;
vi.mock("./infrastructure", () => ({
  DrizzleDueTodayReader: class {
    listDueToday(ownerId: string, now: Date) {
      return reader.listDueToday(ownerId, now);
    }
  },
  DrizzleDueInRangeReader: class {
    listDueInRange(ownerId: string, from: Date, to: Date) {
      return reader.listDueInRange(ownerId, from, to);
    }
  },
}));

import { listCalendarDaysAction, listDueTodayAction } from "./actions";

const NOW = new Date("2026-10-04T12:00:00.000Z");

function seedPage(id: string, ownerId: string, dueAt: Date) {
  reader.addNotebook({
    id: `nb-${id}`,
    ownerId,
    title: "Biología",
    color: "green",
  });
  reader.addPage({ id, ownerId, notebookId: `nb-${id}`, title: "Mitosis" });
  reader.addItem({ pageId: id, kind: "flashcard", dueAt, suspended: false });
}

describe("listDueTodayAction", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    reader = new InMemoryDueTodayReader();
    getCurrentUser.mockReset();
    captureException.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires a session", async () => {
    getCurrentUser.mockResolvedValue(null);
    const result = await listDueTodayAction();
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_SESSION_REQUIRED" }),
    });
  });

  it("lists only the caller's pages with items due at or before now", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    seedPage("p-due", "owner-1", new Date(NOW.getTime() - 1000));
    seedPage("p-later", "owner-1", new Date(NOW.getTime() + 1000));
    seedPage("p-other", "owner-2", new Date(NOW.getTime() - 1000));

    const result = await listDueTodayAction();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((page) => page.pageId)).toEqual(["p-due"]);
    expect(result.value[0]).toMatchObject({
      pageTitle: "Mitosis",
      notebookId: "nb-p-due",
      notebookTitle: "Biología",
      due: { flashcard: 1, exam_question: 0, recall_question: 0 },
    });
  });

  it("never throws: an infrastructure failure becomes an ActionError", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    vi.spyOn(reader, "listDueToday").mockRejectedValue(new Error("db down"));

    const result = await listDueTodayAction();

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_UNEXPECTED" }),
    });
    expect(captureException).toHaveBeenCalled();
  });
});

describe("listCalendarDaysAction", () => {
  const WEEK = {
    fromDay: "2026-10-05",
    toDay: "2026-10-12",
    timeZone: "UTC",
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Thursday 2026-10-01: the week above lies in the future.
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    reader = new InMemoryDueTodayReader();
    getCurrentUser.mockReset();
    captureException.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires a session", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await listCalendarDaysAction(WEEK)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_SESSION_REQUIRED" }),
    });
  });

  it("lists the caller's pages per local day in the range", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    seedPage("p-in", "owner-1", new Date("2026-10-07T09:00:00.000Z"));
    seedPage("p-out", "owner-1", new Date("2026-10-12T09:00:00.000Z"));
    seedPage("p-other", "owner-2", new Date("2026-10-07T09:00:00.000Z"));

    expect(await listCalendarDaysAction(WEEK)).toEqual({
      ok: true,
      value: [
        {
          day: "2026-10-07",
          pageId: "p-in",
          pageTitle: "Mitosis",
          notebookId: "nb-p-in",
          due: { flashcard: 1, exam_question: 0, recall_question: 0 },
        },
      ],
    });
  });

  it.each([
    ["a malformed day", { ...WEEK, fromDay: "2026-10-5" }],
    ["an impossible day", { ...WEEK, toDay: "2026-02-30" }],
    ["an empty range", { ...WEEK, toDay: WEEK.fromDay }],
    ["a range over 6 weeks", { ...WEEK, toDay: "2026-11-17" }],
    ["an unknown zone", { ...WEEK, timeZone: "Mars/Olympus" }],
    [
      "a range past the calendar window",
      { ...WEEK, fromDay: "9999-01-04", toDay: "9999-01-11" },
    ],
    [
      "a range before the calendar window",
      { ...WEEK, fromDay: "1969-12-22", toDay: "1969-12-29" },
    ],
  ])("rejects %s without reading", async (_label, input) => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    const spy = vi.spyOn(reader, "listDueInRange");

    expect(await listCalendarDaysAction(input)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_INVALID_RANGE" }),
    });
    expect(spy).not.toHaveBeenCalled();
  });

  // The month grids of the calendar window's edge months reach past it
  // (1969-12-29, 9999-01-03); a range is valid while it holds a window day.
  it.each([
    [
      "the first window month",
      { ...WEEK, fromDay: "1969-12-29", toDay: "1970-02-02" },
    ],
    [
      "the last window month",
      { ...WEEK, fromDay: "9998-11-30", toDay: "9999-01-04" },
    ],
  ])("accepts the grid of %s", async (_label, input) => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });

    expect(await listCalendarDaysAction(input)).toEqual({
      ok: true,
      value: [],
    });
  });

  it("never throws: an infrastructure failure becomes an ActionError", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    vi.spyOn(reader, "listDueInRange").mockRejectedValue(new Error("db down"));

    expect(await listCalendarDaysAction(WEEK)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_UNEXPECTED" }),
    });
    expect(captureException).toHaveBeenCalled();
  });
});
