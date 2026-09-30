import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./progress-bar";

function fill(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-slot="progress-fill"]');
}

describe("ProgressBar", () => {
  it("exposes a progressbar role with the value and a 0-100 range", () => {
    render(<ProgressBar value={42} aria-label="Avance" />);

    const bar = screen.getByRole("progressbar", { name: "Avance" });
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("sets the fill width from the value through an inline style", () => {
    const { container } = render(<ProgressBar value={37} />);

    expect(fill(container)?.style.width).toBe("37%");
  });

  it("clamps values above 100 for both the fill and aria-valuenow", () => {
    const { container } = render(<ProgressBar value={250} />);

    expect(fill(container)?.style.width).toBe("100%");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });

  it("clamps negative values to 0", () => {
    const { container } = render(<ProgressBar value={-15} />);

    expect(fill(container)?.style.width).toBe("0%");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("treats a non-finite value as 0", () => {
    const { container } = render(<ProgressBar value={Number.NaN} />);

    expect(fill(container)?.style.width).toBe("0%");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("keeps the boundaries 0 and 100 exact", () => {
    const { container, rerender } = render(<ProgressBar value={0} />);
    expect(fill(container)?.style.width).toBe("0%");

    rerender(<ProgressBar value={100} />);
    expect(fill(container)?.style.width).toBe("100%");
  });

  it("forwards className to the track and fillClassName to the fill", () => {
    const { container } = render(
      <ProgressBar
        value={50}
        className="track-extra"
        fillClassName="gradient-streak"
      />,
    );

    expect(screen.getByRole("progressbar")).toHaveClass("track-extra");
    expect(fill(container)).toHaveClass("gradient-streak");
  });

  it("lets a caller hide a decorative bar from assistive tech", () => {
    render(<ProgressBar value={50} role="presentation" aria-hidden="true" />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
