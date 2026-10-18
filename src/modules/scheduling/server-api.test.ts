import { describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import type { DueTodayPage } from "./domain/due-today";

// createSchedulingServerApi composes listDueToday with the Drizzle reader;
// the reader is swapped for a recording double so this proves the wiring
// (owner, injected clock) without a database.
const NOW = new Date("2026-10-06T08:00:00.000Z");
const ROW: DueTodayPage = {
  pageId: "page-1",
  pageTitle: "Mitocondria",
  notebookId: "nb-1",
  notebookTitle: "Biología",
  notebookColor: "green",
  due: { flashcard: 0, exam_question: 3, recall_question: 0 },
  earliestDueAt: NOW,
};
const calls: Array<{ ownerId: string; dueBefore: Date }> = [];
const rangeCalls: Array<{ ownerId: string; from: Date; to: Date }> = [];
const overdueCalls: Array<{ ownerId: string; before: Date }> = [];
vi.mock("./infrastructure", () => ({
  DrizzleDueInRangeReader: vi.fn(function DrizzleDueInRangeReader() {
    return {
      async listDueInRange(ownerId: string, from: Date, to: Date) {
        rangeCalls.push({ ownerId, from, to });
        return [
          {
            pageId: "page-1",
            pageTitle: "Mitocondria",
            notebookId: "nb-1",
            kind: "recall_question",
            dueAt: new Date("2026-10-08T15:00:00.000Z"),
          },
        ];
      },
      async listOverdueCounts(ownerId: string, before: Date) {
        overdueCalls.push({ ownerId, before });
        return [];
      },
    };
  }),
  DrizzleDueTodayReader: vi.fn(function DrizzleDueTodayReader() {
    return {
      async listDueToday(ownerId: string, dueBefore: Date) {
        calls.push({ ownerId, dueBefore });
        return [ROW];
      },
    };
  }),
}));

import { createSchedulingServerApi } from "./server-api";

describe("createSchedulingServerApi", () => {
  it("lists the owner's pages with items due during the clock's local day", async () => {
    const api = createSchedulingServerApi({
      db: {} as never,
      clock: createFixedClock(NOW),
    });

    // 08:00Z is 03:00 in Bogotá (-05): the local day ends at 7 Oct 05:00Z.
    await expect(
      api.listDueToday("owner-1", { timeZone: "America/Bogota" }),
    ).resolves.toEqual([ROW]);
    expect(calls).toEqual([
      { ownerId: "owner-1", dueBefore: new Date("2026-10-07T05:00:00.000Z") },
    ]);
  });

  it("lists the owner's calendar days at the clock's now", async () => {
    const api = createSchedulingServerApi({
      db: {} as never,
      clock: createFixedClock(NOW),
    });

    await expect(
      api.listCalendarDays("owner-1", {
        fromDay: "2026-10-05",
        toDay: "2026-10-12",
        timeZone: "UTC",
      }),
    ).resolves.toEqual([
      {
        day: "2026-10-08",
        pageId: "page-1",
        pageTitle: "Mitocondria",
        notebookId: "nb-1",
        due: { flashcard: 0, exam_question: 0, recall_question: 1 },
      },
    ]);
    // The range holds today (NOW), so overdue items are counted too.
    expect(rangeCalls).toEqual([
      {
        ownerId: "owner-1",
        from: new Date("2026-10-04T10:00:00.000Z"),
        to: new Date("2026-10-12T14:00:00.000Z"),
      },
    ]);
    expect(overdueCalls).toEqual([
      { ownerId: "owner-1", before: new Date("2026-10-04T10:00:00.000Z") },
    ]);
  });
});
