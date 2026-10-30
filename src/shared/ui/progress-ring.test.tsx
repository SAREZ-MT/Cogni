import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressRing } from "./progress-ring";

function indicator(container: HTMLElement) {
  return container.querySelector('[data-slot="progress-ring-indicator"]');
}

describe("ProgressRing", () => {
  it("is decorative: hidden from assistive technology", () => {
    const { container } = render(<ProgressRing value={40} />);
    const ring = container.querySelector('[data-slot="progress-ring"]');
    expect(ring).toHaveAttribute("aria-hidden", "true");
  });

  it("draws the arc as a share of the circle", () => {
    const { container } = render(<ProgressRing value={40} />);
    const arc = indicator(container);
    expect(arc).toHaveAttribute("pathLength", "100");
    expect(arc).toHaveAttribute("stroke-dasharray", "40 100");
  });

  it("clamps the value to 0..100 and draws no arc at zero", () => {
    const { container, rerender } = render(<ProgressRing value={140} />);
    expect(indicator(container)).toHaveAttribute("stroke-dasharray", "100 100");

    rerender(<ProgressRing value={-5} />);
    expect(indicator(container)).toBeNull();

    rerender(<ProgressRing value={Number.NaN} />);
    expect(indicator(container)).toBeNull();
  });

  it("sizes itself and centres its content", () => {
    const { container, getByText } = render(
      <ProgressRing value={50} size={46} indicatorClassName="text-rose-600">
        50%
      </ProgressRing>,
    );
    const ring = container.querySelector('[data-slot="progress-ring"]');
    expect(ring).toHaveStyle({ width: "46px", height: "46px" });
    expect(getByText("50%")).toBeInTheDocument();
    expect(indicator(container)).toHaveClass("text-rose-600");
  });
});
