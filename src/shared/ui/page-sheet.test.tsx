import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageSheet } from "./page-sheet";

function sheet(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-slot="page-sheet"]');
}

function part(container: HTMLElement, name: string) {
  return container.querySelector<HTMLElement>(`[data-part="${name}"]`);
}

// Phase 8 H5-T1 (user request 2026-10-29): a page of a notebook drawn as a
// paper sheet — a small stack of sheets, a folded corner and a tab in the
// notebook's colour — shared by the notebook page's header badge and its
// page cards.
describe("PageSheet", () => {
  it("is decorative", () => {
    const { container } = render(<PageSheet />);

    expect(sheet(container)).toHaveAttribute("aria-hidden", "true");
  });

  it("draws a white sheet with a folded corner over a stack of sheets", () => {
    const { container } = render(<PageSheet />);

    expect(part(container, "face")).toHaveClass("bg-card");
    expect(part(container, "fold")).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-part="stack"]').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("tints the tab and the margin rule with the notebook's colour", () => {
    const { container } = render(<PageSheet tone="green" />);

    expect(sheet(container)).toHaveAttribute("data-tone", "green");
    expect(part(container, "tab")).toHaveClass("bg-emerald-400");
    expect(part(container, "margin")).toHaveClass("bg-emerald-400/45");
  });

  it("falls back to violet for a notebook without a colour", () => {
    const { container } = render(<PageSheet tone={null} />);

    expect(sheet(container)).toHaveAttribute("data-tone", "purple");
    expect(part(container, "tab")).toHaveClass("bg-primary-500");
  });

  it("fills its parent at lg and is a fixed 58×70 badge at sm", () => {
    const { container: lg } = render(<PageSheet />);
    expect(sheet(lg)).toHaveClass("size-full");

    const { container: sm } = render(<PageSheet size="sm" />);
    expect(sheet(sm)).toHaveClass("h-[70px]", "w-[58px]");
  });

  it("prints ruled lines on the small badge", () => {
    const { container } = render(<PageSheet size="sm" />);

    expect(
      container.querySelectorAll('[data-part="rule"]').length,
    ).toBeGreaterThanOrEqual(3);
  });
});
