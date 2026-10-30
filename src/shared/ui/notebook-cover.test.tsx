import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotebookCover } from "./notebook-cover";

function cover(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-part="cover"]');
}

// Phase 8 H4-T4 (user decision 2026-10-20): the closed notebook drawing is
// one atom, shared by the empty-state fan and the hub header's badge.
describe("NotebookCover", () => {
  it("draws the violet new-notebook cover by default, decorative only", () => {
    const { container } = render(<NotebookCover />);

    const root = container.firstElementChild;
    expect(root).toHaveAttribute("data-slot", "notebook-cover");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(cover(container)).toHaveClass(
      "from-primary-500",
      "to-primary-700",
      "border-primary-700",
    );
    expect(container.querySelector('[data-part="ribbon"]')).toHaveClass(
      "bg-technique-flashcards-accent",
    );
    expect(container.querySelector('[data-part="spine"]')).not.toBeNull();
    // Two page-edge layers behind the cover give it thickness.
    expect(container.querySelectorAll('[data-part="pages"]')).toHaveLength(2);
    expect(container.querySelector("button, a, img, svg")).toBeNull();
  });

  it("fills its parent at the large size and is a fixed 58×70 badge at the small one", () => {
    const large = render(<NotebookCover />).container;
    expect(large.firstElementChild).toHaveClass("size-full");

    const small = render(<NotebookCover size="sm" />).container;
    expect(small.firstElementChild).toHaveClass("h-[70px]", "w-[58px]");
    expect(small.firstElementChild).not.toHaveClass("size-full");
  });

  it("takes another palette and renders its contents on the cover", () => {
    const { container } = render(
      <NotebookCover
        cover="border-success-500 from-emerald-200 to-emerald-400"
        ribbon="bg-white"
      >
        <span>Biología</span>
      </NotebookCover>,
    );

    expect(cover(container)).toHaveClass("from-emerald-200");
    expect(cover(container)).not.toHaveClass("from-primary-500");
    expect(container.querySelector('[data-part="ribbon"]')).toHaveClass(
      "bg-white",
    );
    expect(cover(container)).toHaveTextContent("Biología");
  });
});
