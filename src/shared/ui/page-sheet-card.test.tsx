import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageSheetCard } from "./page-sheet-card";

const baseProps = {
  href: "/notebooks/n1/pages/p1",
  title: "Mitosis",
  dateLabel: "29 oct",
  datePrefix: "Actualizada",
};

// Phase 8 H5-T1 (user request 2026-10-29): each page of a notebook is a
// paper sheet in the same family as the hub's notebook covers — the title
// prominent, the date and the actions at the bottom.
describe("PageSheetCard", () => {
  it("is an article whose stretched link, named by the title, opens the page", () => {
    render(<PageSheetCard {...baseProps} />);

    const article = screen.getByRole("article");
    const link = within(article).getByRole("link", { name: "Mitosis" });
    expect(link).toHaveAttribute("href", "/notebooks/n1/pages/p1");
    expect(link).toHaveClass("after:absolute", "after:inset-0");
  });

  it("draws the page as a paper sheet tinted by the notebook's colour", () => {
    const { container } = render(<PageSheetCard {...baseProps} tone="blue" />);

    const article = screen.getByRole("article");
    expect(article).toHaveAttribute("data-slot", "page-sheet-card");
    expect(article).toHaveAttribute("data-tone", "blue");
    expect(container.querySelector('[data-slot="page-sheet"]')).toHaveAttribute(
      "data-tone",
      "blue",
    );
  });

  it("falls back to violet without a colour", () => {
    render(<PageSheetCard {...baseProps} tone={null} />);

    expect(screen.getByRole("article")).toHaveAttribute("data-tone", "purple");
  });

  it("makes the title prominent and clamps long titles", () => {
    const long =
      "Introducción a la membrana plasmática, sus proteínas de transporte y los mecanismos de señalización";
    render(<PageSheetCard {...baseProps} title={long} />);

    const title = screen.getByText(long);
    expect(title).toHaveClass(
      "@[150px]/sheet:line-clamp-4",
      "font-semibold",
      "wrap-anywhere",
    );
    expect(screen.getByRole("link", { name: long })).toBeInTheDocument();
  });

  it("shows the date and the actions in the bottom row, the actions above the link", () => {
    render(
      <PageSheetCard
        {...baseProps}
        actions={<button type="button">Archivar página Mitosis</button>}
      />,
    );

    expect(screen.getByRole("article")).toHaveTextContent("Actualizada 29 oct");
    const action = screen.getByRole("button", {
      name: "Archivar página Mitosis",
    });
    expect(action.parentElement).toHaveClass("relative", "z-10");
    // Never nested inside the link.
    expect(screen.getByRole("link").contains(action)).toBe(false);
  });

  it("keeps only a smaller title and the actions below 150px wide", () => {
    render(
      <PageSheetCard
        {...baseProps}
        actions={<button type="button">x</button>}
      />,
    );

    expect(screen.getByText("Mitosis")).toHaveClass(
      "line-clamp-3",
      "text-[11px]",
      "@[150px]/sheet:text-[15px]",
    );
    expect(screen.getByText("29 oct")).toHaveClass(
      "hidden",
      "@[150px]/sheet:inline",
    );
    // The prefix waits for a wider sheet so the date never truncates.
    expect(screen.getByText("Actualizada")).toHaveClass(
      "hidden",
      "@[190px]/sheet:inline",
    );
  });

  it("renders optional top-corner meta as plain text", () => {
    const { container, rerender } = render(<PageSheetCard {...baseProps} />);
    expect(container.querySelector('[data-part="meta"]')).toBeNull();

    rerender(<PageSheetCard {...baseProps} meta="Importada" />);
    expect(container.querySelector('[data-part="meta"]')).toHaveTextContent(
      "Importada",
    );
  });

  it("lifts gently on hover and never moves under reduced motion", () => {
    const { container } = render(<PageSheetCard {...baseProps} />);

    const body = container.querySelector('[data-part="sheet"]');
    expect(body).toHaveClass(
      "group-hover/sheet:-translate-y-1",
      "motion-reduce:transform-none",
    );
  });
});
