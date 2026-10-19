import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb, BreadcrumbProvider } from "../_components/breadcrumb";

vi.mock("server-only", () => ({}));
const { getDueToday, listCalendarDaysAction, getCalendarDays } = vi.hoisted(
  () => ({
    getDueToday: vi.fn(),
    listCalendarDaysAction: vi.fn(),
    getCalendarDays: vi.fn(),
  }),
);
// The pure calendar helpers stay real; only the reads are faked.
vi.mock("@/modules/scheduling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/scheduling")>()),
  getDueToday,
  listCalendarDaysAction,
  getCalendarDays,
}));

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

    const card = screen.getByTestId("calendar-card");
    expect(
      card.querySelector('[data-slot="date-badge"] [data-part="day"]'),
    ).toHaveTextContent(day);
    expect(card).toHaveTextContent(subtitle);
  });

  it("titles the page Calendario and publishes it as the breadcrumb", async () => {
    await renderPage();

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

  it("heads the card with today's date badge and the Hoy title, with no add-event action", async () => {
    await renderPage();

    const card = screen.getByTestId("calendar-card");
    expect(card.querySelector('[data-slot="date-badge"]')).not.toBeNull();
    expect(
      within(card).getByRole("heading", { level: 2, name: "Hoy" }),
    ).toBeInTheDocument();
    expect(within(card).queryByRole("button")).toBeNull();
  });

  it("lists the due pages with their technique chips and summarises the total", async () => {
    getDueToday.mockResolvedValue({
      ok: true,
      value: [due("a", 2, 1), due("b", 1)],
    });

    await renderPage();

    expect(screen.getAllByTestId("today-row")).toHaveLength(2);
    expect(
      screen.getByRole("link", {
        name: "Recordación activa de Página a: 1 pendiente",
      }),
    ).toHaveAttribute("href", "/active-recall/n1/a");
    expect(screen.getByTestId("today-summary")).toHaveTextContent(
      "4 repasos en 2 páginas",
    );
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

  it("shows the up-to-date empty state when nothing is due", async () => {
    await renderPage();

    expect(screen.getByText("Estás al día")).toBeInTheDocument();
    expect(screen.getByTestId("today-summary")).toHaveTextContent(
      "Sin repasos pendientes",
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
      expect(
        within(card).getByRole("heading", { level: 2, name: "Octubre 2026" }),
      ).toBeInTheDocument();
      expect(card).toHaveTextContent("1 oct 2026 – 31 oct 2026");
      expect(
        card.querySelector('[data-slot="calendar-day"][data-today]'),
      ).toHaveAttribute("data-day", "2026-10-13");
      const chip = within(card).getByRole("link", {
        name: "Recordación activa de Mitosis: 4 ítems",
      });
      expect(chip).toHaveAttribute("href", "/notebooks/nb1/pages/p1");
      expect(chip.closest('[data-slot="calendar-day"]')).toHaveAttribute(
        "data-day",
        "2026-10-20",
      );
      expect(
        within(card).getByRole("navigation", { name: "Navegar meses" }),
      ).toBeInTheDocument();
      expect(within(card).queryByRole("button")).toBeNull();
    });

    it("shows the week of the dated day with its navigation", async () => {
      await renderPage({ view: "semana", date: "2026-11-04" });

      expect(getCalendarDays).toHaveBeenCalledWith({
        fromDay: "2026-11-02",
        toDay: "2026-11-09",
        timeZone: "UTC",
        now: new Date("2026-10-12T12:00:00.000Z"),
      });
      const card = screen.getByTestId("calendar-card");
      expect(
        within(card).getByRole("heading", {
          level: 2,
          name: "Semana del 2 de noviembre",
        }),
      ).toBeInTheDocument();
      expect(card.querySelectorAll('[data-slot="calendar-day"]')).toHaveLength(
        7,
      );
      expect(
        within(card).getByRole("link", { name: "Semana anterior" }),
      ).toHaveAttribute("href", "/calendario?view=semana&date=2026-10-26");
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
