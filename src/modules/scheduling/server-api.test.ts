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
const calls: Array<{ ownerId: string; now: Date }> = [];
vi.mock("./infrastructure", () => ({
  DrizzleDueTodayReader: vi.fn(function DrizzleDueTodayReader() {
    return {
      async listDueToday(ownerId: string, now: Date) {
        calls.push({ ownerId, now });
        return [ROW];
      },
    };
  }),
}));

import { createSchedulingServerApi } from "./server-api";

describe("createSchedulingServerApi", () => {
  it("lists the owner's pages with items due at the clock's now", async () => {
    const api = createSchedulingServerApi({
      db: {} as never,
      clock: createFixedClock(NOW),
    });

    await expect(api.listDueToday("owner-1")).resolves.toEqual([ROW]);
    expect(calls).toEqual([{ ownerId: "owner-1", now: NOW }]);
  });
});
