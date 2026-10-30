import { describe, expect, it, vi } from "vitest";

// The scheduling index also exports its Server Actions (server-only
// imports); this suite only uses its pure calendar helpers.
vi.mock("server-only", () => ({}));

import type { CalendarDayPageView } from "@/modules/scheduling";
import {
  calendarHref,
  dayView,
  monthDay,
  monthDayPanel,
  monthRange,
  monthView,
  nextSevenDays,
  parseCalendarQuery,
  weekOfMonth,
  weekRange,
  weekTechniqueProgress,
  weekView,
} from "./calendar-view";

const TODAY = "2026-10-12"; // Monday

const row = (
  day: string,
  pageId: string,
  due: Partial<CalendarDayPageView["due"]>,
): CalendarDayPageView => ({
  day,
  pageId,
  pageTitle: `Página ${pageId}`,
  notebookId: `nb-${pageId}`,
  notebookTitle: `Cuaderno ${pageId}`,
  due: { flashcard: 0, exam_question: 0, recall_question: 0, ...due },
});

describe("parseCalendarQuery", () => {
  it("defaults to Hoy anchored on today", () => {
    expect(parseCalendarQuery({}, TODAY)).toEqual({
      view: "hoy",
      anchor: TODAY,
    });
  });

  it("reads the view and an ISO date", () => {
    expect(
      parseCalendarQuery({ view: "mes", date: "2026-12-03" }, TODAY),
    ).toEqual({ view: "mes", anchor: "2026-12-03" });
    expect(parseCalendarQuery({ view: "semana" }, TODAY)).toEqual({
      view: "semana",
      anchor: TODAY,
    });
  });

  it("clamps a past day in Hoy to today, keeping future days", () => {
    expect(parseCalendarQuery({ date: "2026-10-01" }, TODAY)).toEqual({
      view: "hoy",
      anchor: TODAY,
    });
    expect(parseCalendarQuery({ date: "2026-10-14" }, TODAY).anchor).toBe(
      "2026-10-14",
    );
    // Mes and Semana still go back in time.
    expect(
      parseCalendarQuery({ view: "mes", date: "2026-09-01" }, TODAY).anchor,
    ).toBe("2026-09-01");
  });

  it("falls back on unknown views, malformed dates and repeated params", () => {
    expect(parseCalendarQuery({ view: "año" }, TODAY).view).toBe("hoy");
    expect(
      parseCalendarQuery({ view: "mes", date: "9999-12-32" }, TODAY).anchor,
    ).toBe(TODAY);
    expect(
      parseCalendarQuery({ view: "mes", date: "2026-02-30" }, TODAY).anchor,
    ).toBe(TODAY);
    expect(
      parseCalendarQuery({ view: ["mes", "semana"], date: ["x"] }, TODAY),
    ).toEqual({ view: "mes", anchor: TODAY });
  });

  // The grid math reads up to six weeks around the anchor; a far-future
  // date would overflow into expanded years (+010000-…), so only days of
  // the calendar window (1970-01-01 … 9998-12-31) are accepted.
  it("falls back to today for a date outside the calendar window", () => {
    for (const date of ["9999-12-31", "9999-01-01", "1969-12-31"]) {
      expect(parseCalendarQuery({ view: "mes", date }, TODAY).anchor).toBe(
        TODAY,
      );
    }
    for (const date of ["9998-12-31", "1970-01-01"]) {
      expect(parseCalendarQuery({ view: "mes", date }, TODAY).anchor).toBe(
        date,
      );
    }
  });

  it("builds well-formed views at the window's edges", () => {
    const month = monthView({ anchor: "9998-12-31", today: TODAY, days: [] });
    expect(month.title).toBe("Diciembre 9998");
    expect(month.nav.next.href).toBe("/calendario?view=mes&date=9999-01-01");
    expect(month.cells.at(-1)?.day).toBe("9999-01-03");
    const week = weekView({ anchor: "1970-01-01", today: TODAY, days: [] });
    expect(week.cells[0]?.day).toBe("1969-12-29");
    expect(weekRange("9998-12-31")).toEqual({
      fromDay: "9998-12-28",
      toDay: "9999-01-04",
    });
  });
});

describe("calendarHref", () => {
  it("keeps Hoy on the bare route and puts the date only when given", () => {
    expect(calendarHref("hoy")).toBe("/calendario");
    // A day other than today in Hoy (Phase 8 H3 day navigation).
    expect(calendarHref("hoy", "2026-10-14")).toBe(
      "/calendario?date=2026-10-14",
    );
    expect(calendarHref("mes")).toBe("/calendario?view=mes");
    expect(calendarHref("semana", "2026-10-14")).toBe(
      "/calendario?view=semana&date=2026-10-14",
    );
  });
});

