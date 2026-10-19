import { describe, expect, it, vi } from "vitest";

// The scheduling index also exports its Server Actions (server-only
// imports); this suite only uses its pure calendar helpers.
vi.mock("server-only", () => ({}));

import type { CalendarDayPageView } from "@/modules/scheduling";
import {
  calendarHref,
  monthRange,
  monthView,
  parseCalendarQuery,
  weekRange,
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
    expect(view.rangeLabel).toBe("1 oct 2026 – 31 oct 2026");
    expect(view.nav).toEqual({
      prev: {
        href: "/calendario?view=mes&date=2026-09-01",
        label: "Mes anterior",
      },
      today: { href: "/calendario?view=mes", label: "Hoy" },
      next: {
        href: "/calendario?view=mes&date=2026-11-01",
        label: "Mes siguiente",
      },
    });
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
        label: "Página p1",
        meta: "3",
        href: "/notebooks/nb-p1/pages/p1",
        ariaLabel: "Flashcards de Página p1: 3 ítems",
      },
      {
        key: "p1:recall_question",
        tone: "green",
        label: "Página p1",
        meta: "1",
        href: "/notebooks/nb-p1/pages/p1",
        ariaLabel: "Recordación activa de Página p1: 1 ítem",
      },
      {
        key: "p1:exam_question",
        tone: "rose",
        label: "Página p1",
        meta: "2",
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

    expect(view.title).toBe("Semana del 12 de octubre");
    expect(view.rangeLabel).toBe("12 oct 2026 – 18 oct 2026");
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
      today: { href: "/calendario?view=semana", label: "Hoy" },
      next: {
        href: "/calendario?view=semana&date=2026-10-19",
        label: "Semana siguiente",
      },
    });
  });

  it("names a week across months and years by both ends", () => {
    const view = weekView({ anchor: "2026-12-30", today: TODAY, days: [] });
    expect(view.title).toBe("Semana del 28 de diciembre");
    expect(view.rangeLabel).toBe("28 dic 2026 – 3 ene 2027");
  });
});
