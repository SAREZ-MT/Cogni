import { describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import type { CalendarItem, OverdueCount } from "../domain/calendar";
import { listCalendarDays } from "./list-calendar-days";

// Monday 2026-10-12, 15:00 in Bogotá (UTC-5).
const NOW = new Date("2026-10-12T20:00:00.000Z");

const item = (pageId: string, dueAt: string): CalendarItem => ({
  pageId,
  pageTitle: `Página ${pageId}`,
  notebookId: "nb-1",
  notebookTitle: "Biología",
  kind: "flashcard",
  dueAt: new Date(dueAt),
});

function readerWith(items: CalendarItem[], overdue: OverdueCount[] = []) {
  return {
    listDueInRange: vi.fn().mockResolvedValue(items),
    listOverdueCounts: vi.fn().mockResolvedValue(overdue),
  };
}

describe("listCalendarDays", () => {
  it("reads a future range padded by the widest UTC offset, with no overdue counts", async () => {
    const reader = readerWith([]);

    await listCalendarDays(
      {
        ownerId: "owner-1",
        fromDay: "2026-10-19",
        toDay: "2026-10-26",
        timeZone: "America/Bogota",
      },
      { reader, clock: createFixedClock(NOW) },
    );

    expect(reader.listDueInRange).toHaveBeenCalledWith(
      "owner-1",
      new Date("2026-10-18T10:00:00.000Z"),
      new Date("2026-10-26T14:00:00.000Z"),
    );
    expect(reader.listOverdueCounts).not.toHaveBeenCalled();
  });

  it("keeps only the requested local days", async () => {
    const reader = readerWith([
      // 2026-10-18 23:00 in Bogotá: the day before the range.
      item("before", "2026-10-19T04:00:00.000Z"),
      item("first", "2026-10-19T05:00:00.000Z"),
      item("last", "2026-10-26T04:59:00.000Z"),
      // 2026-10-26 00:00 in Bogotá: the range end is exclusive.
      item("after", "2026-10-26T05:00:00.000Z"),
    ]);

    const days = await listCalendarDays(
      {
        ownerId: "owner-1",
        fromDay: "2026-10-19",
        toDay: "2026-10-26",
        timeZone: "America/Bogota",
      },
      { reader, clock: createFixedClock(NOW) },
    );

    expect(days.map((day) => [day.day, day.pageId])).toEqual([
      ["2026-10-19", "first"],
      ["2026-10-25", "last"],
    ]);
  });

  it("reads overdue items as counts when the range holds today, and shows them on today", async () => {
    const reader = readerWith(
      [
        // In the padded range but before today: still overdue.
        item("recent", "2026-10-01T12:00:00.000Z"),
        item("today", "2026-10-12T22:00:00.000Z"),
      ],
      [
        {
          pageId: "old",
          pageTitle: "Página old",
          notebookId: "nb-1",
          notebookTitle: "Biología",
          kind: "flashcard",
          count: 12,
          earliestDueAt: new Date("2025-01-01T00:00:00.000Z"),
        },
      ],
    );

    const days = await listCalendarDays(
      {
        ownerId: "owner-1",
        fromDay: "2026-09-28",
        toDay: "2026-11-02",
        timeZone: "America/Bogota",
      },
      { reader, clock: createFixedClock(NOW) },
    );

    // Items before the padded range are only counted, per page and
    // technique: the read is bounded by pages × techniques, not by history.
    expect(reader.listDueInRange).toHaveBeenCalledWith(
      "owner-1",
      new Date("2026-09-27T10:00:00.000Z"),
      new Date("2026-11-02T14:00:00.000Z"),
    );
    expect(reader.listOverdueCounts).toHaveBeenCalledWith(
      "owner-1",
      new Date("2026-09-27T10:00:00.000Z"),
    );
    expect(days.map((day) => [day.day, day.pageId, day.due.flashcard])).toEqual(
      [
        ["2026-10-12", "old", 12],
        ["2026-10-12", "recent", 1],
        ["2026-10-12", "today", 1],
      ],
    );
  });

  it("reads nothing for a range entirely in the past", async () => {
    const reader = readerWith([item("old", "2026-09-01T12:00:00.000Z")]);

    const days = await listCalendarDays(
      {
        ownerId: "owner-1",
        fromDay: "2026-09-01",
        toDay: "2026-10-12",
        timeZone: "America/Bogota",
      },
      { reader, clock: createFixedClock(NOW) },
    );

    expect(days).toEqual([]);
    expect(reader.listDueInRange).not.toHaveBeenCalled();
  });
});