describe("monthRange / weekRange", () => {
  it("covers the whole Monday-first month grid, end exclusive", () => {
    expect(monthRange("2026-10-20")).toEqual({
      fromDay: "2026-09-28",
      toDay: "2026-11-02",
    });
  });

  it("covers Monday to Sunday, end exclusive", () => {
    expect(weekRange("2026-10-15")).toEqual({
      fromDay: "2026-10-12",
      toDay: "2026-10-19",
    });
  });
});

describe("monthView", () => {
  it("titles the month, spans its range and links the neighbouring months", () => {
    const view = monthView({ anchor: "2026-10-20", today: TODAY, days: [] });

    expect(view.title).toBe("Octubre 2026");
    expect(view).not.toHaveProperty("rangeLabel");
    // Bare arrows only (Phase 8 H3): the tabs return to the current period.
    expect(view.nav).toEqual({
      prev: {
        href: "/calendario?view=mes&date=2026-09-01",
        label: "Mes anterior",
      },
      next: {
        href: "/calendario?view=mes&date=2026-11-01",
        label: "Mes siguiente",
      },
    });
  });

  it("shows the selected day in the badge", () => {
    expect(
      monthView({ anchor: "2026-10-20", today: TODAY, days: [] }).badgeDay,
    ).toBe("2026-10-20");
    expect(
      monthView({ anchor: "2026-11-01", today: TODAY, days: [] }).badgeDay,
    ).toBe("2026-11-01");
  });

  it("renders the empty grid with outside days greyed and today marked", () => {
    const view = monthView({ anchor: TODAY, today: TODAY, days: [] });

    expect(view.cells).toHaveLength(35);
    expect(view.cells[0]).toMatchObject({
      day: "2026-09-28",
      dayNumber: 28,
      label: "lunes, 28 de septiembre",
      outside: true,
      isToday: false,
      events: [],
    });
    const today = view.cells.find((cell) => cell.isToday);
    expect(today).toMatchObject({ day: TODAY, outside: false });
    expect(view.cells.filter((cell) => !cell.outside)).toHaveLength(31);
  });

  it("puts one technique-coloured event per page and technique on its day", () => {
    const view = monthView({
      anchor: TODAY,
      today: TODAY,
      days: [
        row("2026-10-14", "p1", {
          exam_question: 2,
          flashcard: 3,
          recall_question: 1,
        }),
      ],
    });

    const cell = view.cells.find((candidate) => candidate.day === "2026-10-14");
    expect(cell?.events).toEqual([
      {
        key: "p1:flashcard",
        tone: "yellow",
        techniqueLabel: "Flashcards",
        label: "Página p1",
        meta: "Cuaderno p1",
        href: "/notebooks/nb-p1/pages/p1",
        ariaLabel: "Flashcards de Página p1: 3 ítems",
      },
      {
        key: "p1:recall_question",
        tone: "green",
        techniqueLabel: "Recordación activa",
        label: "Página p1",
        meta: "Cuaderno p1",
        href: "/notebooks/nb-p1/pages/p1",
        ariaLabel: "Recordación activa de Página p1: 1 ítem",
      },
      {
        key: "p1:exam_question",
        tone: "rose",
        techniqueLabel: "Examen",
        label: "Página p1",
        meta: "Cuaderno p1",
        href: "/notebooks/nb-p1/pages/p1",
        ariaLabel: "Examen de Página p1: 2 ítems",
      },
    ]);
    expect(cell?.more).toBeUndefined();
  });

  it("caps a day at three events and links the rest to its week", () => {
    const view = monthView({
      anchor: TODAY,
      today: TODAY,
      days: [
        row("2026-10-16", "a", { flashcard: 1, exam_question: 1 }),
        row("2026-10-16", "b", { flashcard: 1, recall_question: 1 }),
        row("2026-10-16", "c", { exam_question: 4 }),
      ],
    });

    const cell = view.cells.find((candidate) => candidate.day === "2026-10-16");
    expect(cell?.events.map((event) => event.key)).toEqual([
      "a:flashcard",
      "a:exam_question",
      "b:flashcard",
    ]);
    expect(cell?.more).toEqual({
      count: 2,
      href: "/calendario?view=semana&date=2026-10-16",
    });
  });
});

