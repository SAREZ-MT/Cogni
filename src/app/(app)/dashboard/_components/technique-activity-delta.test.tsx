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
        { width: 200, height: 48 },
      ),
  };
});

// Sample deltas are +12, +9 and -4: no technique sits at the 0 boundary, so
// a flat technique is exercised with a substituted metric.
vi.mock("../_data/sample", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_data/sample")>();
  return {
    ...actual,
    TECHNIQUE_METRICS: actual.TECHNIQUE_METRICS.slice(0, 1).map((metric) => ({
      ...metric,
      repasosDeltaPct: 0,
    })),
  };
});

import { TechniqueActivity } from "./technique-activity";

describe("TechniqueActivity flat week", () => {
  it("treats 0% as non-negative: success tone with a plus sign", () => {
    render(<TechniqueActivity />);

    expect(screen.getByText("+0% vs la semana pasada")).toHaveClass(
      "text-success-600",
    );
  });
});
