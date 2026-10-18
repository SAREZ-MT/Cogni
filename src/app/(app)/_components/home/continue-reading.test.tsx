import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The notebooks index is server-only; the rows only need its palette.
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

import { ContinueReading, type ContinueReadingPage } from "./continue-reading";

const NOW = new Date("2026-10-18T15:00:00.000Z");

function page(
  id: string,
  overrides: Partial<ContinueReadingPage> = {},
): ContinueReadingPage {
  return {
    id,
    notebookId: "nb-1",
    notebookTitle: "Biología Celular",
    notebookColor: "green",
    title: `Página ${id}`,
    updatedAt: new Date("2026-10-18T13:00:00.000Z"),
    ...overrides,
  };
}

describe("ContinueReading", () => {
  it("links up to four recent pages to their editor, with notebook and edit time", () => {
    render(
      <ContinueReading
        pages={[page("a"), page("b"), page("c"), page("d"), page("e")]}
        now={NOW}
      />,
    );

    const section = screen.getByRole("region", {
      name: "Continúa donde lo dejaste",
    });
    const links = within(section).getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveAttribute("href", "/notebooks/nb-1/pages/a");
    expect(links[0]).toHaveAccessibleName(
      "Abrir Página a de Biología Celular, editada hace 2h",
    );
    expect(links[0]).toHaveTextContent("Editada hace 2h");
  });

  it("names an untitled page 'Sin título'", () => {
    render(<ContinueReading pages={[page("a", { title: "  " })]} now={NOW} />);

    expect(
      screen.getByRole("link", {
        name: "Abrir Sin título de Biología Celular, editada hace 2h",
      }),
    ).toHaveTextContent("Sin título");
  });

  // H2-T5s (user 2026-10-18): no visible notebook, so the title sits at
  // the top and the forgetting curve gets the room; the notebook stays in
  // the link's accessible name.
  it("shows no notebook on the card but keeps it in the link's name", () => {
    const { container } = render(
      <ContinueReading pages={[page("a")]} now={NOW} />,
    );

    expect(container.querySelector('[data-part="notebook-chip"]')).toBeNull();
    const link = screen.getByRole("link", {
      name: /^Abrir Página a de Biología Celular, editada /,
    });
    expect(link).not.toHaveTextContent("Biología Celular");
  });

  // User 2026-10-18: the curve starts near the top-left corner, so the
  // title is nudged right to clear it.
  it("nudges the title right so the curve can start at the top corner", () => {
    render(<ContinueReading pages={[page("a")]} now={NOW} />);

    expect(screen.getByText("Página a")).toHaveClass("pl-7");
  });

  // H2-T5r (user 2026-10-18): each card carries the forgetting curve, with
  // "now" placed by the hours since the page was last edited.
  it("draws each page's forgetting curve from the time since its edit", () => {
    const { container } = render(
      <ContinueReading
        pages={[
          page("a"),
          page("b", { updatedAt: new Date("2026-10-15T15:00:00.000Z") }),
        ]}
        now={NOW}
      />,
    );

    const curves = container.querySelectorAll(
      '[data-part="backdrop"] [data-slot="forgetting-curve"]',
    );
    expect(curves).toHaveLength(2);
    expect(curves[0]).toHaveAttribute("data-elapsed-hours", "2");
    expect(curves[1]).toHaveAttribute("data-elapsed-hours", "72");
  });

  it("says so in one muted line when no page was opened yet", () => {
    render(<ContinueReading pages={[]} now={NOW} />);

    const section = screen.getByRole("region", {
      name: "Continúa donde lo dejaste",
    });
    expect(
      within(section).getByText("Aún no abriste ninguna página."),
    ).toBeInTheDocument();
    expect(within(section).queryByRole("link")).toBeNull();
  });
});
