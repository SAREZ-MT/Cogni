import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb, BreadcrumbProvider } from "../_components/breadcrumb";

const { listDueTodayAction } = vi.hoisted(() => ({
  listDueTodayAction: vi.fn(),
}));
vi.mock("@/modules/scheduling", () => ({ listDueTodayAction }));
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
