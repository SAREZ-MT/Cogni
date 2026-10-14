import { render, screen, within } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardRange } from "@/shared/ui/period-filter";
import { buildDashboardView } from "../_lib/dashboard-view";
import {
  emptyView,
  sampleMetrics,
  sampleSources,
} from "../_lib/dashboard-view.fixtures";
import { ActivityChart } from "./activity-chart";

// jsdom has no layout, so ResponsiveContainer would render nothing. A
// fixed-size stand-in lets the chart draw; assertions target labels and
// numbers, never SVG geometry.
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

// The analytics daily reviews of a `range`-day period ending on Tuesday
// 13 Oct 2026.
function renderChart(range: DashboardRange) {
  const { activity } = buildDashboardView({
    ...sampleSources(),
    metrics: sampleMetrics(range),
    range,
  });
  return render(<ActivityChart range={range} activity={activity} />);
}

describe("ActivityChart", () => {
  it("names the chart and shows the 7-day total with its week-over-week delta", () => {
    renderChart(7);

    expect(
      screen.getByRole("figure", {
        name: "Repasos completados por día, desglosados por técnica",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Actividad de repaso")).toBeInTheDocument();
    expect(screen.getByText("Repasos completados")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("+25% vs la semana anterior")).toBeInTheDocument();
    expect(screen.getByText("+25%")).toBeInTheDocument();
  });

  it("names the comparison the previous period beyond 7 days", () => {
    renderChart(15);

    expect(screen.getByText("+25% vs el período anterior")).toBeInTheDocument();
  });

  it("shows an empty state instead of bars for a period without reviews", () => {
    render(<ActivityChart range={7} activity={emptyView().activity} />);

    expect(screen.getByText("Sin repasos en este período")).toBeInTheDocument();
    expect(screen.queryByText(/vs la semana anterior/)).toBeNull();
    // The period filter stays available.
    expect(screen.getByRole("link", { name: "15 días" })).toBeInTheDocument();
  });

  it("lists the three techniques in the legend", () => {
    renderChart(7);

    const chart = screen.getByTestId("activity-chart");
    for (const name of ["Flashcards", "Active recall", "Exámenes"]) {
      expect(within(chart).getByText(name)).toBeInTheDocument();
    }
  });

  it("switches range through links to the ?range= URL, keeping 7 days clean", () => {
    renderChart(15);

    expect(screen.getByRole("link", { name: "7 días" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "15 días" })).toHaveAttribute(
      "href",
      "/dashboard?range=15",
    );
    expect(screen.getByRole("link", { name: "30 días" })).toHaveAttribute(
      "href",
      "/dashboard?range=30",
    );
    expect(screen.getByRole("link", { name: "15 días" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "7 días" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("labels every day on the x axis at 7 days", () => {
    renderChart(7);

    const chart = screen.getByTestId("activity-chart");
    for (const label of [
      "mié 7",
      "jue 8",
      "vie 9",
      "sáb 10",
      "dom 11",
      "lun 12",
      "mar 13",
    ]) {
      expect(within(chart).getByText(label)).toBeInTheDocument();
    }
  });

  it("labels only every fifth day at 30 days so ticks never overlap", () => {
    renderChart(30);

    const chart = screen.getByTestId("activity-chart");
    // First day of the window (index 0) is labelled; its neighbour is not.
    expect(within(chart).getByText("lun 14")).toBeInTheDocument();
    expect(within(chart).queryByText("mar 15")).toBeNull();
  });

  it("marks the Mondays with their week label at 15 and 30 days only", () => {
    const { unmount } = renderChart(7);
    expect(screen.queryByText("Sem 1")).toBeNull();
    unmount();

    renderChart(15);
    expect(screen.getByText("Sem 1")).toBeInTheDocument();
    expect(screen.getByText("Sem 2")).toBeInTheDocument();
  });
});
