import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb, BreadcrumbProvider } from "../_components/breadcrumb";

vi.mock("server-only", () => ({}));
const {
  getDueToday,
  listCalendarDaysAction,
  getCalendarDays,
  getTechniqueOverview,
  getDashboardTechniqueMetrics,
} = vi.hoisted(() => ({
  getDueToday: vi.fn(),
  listCalendarDaysAction: vi.fn(),
  getCalendarDays: vi.fn(),
  getTechniqueOverview: vi.fn(),
  getDashboardTechniqueMetrics: vi.fn(),
}));
// The pure calendar helpers stay real; only the reads are faked.
vi.mock("@/modules/scheduling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/scheduling")>()),
  getDueToday,
  listCalendarDaysAction,
  getCalendarDays,
  getTechniqueOverview,
}));
vi.mock("@/modules/analytics", () => ({ getDashboardTechniqueMetrics }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const totals = (doneUnits: number, pendingUnits: number) => ({
  total: 0,
  nextDueAt: null,
  doneUnits,
  pendingUnits,
});

const { getCurrentTimeZoneSetting } = vi.hoisted(() => ({
  getCurrentTimeZoneSetting: vi.fn(),
}));
vi.mock("@/modules/identity", () => ({ getCurrentTimeZoneSetting }));
vi.mock("@/modules/notebooks", () => ({
  COLOR_PALETTE: [
    "pink",
    "green",
    "yellow",
    "purple",
    "orange",
    "blue",
    "mint",
  ],
}));

import CalendarPage from "./page";

function due(pageId: string, flashcard: number, recall = 0) {
  return {
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId: "n1",
    notebookTitle: "Biología",
    notebookColor: "green",
    due: { flashcard, exam_question: 0, recall_question: recall },
    earliestDueAt: new Date("2026-10-12T08:00:00.000Z"),
  };
}

async function renderPage(params: { view?: string; date?: string } = {}) {
  const element = (await CalendarPage({
    searchParams: Promise.resolve(params),
  })) as ReactElement;
  return render(
    <BreadcrumbProvider>
      {element}
      <Breadcrumb />
    </BreadcrumbProvider>,
  );
}

describe("CalendarPage", () => {
  beforeEach(() => {
    getDueToday.mockReset();
    getDueToday.mockResolvedValue({ ok: true, value: [] });
    listCalendarDaysAction.mockReset();
    getCalendarDays.mockReset();
    getCalendarDays.mockResolvedValue({ ok: true, value: [] });
    getTechniqueOverview.mockReset();
    getTechniqueOverview.mockResolvedValue({
      ok: true,
      value: {
        flashcard: totals(1, 1),
        recall_question: totals(0, 1),
        exam_question: totals(0, 0),
      },
    });
    getDashboardTechniqueMetrics.mockReset();
    getDashboardTechniqueMetrics.mockResolvedValue({
      ok: true,
      value: {
        daily: [
          {
            day: "2026-11-02",
            reviews: { flashcards: 3, recall: 1, exam: 0 },
          },
        ],
      },
    });
    getCurrentTimeZoneSetting.mockReset();
    getCurrentTimeZoneSetting.mockResolvedValue({
      timeZone: "UTC",
      chosen: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Phase 7 T2a: the date in the card header is read in the profile time
  // zone. 12:00 UTC on 12 Oct is already 13 Oct in Kiritimati (UTC+14) and
  // still 12 Oct in Pago Pago (UTC-11).
  it.each([
    ["Pacific/Kiritimati", "13", "Martes, 13 de octubre"],
    ["Pacific/Pago_Pago", "12", "Lunes, 12 de octubre"],
  ])("formats today's badge and subtitle in the profile zone %s", async (timeZone, day, subtitle) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00.000Z"));
    getCurrentTimeZoneSetting.mockResolvedValue({ timeZone, chosen: true });

    await renderPage();

    expect(
      document.querySelector('[data-slot="date-badge"] [data-part="day"]'),
    ).toHaveTextContent(day);
    expect(screen.getByTestId("calendar-period")).toHaveTextContent(subtitle);
  });

  it("titles the page Calendario and publishes it as the breadcrumb", async () => {
    await renderPage();

    // Cogni violet gradient title (bg-clip text), same accessible name.
    expect(
      screen.getByRole("heading", { level: 1, name: "Calendario" }),
    ).toHaveClass("text-gradient-brand");

    expect(
      screen.getByRole("heading", { level: 1, name: "Calendario" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Calendario").length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    [{}, "Hoy"],
    [{ view: "semana" }, "Semana"],
    [{ view: "mes" }, "Mes"],
  ])("links the three views and marks the current one (%o)", async (params, current) => {
    await renderPage(params);

    const tabs = screen.getByRole("navigation", {
      name: "Vistas del calendario",
    });
    expect(within(tabs).getByRole("link", { name: "Hoy" })).toHaveAttribute(
      "href",
      "/calendario",
    );
    expect(within(tabs).getByRole("link", { name: "Semana" })).toHaveAttribute(
      "href",
      "/calendario?view=semana",
    );
    expect(within(tabs).getByRole("link", { name: "Mes" })).toHaveAttribute(
      "href",
      "/calendario?view=mes",
    );
    expect(within(tabs).getByRole("link", { name: current })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("puts today's badge, the Hoy title and the day navigation in the page header, outside the card", async () => {
    await renderPage();

    const period = screen.getByTestId("calendar-period");
    const card = screen.getByTestId("calendar-card");
    expect(card.contains(period)).toBe(false);
    // The xl badge sits beside the page title, outside the period block.
    const badge = document.querySelector('[data-slot="date-badge"]');
    expect(badge).toHaveAttribute("data-size", "xl");
    expect(period.contains(badge)).toBe(false);
    expect(card.contains(badge)).toBe(false);
    expect(
      within(period).getByRole("heading", { level: 2, name: "Hoy" }),
    ).toBeInTheDocument();
    const nav = within(period).getByRole("navigation", {
      name: "Navegar días",
    });
    // Today: no going back, the middle button is inert, "Día siguiente" moves on.
    expect(
      within(nav).getByText("Día anterior").closest("[aria-disabled]"),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      within(nav).getByRole("link", { name: "Día siguiente" }),
    ).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/calendario\?date=\d{4}-\d{2}-\d{2}$/),
    );
    expect(card.querySelector("h2")).toBeNull();
    expect(within(card).queryByRole("button")).toBeNull();
  });

  it("shows a later day's scheduled reviews without Repasar or the done pill", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00.000Z"));
    getCalendarDays.mockResolvedValue({
      ok: true,
      value: [
        {
          day: "2026-10-14",
          pageId: "p1",
          pageTitle: "Mitosis",
          notebookId: "nb1",
          notebookTitle: "Biología",
          due: { flashcard: 3, exam_question: 0, recall_question: 0 },
        },
      ],
    });

    await renderPage({ date: "2026-10-14" });

    expect(getCalendarDays).toHaveBeenCalledWith({
      fromDay: "2026-10-14",
      toDay: "2026-10-15",
      timeZone: "UTC",
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    expect(getDueToday).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Miércoles 14 de octubre",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("today-summary")).toHaveTextContent(
      "1 repaso programado",
    );
    expect(
      screen.getByRole("link", {
        name: "Flashcards de Mitosis: 3 programados",
      }),
    ).toHaveAttribute("href", "/notebooks/nb1/pages/p1");
    expect(screen.queryByText("Repasar")).toBeNull();
    expect(screen.queryByText(/hechos hoy/)).toBeNull();
    // The badge follows the shown day; the Hoy tab returns to today.
    expect(
      document.querySelector('[data-slot="date-badge"] [data-part="day"]'),
    ).toHaveTextContent("14");
    expect(
      within(
        screen.getByRole("navigation", { name: "Vistas del calendario" }),
      ).getByRole("link", { name: "Hoy" }),
    ).toHaveAttribute("href", "/calendario");
  });

  it("clamps a past day in the URL to today", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00.000Z"));

    await renderPage({ date: "2026-10-01" });

    expect(getDueToday).toHaveBeenCalled();
    expect(
      within(screen.getByTestId("calendar-period")).getByRole("heading", {
        level: 2,
        name: "Hoy",
      }),
    ).toBeInTheDocument();
  });

  it("lists one row per due page and technique and counts them", async () => {
    getDueToday.mockResolvedValue({
      ok: true,
      value: [due("a", 2, 1), due("b", 1)],
    });

    await renderPage();

    expect(screen.getAllByTestId("today-row")).toHaveLength(3);
    expect(
      screen.getByRole("link", {
        name: "Recordación activa de Página a: 1 pendiente",
      }),
    ).toHaveAttribute("href", "/active-recall/n1/a");
    expect(screen.getByTestId("today-summary")).toHaveTextContent(
      "3 repasos para hoy",
    );
  });

  it("shows today's done study units from the technique overview", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00.000Z"));
    getDueToday.mockResolvedValue({ ok: true, value: [due("a", 2)] });

    await renderPage();

    expect(getTechniqueOverview).toHaveBeenCalledWith({
      timeZone: "UTC",
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    expect(screen.getByText("1 de 3 hechos hoy")).toBeInTheDocument();
  });

  it("hides the done pill when the technique overview fails or throws", async () => {
    getDueToday.mockResolvedValue({ ok: true, value: [due("a", 2)] });
    getTechniqueOverview.mockRejectedValue(new Error("boom"));

    await renderPage();

    expect(screen.getAllByTestId("today-row")).toHaveLength(1);
    expect(screen.queryByText(/hechos hoy/)).toBeNull();
  });

  it("reads the day's due items in the profile zone with the render's instant", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00.000Z"));
    getCurrentTimeZoneSetting.mockResolvedValue({
      timeZone: "America/Bogota",
      chosen: true,
    });

    await renderPage();

    // Reviews are due per local day: "Hoy" counts the whole local day.
    expect(getDueToday).toHaveBeenCalledWith({
      timeZone: "America/Bogota",
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
  });

  it("shows the up-to-date empty state when nothing was due, linking to the next review", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00.000Z"));
    getTechniqueOverview.mockResolvedValue({
      ok: true,
      value: {
        flashcard: {
          ...totals(0, 0),
          nextDueAt: new Date("2026-10-14T09:00:00.000Z"),
        },
        recall_question: {
          ...totals(0, 0),
          nextDueAt: new Date("2026-10-13T09:00:00.000Z"),
        },
        exam_question: totals(0, 0),
      },
    });
    getCalendarDays.mockResolvedValue({
      ok: true,
      value: [
        {
          day: "2026-10-13",
          pageId: "p1",
          pageTitle: "Mitosis",
          notebookId: "nb1",
          notebookTitle: "Biología",
          due: { flashcard: 1, exam_question: 0, recall_question: 2 },
        },
      ],
    });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Hoy estás al día" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("today-summary")).toHaveTextContent(
      "Sin repasos pendientes",
    );
    // The earliest next due day, counted from that day's calendar read.
    expect(getCalendarDays).toHaveBeenCalledWith({
      fromDay: "2026-10-13",
      toDay: "2026-10-14",
      timeZone: "UTC",
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    expect(
      screen.getByRole("link", { name: "Próximo repaso: mañana · 2 repasos" }),
    ).toHaveAttribute("href", "/calendario?date=2026-10-13");
  });

  it("celebrates a day whose due reviews are all done", async () => {
    getTechniqueOverview.mockResolvedValue({
      ok: true,
      value: {
        flashcard: totals(2, 0),
        recall_question: totals(0, 0),
        exam_question: totals(0, 0),
      },
    });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: "¡Terminaste tus repasos de hoy!" }),
    ).toBeInTheDocument();
    // No next review known: the quiet link goes to the week.
    expect(screen.getByRole("link", { name: "Ver la semana" })).toHaveAttribute(
      "href",
      "/calendario?view=semana",
    );
  });

  it("reports a load failure instead of an empty day", async () => {
    getDueToday.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED", message: "x" },
    });

    await renderPage();

    expect(
      screen.getByText(
        "No pudimos cargar tus repasos de hoy. Intenta de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Estás al día")).toBeNull();
  });

  describe("Mes and Semana", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      // 12:00 UTC on Monday 12 Oct: already Tuesday 13 Oct in Kiritimati.
      vi.setSystemTime(new Date("2026-10-12T12:00:00.000Z"));
    });

    it("reads the month grid's days in the profile zone and shows its events", async () => {
      getCurrentTimeZoneSetting.mockResolvedValue({
        status: "ok",
        timeZone: "Pacific/Kiritimati",
        chosen: true,
      });
      getCalendarDays.mockResolvedValue({
        ok: true,
        value: [
          {
            day: "2026-10-20",
            pageId: "p1",
            pageTitle: "Mitosis",
            notebookId: "nb1",
            notebookTitle: "Biología",
            due: { flashcard: 0, exam_question: 0, recall_question: 4 },
          },
        ],
      });

      await renderPage({ view: "mes" });

      // One clock for the whole render: the read folds overdue items into
      // the same today the grid marks (no client-reachable clock involved).
      expect(getCalendarDays).toHaveBeenCalledWith({
        fromDay: "2026-09-28",
        toDay: "2026-11-02",
        timeZone: "Pacific/Kiritimati",
        now: new Date("2026-10-12T12:00:00.000Z"),
      });
      expect(listCalendarDaysAction).not.toHaveBeenCalled();
      expect(getDueToday).not.toHaveBeenCalled();
      const card = screen.getByTestId("calendar-card");
      const period = screen.getByTestId("calendar-period");
      expect(
        within(period).getByRole("heading", { level: 2, name: "Octubre 2026" }),
      ).toBeInTheDocument();
      expect(card).not.toHaveTextContent("1 oct 2026 – 31 oct 2026");
      expect(
        card.querySelector('[data-slot="calendar-day"][data-today]'),
      ).toHaveAttribute("data-day", "2026-10-13");
      // The grid's chip (the side panel lists the same review as a card).
      const chip = within(
        within(card).getByRole("list", { name: "Octubre 2026" }),
      ).getByRole("link", { name: "Recordación activa de Mitosis: 4 ítems" });
      expect(chip).toHaveAttribute("href", "/notebooks/nb1/pages/p1");
      expect(chip.closest('[data-slot="calendar-day"]')).toHaveAttribute(
        "data-day",
        "2026-10-20",
      );
      // Bare arrows only; no overline in Mes.
      expect(
        within(period)
          .getByRole("navigation", { name: "Navegar meses" })
          .querySelectorAll("a"),
      ).toHaveLength(2);
      expect(period.querySelector('[data-part="overline"]')).toBeNull();
      expect(within(card).queryByRole("button")).toBeNull();
    });

    it("shows the week of the dated day with its navigation", async () => {
      await renderPage({ view: "semana", date: "2026-11-04" });

      expect(getDashboardTechniqueMetrics).toHaveBeenCalledWith({
        fromDay: "2026-11-02",
        toDay: "2026-11-09",
        timeZone: "UTC",
        now: new Date("2026-10-12T12:00:00.000Z"),
      });
      // The metric card sits beside the page title, outside the card.
      const metrics = screen.getByTestId("week-metrics");
      expect(screen.getByTestId("calendar-card").contains(metrics)).toBe(false);
      // Done = the week's completed reviews (3 flashcards, 1 recall),
      // nothing still due: 100% each.
      const rings = screen.getByRole("list", {
        name: "Progreso de la semana",
      });
      expect(rings).toHaveTextContent("Flashcards: 3 de 3 repasos (100%)");
      expect(rings).toHaveTextContent(
        "Recordación activa: 1 de 1 repaso (100%)",
      );

      expect(getCalendarDays).toHaveBeenCalledWith({
        fromDay: "2026-11-02",
        toDay: "2026-11-09",
        timeZone: "UTC",
        now: new Date("2026-10-12T12:00:00.000Z"),
      });
      const card = screen.getByTestId("calendar-card");
      const period = screen.getByTestId("calendar-period");
      expect(
        within(period).getByRole("heading", {
          level: 2,
          name: "2 – 8 de noviembre",
        }),
      ).toBeInTheDocument();
      expect(card.querySelectorAll('[data-slot="calendar-day"]')).toHaveLength(
        7,
      );
      expect(
        within(period).getByRole("link", { name: "Semana anterior" }),
      ).toHaveAttribute("href", "/calendario?view=semana&date=2026-10-26");
      // "Semana 1" of November; the badge shows that week's Monday; the
      // Semana tab returns to the current week (no date).
      expect(within(period).getByText("Semana 1")).toHaveAttribute(
        "data-part",
        "overline",
      );
      expect(
        document.querySelector('[data-slot="date-badge"] [data-part="day"]'),
      ).toHaveTextContent("2");
      expect(
        within(
          screen.getByRole("navigation", { name: "Vistas del calendario" }),
        ).getByRole("link", { name: "Semana" }),
      ).toHaveAttribute("href", "/calendario?view=semana");
    });

    it("keeps the week when its completed reviews fail to load", async () => {
      getDashboardTechniqueMetrics.mockRejectedValue(new Error("boom"));

      await renderPage({ view: "semana" });

      expect(screen.getByTestId("week-metrics")).toHaveTextContent(
        "No pudimos cargar tu progreso",
      );
      expect(
        document.querySelectorAll('[data-slot="calendar-day"]'),
      ).toHaveLength(7);
    });

    it("shows the selected day (today by default) and the next seven days beside the grid", async () => {
      getCalendarDays.mockResolvedValue({
        ok: true,
        value: [
          {
            day: "2026-10-13",
            pageId: "p1",
            pageTitle: "Mitosis",
            notebookId: "nb1",
            notebookTitle: "Biología",
            due: { flashcard: 2, exam_question: 0, recall_question: 0 },
          },
        ],
      });

      await renderPage({ view: "mes" });

      // The seven days after the selected one, from their own read.
      expect(getCalendarDays).toHaveBeenCalledWith({
        fromDay: "2026-10-13",
        toDay: "2026-10-20",
        timeZone: "UTC",
        now: new Date("2026-10-12T12:00:00.000Z"),
      });
      const panel = screen.getByRole("region", { name: "Lunes 12 de octubre" });
      expect(panel).toHaveTextContent("Sin repasos");
      const next = within(panel).getByRole("region", {
        name: "Próximos repasos · 1",
      });
      expect(
        within(next).getByRole("link", {
          name: "Flashcards de Mitosis: 2 ítems",
        }),
      ).toHaveAttribute("href", "/notebooks/nb1/pages/p1");
      expect(getDashboardTechniqueMetrics).not.toHaveBeenCalled();
      expect(screen.queryByTestId("week-metrics")).toBeNull();
    });

    it("selects the dated day of the month, outlined in the grid and named in the panel", async () => {
      await renderPage({ view: "mes", date: "2026-10-20" });

      expect(
        screen.getByRole("region", { name: "Martes 20 de octubre" }),
      ).toBeInTheDocument();
      expect(
        document.querySelector('[data-slot="calendar-day"][data-selected]'),
      ).toHaveAttribute("data-day", "2026-10-20");
      expect(
        screen.getByRole("link", { name: "Ver martes, 20 de octubre" }),
      ).toHaveAttribute("aria-current", "date");
      expect(
        document.querySelector('[data-slot="date-badge"] [data-part="day"]'),
      ).toHaveTextContent("20");
    });

    it("keeps the empty grid and reports a load failure", async () => {
      getCalendarDays.mockResolvedValue({
        ok: false,
        error: { code: "SCHEDULING_UNEXPECTED", message: "x" },
      });

      await renderPage({ view: "mes" });

      const card = screen.getByTestId("calendar-card");
      expect(within(card).getByRole("alert")).toHaveTextContent(
        "No pudimos cargar tus repasos",
      );
      expect(card.querySelectorAll('[data-slot="calendar-day"]')).toHaveLength(
        35,
      );
    });
  });
});
