import { render, screen } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { sampleView } from "../_lib/dashboard-view.fixtures";
import { ActivityChart } from "./activity-chart";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(
        children as ReactElement<{ width: number; height: number }>,
        { width: 800, height: 220 },
      ),
  };
});

// The falling, flat and missing branches of the delta, on the sample days.
function withDelta(deltaPct: number | null) {
  const { activity } = sampleView();
  render(<ActivityChart range={7} activity={{ ...activity, deltaPct }} />);
}

describe("ActivityChart delta tone", () => {
  it("shows a falling week as an error without a plus sign", () => {
    withDelta(-8);

    expect(screen.getByText("-8% vs la semana anterior")).toHaveClass(
      "text-error-600",
    );
    expect(screen.getByText("-8%")).toHaveClass("bg-error-100");
  });

  it("treats a flat week (0%) as non-negative: success tone with a plus sign", () => {
    withDelta(0);

    expect(screen.getByText("+0% vs la semana anterior")).toHaveClass(
      "text-success-600",
    );
    expect(screen.getByText("+0%")).toHaveClass("bg-success-100");
  });

  it("shows no comparison when the previous period had no reviews", () => {
    withDelta(null);

    expect(screen.queryByText(/vs la semana anterior/)).toBeNull();
    expect(screen.queryByText(/%$/)).toBeNull();
  });
});
