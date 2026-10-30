import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForgettingCurve, forgettingCurve } from "./forgetting-curve";

describe("forgettingCurve", () => {
  it("starts high on the left and decays toward the bottom", () => {
    const { points } = forgettingCurve(0);
    const first = points[0];
    const last = points[points.length - 1];
    expect(first?.x).toBe(0);
    expect(last?.x).toBe(100);
    expect(first && last && first.y < last.y).toBe(true);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]?.y ?? 0).toBeGreaterThanOrEqual(points[i - 1]?.y ?? 0);
    }
  });

  it("places 'now' further along and lower the longer since the edit", () => {
    const fresh = forgettingCurve(2).marker;
    const older = forgettingCurve(72).marker;
    expect(older.x).toBeGreaterThan(fresh.x);
    expect(older.y).toBeGreaterThan(fresh.y);
  });

  it("clamps 'now' inside the card so its halo is never clipped", () => {
    expect(forgettingCurve(-5).marker.x).toBe(5);
    expect(forgettingCurve(24 * 60).marker.x).toBe(95);
  });

  it("starts near the top-left corner", () => {
    const first = forgettingCurve(0).points[0];
    expect(first?.x).toBe(0);
    expect(first?.y).toBeLessThanOrEqual(10);
  });
});

describe("ForgettingCurve", () => {
  it("is a decorative backdrop with the curve, its fill and the 'now' marker", () => {
    const { container } = render(<ForgettingCurve elapsedHours={30} />);

    const root = container.querySelector('[data-slot="forgetting-curve"]');
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root?.querySelector('[data-part="curve"]')).not.toBeNull();
    expect(root?.querySelector('[data-part="area"]')).not.toBeNull();
    expect(root?.querySelector('[data-part="now"]')).not.toBeNull();
  });
});
