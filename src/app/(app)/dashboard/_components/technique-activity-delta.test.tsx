import { render, screen } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TechniqueCardView } from "../_lib/dashboard-view";
import { sampleView } from "../_lib/dashboard-view.fixtures";
import { TechniqueActivity } from "./technique-activity";

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

describe("TechniqueActivity flat week", () => {
  it("treats 0% as non-negative: success tone with a plus sign", () => {
    const first = sampleView().techniques[0] as TechniqueCardView;
    render(<TechniqueActivity techniques={[{ ...first, deltaPct: 0 }]} />);

    expect(screen.getByText("+0% vs la semana anterior")).toHaveClass(
      "text-success-600",
    );
  });
});
