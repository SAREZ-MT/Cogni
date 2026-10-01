import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./sparkline";

describe("Sparkline", () => {
  it("is decorative: hidden from assistive tech", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("applies the requested height and merges className", () => {
    const { container } = render(
      <Sparkline data={[1, 2]} height={36} className="extra" />,
    );

    expect(container.firstElementChild).toHaveStyle({ height: "36px" });
    expect(container.firstElementChild).toHaveClass("w-full", "extra");
  });

  it("defaults to a 40px height", () => {
    const { container } = render(<Sparkline data={[1, 2]} />);

    expect(container.firstElementChild).toHaveStyle({ height: "40px" });
  });

  it("renders for empty data without throwing", () => {
    expect(() => render(<Sparkline data={[]} />)).not.toThrow();
  });
});
