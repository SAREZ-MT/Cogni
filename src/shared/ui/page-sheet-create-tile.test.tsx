import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageSheetCreateTile } from "./page-sheet-create-tile";
import { PageStripCreateRow } from "./page-strip";

// Phase 8 H5-T2 (user request 2026-10-29): the notebook page's one create
// control, first in the sheet grid (a sheet-sized tile) and in the list (a
// strip), in the hub create tile's violet language.
describe("PageSheetCreateTile", () => {
  it("is a button named by its label, with the hint shown beside it", () => {
    render(
      <PageSheetCreateTile
        type="submit"
        label="Nueva página"
        hint="Escribe o importa un apunte"
      />,
    );

    const tile = screen.getByRole("button", { name: "Nueva página" });
    expect(tile).toHaveAttribute("type", "submit");
    expect(tile).toHaveClass("aspect-[4/5]");
    expect(screen.getByText("Escribe o importa un apunte")).toBeInTheDocument();
  });

  it("is violet-tinted and lifts on hover, never under reduced motion", () => {
    const { container } = render(<PageSheetCreateTile label="Nueva página" />);

    const face = container.querySelector('[data-part="face"]');
    expect(face).toHaveClass(
      "bg-primary-50",
      "border-dashed",
      "group-hover/new:-translate-y-1",
      "motion-reduce:transform-none",
    );
    expect(container.querySelector('[data-part="plus"]')).toHaveClass(
      "bg-primary-600",
      "rounded-full",
    );
  });

  it("defaults to a plain button", () => {
    render(<PageSheetCreateTile label="Nueva página" />);

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("PageStripCreateRow", () => {
  it("is a violet strip button named by its label", () => {
    render(
      <PageStripCreateRow
        type="submit"
        label="Nueva página"
        hint="Escribe o importa un apunte"
      />,
    );

    const row = screen.getByRole("button", { name: "Nueva página" });
    expect(row).toHaveAttribute("type", "submit");
    expect(row).toHaveClass("bg-primary-50", "border-dashed", "h-14");
    expect(screen.getByText("Escribe o importa un apunte")).toBeInTheDocument();
  });
});
