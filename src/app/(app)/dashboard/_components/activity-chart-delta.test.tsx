import { render, screen } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

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

// The sample data only ever grows week over week, so the falling and flat
// branches of the delta are exercised with a substituted insight.
const { insight } = vi.hoisted(() => ({
  insight: vi.fn(),
}));
vi.mock("../_data/sample", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_data/sample")>();
  return { ...actual, activityChartInsight: insight };
});

import { ActivityChart } from "./activity-chart";

function withDelta(deltaPct: number) {
  insight.mockReturnValue({
    days: [],
    total: 50,
    deltaPct,
    periodLabel: "la semana anterior",
  });
}

describe("ActivityChart delta tone", () => {
  it("shows a falling week as an error without a plus sign", () => {
    withDelta(-8);

    render(<ActivityChart range={7} />);

    expect(screen.getByText("-8% vs la semana anterior")).toHaveClass(
      "text-error-600",
    );
    expect(screen.getByText("-8%")).toHaveClass("bg-error-100");
  });

  it("treats a flat week (0%) as non-negative: success tone with a plus sign", () => {
    withDelta(0);

    render(<ActivityChart range={7} />);

    expect(screen.getByText("+0% vs la semana anterior")).toHaveClass(
      "text-success-600",
    );
    expect(screen.getByText("+0%")).toHaveClass("bg-success-100");
  });
});
