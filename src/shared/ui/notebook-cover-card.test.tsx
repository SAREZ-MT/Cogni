import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotebookCoverCard } from "./notebook-cover-card";

function cover(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-part="cover"]');
}

const baseProps = {
  href: "/notebooks/n1",
  title: "Historia de América",
  pageCount: 3,
};

// Phase 8 H4-T5 (user request 2026-10-28): each notebook in the hub grid is
// a closed notebook — the empty state's `NotebookCover` drawing — with its
// name in the middle, instead of the old flat card.
describe("NotebookCoverCard", () => {
  it("is an article whose link, named by the title, opens the notebook", () => {
    render(<NotebookCoverCard {...baseProps} />);

    const article = screen.getByRole("article");
    const link = within(article).getByRole("link", {
      name: "Historia de América",
    });
    expect(link).toHaveAttribute("href", "/notebooks/n1");
    // Stretched link: the whole book is the click target.
    expect(link).toHaveClass("after:absolute", "after:inset-0");
  });

  it("centres the title on the cover and clamps long names", () => {
    const long =
      "Introducción a la economía política contemporánea y sus debates principales";
    render(<NotebookCoverCard {...baseProps} title={long} />);

    const title = screen.getByText(long);
    expect(title).toHaveClass("line-clamp-3", "text-center");
    // Large covers (3 per row at 1440, user 2026-10-28) scale the type up.
    expect(title).toHaveClass("@[280px]/book:text-xl");
    // The full name stays in the accessible name even when clamped.
    expect(screen.getByRole("link", { name: long })).toBeInTheDocument();
  });

  // User correction 2026-10-28: the page count sits in the top-left corner
  // (no notebook icon there) and the bottom row holds only the date and
  // the actions.
  it("shows the page count as plain text in the top-left corner, singular and plural", () => {
    const { container, rerender } = render(
      <NotebookCoverCard {...baseProps} tone="blue" pageCount={1} />,
    );
    const count = () =>
      container.querySelector<HTMLElement>('[data-part="page-count"]');
    expect(count()).toHaveTextContent("1 página");
    // Plain meta text styled like the date: no glyph, no badge (user
    // correction 2026-10-28).
    expect(count()?.querySelector("svg")).toBeNull();
    expect(count()).toHaveClass("font-medium", "text-[11px]", "text-black/55");
    expect(count()).not.toHaveClass("border", "rounded-full");

    rerender(<NotebookCoverCard {...baseProps} pageCount={12} />);
    expect(count()).toHaveTextContent("12 páginas");
    expect(screen.getAllByText("12 páginas")).toHaveLength(1);
  });

  it("keeps only the date and the actions in the bottom row", () => {
    render(
      <NotebookCoverCard
        {...baseProps}
        dateLabel="hace 2 días"
        actions={<button type="button">Acciones</button>}
      />,
    );

    const row = screen.getByText("hace 2 días").parentElement as HTMLElement;
    expect(row.textContent).toBe("hace 2 díasAcciones");
  });

  it("tints the cover with the notebook colour", () => {
    const { container } = render(
      <NotebookCoverCard {...baseProps} tone="blue" />,
    );

    expect(cover(container)).toHaveClass("from-blue-200", "to-blue-400");
    expect(cover(container)).not.toHaveClass("from-primary-500");
    expect(container.firstElementChild).toHaveAttribute("data-tone", "blue");
  });

  it("falls back to the violet cover with white text when there is no colour", () => {
    const { container } = render(
      <NotebookCoverCard {...baseProps} tone={null} />,
    );

    expect(cover(container)).toHaveClass("from-primary-500", "to-primary-700");
    expect(container.firstElementChild).toHaveAttribute("data-tone", "purple");
    expect(screen.getByText("Historia de América")).toHaveClass("text-white");
  });

  it("keeps the drawing decorative but the content reachable", () => {
    const { container } = render(<NotebookCoverCard {...baseProps} />);

    const drawing = container.querySelector('[data-slot="notebook-cover"]');
    expect(drawing).toHaveAttribute("aria-hidden", "true");
    // The link and the info are not inside the hidden drawing.
    expect(drawing?.contains(screen.getByRole("link"))).toBe(false);
    expect(drawing?.contains(screen.getByText("3 páginas"))).toBe(false);
    // No notebook icon on the cover (user correction 2026-10-28).
    expect(container.querySelector('[data-part="icon"]')).toBeNull();
  });

  it("renders the actions above the stretched link, outside it", () => {
    render(
      <NotebookCoverCard
        {...baseProps}
        actions={<button type="button">Acciones de Historia de América</button>}
      />,
    );

    const action = screen.getByRole("button", {
      name: "Acciones de Historia de América",
    });
    expect(screen.getByRole("link").contains(action)).toBe(false);
    expect(action.parentElement).toHaveClass("relative", "z-10");
  });

  it("lifts subtly on hover and never moves under reduced motion", () => {
    const { container } = render(<NotebookCoverCard {...baseProps} />);

    const book = container.querySelector('[data-part="book"]');
    expect(book).toHaveClass(
      "group-hover/book:-translate-y-1",
      "motion-reduce:transition-none",
      "motion-reduce:transform-none",
    );
  });
  // Final verification V (advisory R3): `notebooks.color` is free text in the
  // database, so a colour outside the palette (a legacy or hand-edited row)
  // must fall back to the default tone instead of crashing the lookup.
  it("falls back to the purple tone for a colour outside the palette", () => {
    const { container } = render(
      <NotebookCoverCard {...baseProps} tone={"red" as never} />,
    );

    expect(container.querySelector<HTMLElement>("[data-tone]")).toHaveAttribute(
      "data-tone",
      "purple",
    );
  });
});
