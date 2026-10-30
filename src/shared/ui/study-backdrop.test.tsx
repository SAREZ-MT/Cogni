import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StudyBackdrop } from "./study-backdrop";

describe("StudyBackdrop", () => {
  it("is decorative: hidden from assistive technology, inert and textless", () => {
    const { container } = render(<StudyBackdrop />);

    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root?.className).toContain("pointer-events-none");
    expect(root?.className).toContain("absolute");
    expect(root?.textContent).toBe("");
  });

  // User decision 2026-10-17: only the grid stays, no colour wash and no
  // study objects.
  it("draws only a paper grid", () => {
    const { container } = render(<StudyBackdrop />);

    expect(container.querySelector('[data-part="grid"]')).not.toBeNull();
    expect(container.querySelector('[data-part="wash"]')).toBeNull();
    expect(
      container.querySelectorAll('[data-part="study-object"]'),
    ).toHaveLength(0);
  });

  it("fills some grid cells with light gray", () => {
    const { container } = render(<StudyBackdrop />);

    const cells = container.querySelectorAll('[data-part="grid-cell"]');
    expect(cells.length).toBeGreaterThanOrEqual(8);
    for (const cell of cells) {
      expect(cell.getAttribute("class")).toContain("fill-neutral-150");
    }
  });

  it("is strongest in the centre and fades towards the edges", () => {
    const { container } = render(<StudyBackdrop />);

    const grid = container.querySelector<HTMLElement>('[data-part="grid"]');
    expect(grid?.style.maskImage).toMatch(/at 50% 50%, black/);
  });

  it("is static: nothing animates", () => {
    const { container } = render(<StudyBackdrop />);

    expect(container.innerHTML).not.toMatch(/animate-|transition/);
  });
});
