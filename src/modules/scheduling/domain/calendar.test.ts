import { describe, expect, it } from "vitest";
import {
  addDays,
  type CalendarItem,
  dayKeyIn,
  groupCalendarDays,
  isDayKey,
  isTimeZone,
  monthGridDays,
  monthOf,
  paddedRange,
  weekDays,
  weekdayIndex,
} from "./calendar";

describe("isDayKey", () => {
  it("accepts real ISO calendar days only", () => {
    expect(isDayKey("2026-10-12")).toBe(true);
    expect(isDayKey("2028-02-29")).toBe(true);
    expect(isDayKey("2026-02-29")).toBe(false);
    expect(isDayKey("2026-13-01")).toBe(false);
    expect(isDayKey("2026-1-01")).toBe(false);
    expect(isDayKey("2026-10-12T00:00")).toBe(false);
    expect(isDayKey(20261012)).toBe(false);
    expect(isDayKey(null)).toBe(false);
  });
});

describe("isTimeZone", () => {
  it("accepts names Intl can format in and rejects the rest", () => {
    expect(isTimeZone("America/Bogota")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Not/AZone")).toBe(false);
    expect(isTimeZone("")).toBe(false);
    expect(isTimeZone(42)).toBe(false);
  });
});

describe("addDays", () => {
  it("moves across month, year and leap-day boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-10-12", -42)).toBe("2026-08-31");
    expect(addDays("2026-10-12", 0)).toBe("2026-10-12");
  });
});

describe("weekdayIndex", () => {
  it("counts from Monday (0) to Sunday (6)", () => {
    expect(weekdayIndex("2026-10-12")).toBe(0); // Monday
    expect(weekdayIndex("2026-10-17")).toBe(5); // Saturday
    expect(weekdayIndex("2026-10-18")).toBe(6); // Sunday
  });
});

describe("weekDays", () => {
  it("lists Monday to Sunday of the week holding the day", () => {
    expect(weekDays("2026-10-15")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(weekDays("2026-10-18")[0]).toBe("2026-10-12");
    expect(weekDays("2026-11-01")[0]).toBe("2026-10-26");
  });
});

describe("monthOf", () => {
  it("returns the month's first day and its number of days", () => {
    expect(monthOf("2026-10-12")).toEqual({ first: "2026-10-01", days: 31 });
    expect(monthOf("2028-02-10")).toEqual({ first: "2028-02-01", days: 29 });
  });
});

describe("monthGridDays", () => {
  it("covers the month in whole Monday-first weeks", () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const days = monthGridDays("2026-10-12");
    expect(days).toHaveLength(35);
    expect(days[0]).toBe("2026-09-28");
    expect(days.at(-1)).toBe("2026-11-01");
  });

  it("adds a sixth week when the month needs it", () => {
    // August 2026 starts on a Saturday and has 31 days.
    const days = monthGridDays("2026-08-20");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-07-27");
    expect(days.at(-1)).toBe("2026-09-06");
  });

  it("needs no leading days when the month starts on a Monday", () => {
    // February 2027 starts on a Monday and has 28 days: exactly four weeks.
    const days = monthGridDays("2027-02-14");
    expect(days).toHaveLength(28);
    expect(days[0]).toBe("2027-02-01");
    expect(days.at(-1)).toBe("2027-02-28");
  });
});

describe("dayKeyIn", () => {
  it("reads the calendar day of an instant in the given zone", () => {
    const instant = new Date("2026-10-12T03:30:00.000Z");
    expect(dayKeyIn(instant, "UTC")).toBe("2026-10-12");
    expect(dayKeyIn(instant, "America/Bogota")).toBe("2026-10-11");
    expect(
      dayKeyIn(new Date("2026-10-12T10:30:00.000Z"), "Pacific/Kiritimati"),
    ).toBe("2026-10-13");
  });
});

describe("paddedRange", () => {
  it("pads the days' UTC midnights by the widest UTC offset (14 h)", () => {
    expect(paddedRange("2026-10-12", "2026-10-19")).toEqual({
      from: new Date("2026-10-11T10:00:00.000Z"),
      to: new Date("2026-10-19T14:00:00.000Z"),
    });
  });
});

const item = (
  pageId: string,
  dueAt: string,
  kind: CalendarItem["kind"] = "flashcard",
): CalendarItem => ({
  pageId,
  pageTitle: `Página ${pageId}`,
  notebookId: `nb-${pageId}`,
  kind,
  dueAt: new Date(dueAt),
});

describe("groupCalendarDays", () => {
  it("groups items by local day and page with counts per technique", () => {
    const days = groupCalendarDays(
      [
        item("p1", "2026-10-14T15:00:00.000Z"),
        item("p1", "2026-10-14T16:00:00.000Z", "exam_question"),
        item("p1", "2026-10-14T17:00:00.000Z"),
        item("p2", "2026-10-15T09:00:00.000Z", "recall_question"),
      ],
      { timeZone: "UTC", today: "2026-10-12" },
    );

    expect(days).toEqual([
      {
        day: "2026-10-14",
        pageId: "p1",
        pageTitle: "Página p1",
        notebookId: "nb-p1",
        due: { flashcard: 2, exam_question: 1, recall_question: 0 },
      },
      {
        day: "2026-10-15",
        pageId: "p2",
        pageTitle: "Página p2",
        notebookId: "nb-p2",
        due: { flashcard: 0, exam_question: 0, recall_question: 1 },
      },
    ]);
  });

  it("buckets by the zone's day, not UTC's", () => {
    const days = groupCalendarDays([item("p1", "2026-10-15T02:00:00.000Z")], {
      timeZone: "America/Bogota",
      today: "2026-10-12",
    });
    expect(days.map((day) => day.day)).toEqual(["2026-10-14"]);
  });

  it("splits one page's items across the days they fall on", () => {
    const days = groupCalendarDays(
      [
        item("p1", "2026-10-14T10:00:00.000Z"),
        item("p1", "2026-10-16T10:00:00.000Z"),
      ],
      { timeZone: "UTC", today: "2026-10-12" },
    );
    expect(days.map((day) => [day.day, day.pageId])).toEqual([
      ["2026-10-14", "p1"],
      ["2026-10-16", "p1"],
    ]);
  });

  it("folds overdue items into today, where they are still pending", () => {
    const days = groupCalendarDays(
      [
        item("p1", "2026-10-09T10:00:00.000Z"),
        item("p1", "2026-10-12T20:00:00.000Z"),
        item("p2", "2026-10-11T10:00:00.000Z", "exam_question"),
      ],
      { timeZone: "UTC", today: "2026-10-12" },
    );
    expect(days.map((day) => [day.day, day.pageId, day.due])).toEqual([
      [
        "2026-10-12",
        "p1",
        { flashcard: 2, exam_question: 0, recall_question: 0 },
      ],
      [
        "2026-10-12",
        "p2",
        { flashcard: 0, exam_question: 1, recall_question: 0 },
      ],
    ]);
  });

  it("orders pages within a day by their earliest item, then page id", () => {
    const days = groupCalendarDays(
      [
        item("b", "2026-10-14T12:00:00.000Z"),
        item("c", "2026-10-14T08:00:00.000Z"),
        item("a", "2026-10-14T12:00:00.000Z"),
      ],
      { timeZone: "UTC", today: "2026-10-12" },
    );
    expect(days.map((day) => day.pageId)).toEqual(["c", "a", "b"]);
  });

  it("returns nothing for no items", () => {
    expect(
      groupCalendarDays([], { timeZone: "UTC", today: "2026-10-12" }),
    ).toEqual([]);
  });
});
