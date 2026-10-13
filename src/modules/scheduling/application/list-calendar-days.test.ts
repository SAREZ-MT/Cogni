import { describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import type { CalendarItem } from "../domain/calendar";
import { listCalendarDays } from "./list-calendar-days";

// Monday 2026-10-12, 15:00 in Bogotá (UTC-5).
const NOW = new Date("2026-10-12T20:00:00.000Z");

const item = (pageId: string, dueAt: string): CalendarItem => ({
  pageId,
  pageTitle: `Página ${pageId}`,
  notebookId: "nb-1",
  kind: "flashcard",
  dueAt: new Date(dueAt),
});

function readerWith(items: CalendarItem[]) {
  return { listDueInRange: vi.fn().mockResolvedValue(items) };
}

describe("listCalendarDays", () => {
  it("reads a future range padded by the widest UTC offset", async () => {
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

  it("reads overdue items too when the range holds today, and shows them on today", async () => {
    const reader = readerWith([
      item("overdue", "2026-10-01T12:00:00.000Z"),
      item("today", "2026-10-12T22:00:00.000Z"),
    ]);

    const days = await listCalendarDays(
      {
        ownerId: "owner-1",
        fromDay: "2026-09-28",
        toDay: "2026-11-02",
        timeZone: "America/Bogota",
      },
      { reader, clock: createFixedClock(NOW) },
    );

    expect(reader.listDueInRange).toHaveBeenCalledWith(
      "owner-1",
      new Date(0),
      new Date("2026-11-02T14:00:00.000Z"),
    );
    expect(days.map((day) => [day.day, day.pageId])).toEqual([
      ["2026-10-12", "overdue"],
      ["2026-10-12", "today"],
    ]);
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
