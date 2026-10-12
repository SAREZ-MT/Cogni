import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb, BreadcrumbProvider } from "../_components/breadcrumb";

const { listDueTodayAction } = vi.hoisted(() => ({
  listDueTodayAction: vi.fn(),
}));
vi.mock("@/modules/scheduling", () => ({ listDueTodayAction }));

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

async function renderPage() {
  const element = (await CalendarPage()) as ReactElement;
  return render(
    <BreadcrumbProvider>
      {element}
      <Breadcrumb />
    </BreadcrumbProvider>,
  );
}

describe("CalendarPage", () => {
  beforeEach(() => {
    listDueTodayAction.mockReset();
    listDueTodayAction.mockResolvedValue({ ok: true, value: [] });
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

  it("offers Hoy as the current view and Semana / Mes as upcoming ones", async () => {
    await renderPage();

    const tabs = screen.getByRole("navigation", {
      name: "Vistas del calendario",
    });
    expect(within(tabs).getByRole("link", { name: "Hoy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const label of ["Semana", "Mes"]) {
      expect(within(tabs).queryByRole("link", { name: label })).toBeNull();
      expect(
        within(tabs).getByText(label).closest("[aria-disabled]"),
      ).toHaveAttribute("title", "Próximamente");
    }
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
    listDueTodayAction.mockResolvedValue({
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

  it("shows the up-to-date empty state when nothing is due", async () => {
    await renderPage();

    expect(screen.getByText("Estás al día")).toBeInTheDocument();
    expect(screen.getByTestId("today-summary")).toHaveTextContent(
      "Sin repasos pendientes",
    );
  });

  it("reports a load failure instead of an empty day", async () => {
    listDueTodayAction.mockResolvedValue({
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
});
