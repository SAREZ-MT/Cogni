import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageStripRow } from "./page-strip";

const baseProps = {
  href: "/notebooks/n1/pages/p1",
  title: "Mitosis",
  dateLabel: "29 oct",
  datePrefix: "Actualizada",
};

// Phase 8 H5-T2 (user request 2026-10-29): the list view's page row as a
// thin paper strip in the sheets' family.
describe("PageStripRow", () => {
  it("is an article whose stretched link, named by the title, opens the page", () => {
    render(<PageStripRow {...baseProps} />);

    const row = screen.getByRole("article");
    expect(row).toHaveAttribute("data-slot", "page-strip-row");
    const link = within(row).getByRole("link", { name: "Mitosis" });
    expect(link).toHaveAttribute("href", "/notebooks/n1/pages/p1");
    expect(link).toHaveClass("after:absolute", "after:inset-0");
  });

  it("is a white strip with a fine border and the notebook's colour on its edge", () => {
    const { container } = render(<PageStripRow {...baseProps} tone="pink" />);

    const row = screen.getByRole("article");
    expect(row).toHaveClass("bg-card", "border", "border-border-default");
    expect(row).toHaveAttribute("data-tone", "pink");
    expect(container.querySelector('[data-part="tab"]')).toHaveClass(
      "bg-pink-400",
    );
    expect(container.querySelector('[data-part="margin"]')).toHaveClass(
      "bg-pink-400/45",
    );
    expect(container.querySelector('[data-part="rule"]')).toBeInTheDocument();
  });

  it("falls back to violet without a colour", () => {
    render(<PageStripRow {...baseProps} tone={null} />);

    expect(screen.getByRole("article")).toHaveAttribute("data-tone", "purple");
  });

  it("shows the muted date and keeps the actions visible above the link", () => {
    render(
      <PageStripRow
        {...baseProps}
        actions={<button type="button">Archivar página Mitosis</button>}
      />,
    );

    expect(screen.getByRole("article")).toHaveTextContent("Actualizada 29 oct");
    const action = screen.getByRole("button", {
      name: "Archivar página Mitosis",
    });
    expect(action.parentElement).toHaveClass("relative", "z-10");
    expect(action.parentElement).not.toHaveClass("opacity-0");
    expect(screen.getByRole("link").contains(action)).toBe(false);
  });

  it("keeps only the title and the actions on a narrow strip", () => {
    render(<PageStripRow {...baseProps} />);

    expect(screen.getByText("29 oct")).toHaveClass(
      "hidden",
      "@[240px]/strip:inline",
    );
    expect(screen.getByText("Actualizada")).toHaveClass(
      "hidden",
      "@[360px]/strip:inline",
    );
  });

  it("lifts gently on hover and never moves under reduced motion", () => {
    render(<PageStripRow {...baseProps} />);

    expect(screen.getByRole("article")).toHaveClass(
      "hover:-translate-y-px",
      "motion-reduce:transform-none",
    );
  });
  // Final verification V (advisory R3): `notebooks.color` is free text in the
  // database, so a colour outside the palette (a legacy or hand-edited row)
  // must fall back to the default tone instead of crashing the lookup.
  it("falls back to the purple tone for a colour outside the palette", () => {
    const { container } = render(
      <PageStripRow {...baseProps} tone={"red" as never} />,
    );

    expect(container.querySelector<HTMLElement>("[data-tone]")).toHaveAttribute(
      "data-tone",
      "purple",
    );
  });
});
