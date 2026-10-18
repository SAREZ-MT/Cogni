import { describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import type { DueTodayPage } from "../domain/due-today";
import { listDueToday } from "./list-due-today";
import { InMemoryDueTodayReader } from "./testing/in-memory-due-today-reader";

const ROW: DueTodayPage = {
  pageId: "p1",
  pageTitle: "Mitosis",
  notebookId: "n1",
  notebookTitle: "Biología",
  notebookColor: "green",
  due: { flashcard: 3, exam_question: 0, recall_question: 0 },
  earliestDueAt: new Date("2026-10-03T08:00:00.000Z"),
};

// Bogotá is UTC-5 all year: 12:00Z on 4 Oct is 07:00 local, and the local
// day ends at 5 Oct 05:00Z.
const NOW = new Date("2026-10-04T12:00:00.000Z");
const ZONE = "America/Bogota";

function seededReader(dueAts: Date[]): InMemoryDueTodayReader {
  const reader = new InMemoryDueTodayReader();
  reader.addNotebook({
    id: "n1",
    ownerId: "owner-1",
    title: "Biología",
    color: "green",
  });
  reader.addPage({
    id: "p1",
    ownerId: "owner-1",
    notebookId: "n1",
    title: "Mitosis",
  });
  for (const dueAt of dueAts) {
    reader.addItem({
      pageId: "p1",
      kind: "flashcard",
      dueAt,
      suspended: false,
    });
  }
  return reader;
}

describe("listDueToday", () => {
  it("bounds the read at the start of tomorrow in the owner's zone", async () => {
    const reader = { listDueToday: vi.fn().mockResolvedValue([ROW]) };

    const result = await listDueToday(
      { ownerId: "owner-1", timeZone: ZONE },
      { reader, clock: createFixedClock(NOW) },
    );

    expect(reader.listDueToday).toHaveBeenCalledWith(
      "owner-1",
      new Date("2026-10-05T05:00:00.000Z"),
    );
    expect(result).toEqual([ROW]);
  });

  it("counts an item due later today: the whole local day is review time", async () => {
    // 21:00 local, fourteen hours after now.
    const reader = seededReader([new Date("2026-10-05T02:00:00.000Z")]);

    const rows = await listDueToday(
      { ownerId: "owner-1", timeZone: ZONE },
      { reader, clock: createFixedClock(NOW) },
    );

    expect(rows.map((row) => row.due.flashcard)).toEqual([1]);
  });

  it("leaves out an item due tomorrow at 00:30 local", async () => {
    const reader = seededReader([new Date("2026-10-05T05:30:00.000Z")]);

    expect(
      await listDueToday(
        { ownerId: "owner-1", timeZone: ZONE },
        { reader, clock: createFixedClock(NOW) },
      ),
    ).toEqual([]);
  });

  it("keeps the 25-hour local day whole when the clocks fall back", async () => {
    // Madrid falls back on 25 Oct 2026; 23:30 local (+01) is 22:30Z and
    // still that day, 00:30 on 26 Oct is 23:30Z.
    const reader = seededReader([
      new Date("2026-10-25T22:30:00.000Z"),
      new Date("2026-10-25T23:30:00.000Z"),
    ]);

    const rows = await listDueToday(
      { ownerId: "owner-1", timeZone: "Europe/Madrid" },
      {
        reader,
        clock: createFixedClock(new Date("2026-10-25T08:00:00.000Z")),
      },
    );

    expect(rows.map((row) => row.due.flashcard)).toEqual([1]);
  });
});