describe("weekView", () => {
  it("lists every event of its seven days without a cap", () => {
    const view = weekView({
      anchor: "2026-10-15",
      today: TODAY,
      days: [
        row("2026-10-16", "a", { flashcard: 1, exam_question: 1 }),
        row("2026-10-16", "b", { flashcard: 1, recall_question: 1 }),
        row("2026-10-20", "late", { flashcard: 1 }),
      ],
    });

    expect(view.title).toBe("12 – 18 de octubre");
    expect(view).not.toHaveProperty("rangeLabel");
    expect(view.cells.map((cell) => cell.day)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(view.cells.map((cell) => cell.weekday)).toEqual([
      "Lun",
      "Mar",
      "Mié",
      "Jue",
      "Vie",
      "Sáb",
      "Dom",
    ]);
    const friday = view.cells[4];
    expect(friday?.events).toHaveLength(4);
    expect(friday?.more).toBeUndefined();
    expect(view.cells.every((cell) => !cell.outside)).toBe(true);
    expect(view.cells[0]?.isToday).toBe(true);
  });

  it("links the neighbouring weeks", () => {
    const view = weekView({ anchor: "2026-10-15", today: TODAY, days: [] });
    expect(view.nav).toEqual({
      prev: {
        href: "/calendario?view=semana&date=2026-10-05",
        label: "Semana anterior",
      },
      next: {
        href: "/calendario?view=semana&date=2026-10-19",
        label: "Semana siguiente",
      },
    });
  });

  it("shows today in the badge on the current week, else the week's Monday", () => {
    expect(
      weekView({ anchor: "2026-10-15", today: TODAY, days: [] }).badgeDay,
    ).toBe(TODAY);
    expect(
      weekView({ anchor: "2026-10-22", today: TODAY, days: [] }).badgeDay,
    ).toBe("2026-10-19");
  });

  it("puts the week of the month over the range", () => {
    expect(
      weekView({ anchor: "2026-10-21", today: TODAY, days: [] }).overline,
    ).toBe("Semana 4");
    expect(
      weekView({ anchor: "2026-10-01", today: TODAY, days: [] }).overline,
    ).toBe("Semana 1");
  });

  it("titles a week across months by both months, with the year only outside the current one", () => {
    expect(
      weekView({ anchor: "2026-10-01", today: TODAY, days: [] }).title,
    ).toBe("28 de septiembre – 4 de octubre");
    expect(
      weekView({ anchor: "2027-01-06", today: TODAY, days: [] }).title,
    ).toBe("4 – 10 de enero de 2027");
    expect(
      weekView({ anchor: "2027-02-01", today: TODAY, days: [] }).title,
    ).toBe("1 – 7 de febrero de 2027");
    expect(
      weekView({ anchor: "2026-12-30", today: TODAY, days: [] }).title,
    ).toBe("28 de diciembre de 2026 – 3 de enero de 2027");
  });
});

describe("dayView", () => {
  it("titles today Hoy and blocks going back before it", () => {
    expect(dayView({ anchor: TODAY, today: TODAY })).toEqual({
      title: "Hoy",
      isToday: true,
      nav: {
        prev: {
          href: "/calendario?date=2026-10-11",
          label: "Día anterior",
          disabled: true,
        },
        next: { href: "/calendario?date=2026-10-13", label: "Día siguiente" },
      },
      badgeDay: TODAY,
    });
  });

  it("titles a later day by its long name and links back towards today", () => {
    expect(dayView({ anchor: "2026-10-13", today: TODAY })).toEqual({
      title: "Martes 13 de octubre",
      isToday: false,
      nav: {
        prev: { href: "/calendario", label: "Día anterior" },
        next: { href: "/calendario?date=2026-10-14", label: "Día siguiente" },
      },
      // The badge follows the shown day.
      badgeDay: "2026-10-13",
    });
    expect(dayView({ anchor: "2026-10-20", today: TODAY }).nav.prev.href).toBe(
      "/calendario?date=2026-10-19",
    );
  });
});

describe("weekTechniqueProgress", () => {
  const reviews = (flashcards: number, recall: number, exam: number) => ({
    flashcards,
    recall,
    exam,
  });

  it("sets each technique's completed reviews against those plus the items still due", () => {
    const progress = weekTechniqueProgress({
      days: [
        row("2026-10-12", "a", { flashcard: 2, exam_question: 1 }),
        row("2026-10-14", "b", { flashcard: 1 }),
      ],
      daily: [
        { day: "2026-10-12", reviews: reviews(1, 0, 0) },
        { day: "2026-10-13", reviews: reviews(1, 0, 3) },
      ],
    });
    expect(progress).toEqual([
      {
        tone: "yellow",
        label: "Flashcards",
        done: 2,
        total: 5,
        percent: 40,
      },
      // Always all three techniques, in the panel's order (one ring each).
      {
        tone: "green",
        label: "Recordación activa",
        done: 0,
        total: 0,
        percent: 0,
      },
      { tone: "rose", label: "Examen", done: 3, total: 4, percent: 75 },
    ]);
  });

  it("reads zero for a week with nothing done or due, and null without the reviews", () => {
    const empty = weekTechniqueProgress({ days: [], daily: [] });
    expect(empty?.map(({ total, percent }) => [total, percent])).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    expect(
      weekTechniqueProgress({
        days: [row("2026-10-12", "a", { flashcard: 1 })],
        daily: null,
      }),
    ).toBeNull();
  });
});

describe("month selection", () => {
  it("selects the anchor day, today on the bare route", () => {
    const view = monthView({ anchor: TODAY, today: TODAY, days: [] });
    expect(view.selected).toBe(TODAY);
    expect(view.badgeDay).toBe(TODAY);
    const selected = view.cells.filter((cell) => cell.isSelected);
    expect(selected.map((cell) => cell.day)).toEqual([TODAY]);
    expect(
      monthView({ anchor: "2026-10-20", today: TODAY, days: [] }).selected,
    ).toBe("2026-10-20");
  });

  it("makes every in-month day selectable through the URL, never an outside day", () => {
    const view = monthView({ anchor: TODAY, today: TODAY, days: [] });
    const day20 = view.cells.find((cell) => cell.day === "2026-10-20");
    expect(day20?.selectHref).toBe("/calendario?view=mes&date=2026-10-20");
    const outside = view.cells.find((cell) => cell.day === "2026-09-28");
    expect(outside?.selectHref).toBeUndefined();
  });

  it("lands the month arrows on today in the current month, else the 1st", () => {
    expect(
      monthView({ anchor: "2026-09-10", today: TODAY, days: [] }).nav.next.href,
    ).toBe("/calendario?view=mes&date=2026-10-12");
    expect(
      monthView({ anchor: "2026-11-10", today: TODAY, days: [] }).nav.next.href,
    ).toBe("/calendario?view=mes&date=2026-12-01");
  });

  it("keeps a day in its month, else falls back to the month's default", () => {
    expect(monthDay("2026-10-01", "2026-10-20", TODAY)).toBe("2026-10-20");
    // Outside October: today when today is in it, else the 1st.
    expect(monthDay("2026-10-01", "2026-11-03", TODAY)).toBe(TODAY);
    expect(monthDay("2026-11-01", "2026-10-03", TODAY)).toBe("2026-11-01");
  });
});

describe("nextSevenDays", () => {
  it("covers the seven days after the selected one, across a month boundary", () => {
    expect(nextSevenDays("2026-10-28")).toEqual({
      fromDay: "2026-10-29",
      toDay: "2026-11-05",
    });
  });
});

describe("monthDayPanel", () => {
  it("names the selected day and lists its reviews, then the next seven days flat", () => {
    const panel = monthDayPanel({
      selected: "2026-10-20",
      days: [
        row("2026-10-20", "a", { exam_question: 2 }),
        row("2026-10-19", "past", { flashcard: 1 }),
      ],
      window: [
        row("2026-10-22", "b", { flashcard: 1, recall_question: 1 }),
        row("2026-10-21", "c", { exam_question: 1 }),
        row("2026-10-27", "d", { flashcard: 1 }),
        // Beyond day + 7 (and the selected day itself) never show.
        row("2026-10-28", "late", { flashcard: 1 }),
        row("2026-10-20", "a", { exam_question: 2 }),
      ],
    });
    expect(panel.title).toBe("Martes 20 de octubre");
    expect(panel.summary).toBe("1 repaso programado");
    expect(panel.rows).toEqual([
      {
        key: "2026-10-20:a:exam_question",
        tone: "rose",
        techniqueLabel: "Examen",
        title: "Página a",
        detail: "Cuaderno a",
        href: "/notebooks/nb-a/pages/a",
        ariaLabel: "Examen de Página a: 2 ítems",
      },
    ]);
    expect(panel.upcoming.map((item) => item.key)).toEqual([
      "2026-10-21:c:exam_question",
      "2026-10-22:b:flashcard",
      "2026-10-22:b:recall_question",
      "2026-10-27:d:flashcard",
    ]);
  });

  it("says when the day and the next week are empty", () => {
    const panel = monthDayPanel({
      selected: "2026-10-20",
      days: [],
      window: [],
    });
    expect(panel.summary).toBe("Sin repasos");
    expect(panel.rows).toEqual([]);
    expect(panel.upcoming).toEqual([]);
  });
});

describe("weekOfMonth", () => {
  // A week belongs to the month holding its Thursday (ISO-style); X counts
  // that month's Monday-based week rows.
  it.each([
    ["2026-10-19", "2026-10", 4], // Thu 22 Oct
    ["2026-09-28", "2026-10", 1], // Thu 1 Oct: first week of October
    ["2026-10-26", "2026-10", 5], // Thu 29 Oct
    ["2026-11-02", "2026-11", 1], // Thu 5 Nov
    ["2026-08-31", "2026-09", 1], // Thu 3 Sep
    ["2026-12-28", "2026-12", 5], // Thu 31 Dec, spans into January
    ["2027-03-29", "2027-04", 1], // Thu 1 Apr
  ])("the week of Monday %s is week %s/%i", (monday, month, week) => {
    expect(weekOfMonth(monday)).toEqual({ month, week });
  });
});
