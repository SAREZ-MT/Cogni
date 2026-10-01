import { render, screen, within } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
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

describe("ActivityChart", () => {
  it("names the chart and shows the 7-day total with its week-over-week delta", () => {
    render(<ActivityChart range={7} />);

    expect(
      screen.getByRole("figure", {
        name: "Repasos completados por día, desglosados por técnica",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Actividad de repaso")).toBeInTheDocument();
    expect(screen.getByText("Repasos completados")).toBeInTheDocument();
    expect(screen.getByText("139")).toBeInTheDocument();
    expect(screen.getByText("+14% vs la semana anterior")).toBeInTheDocument();
    expect(screen.getByText("+14%")).toBeInTheDocument();
  });

  it("recomputes the total and comparison label for 15 days", () => {
    render(<ActivityChart range={15} />);

    expect(screen.getByText("277")).toBeInTheDocument();
    expect(screen.getByText("+41% vs el período anterior")).toBeInTheDocument();
  });

  it("recomputes the total for 30 days", () => {
    render(<ActivityChart range={30} />);

    expect(screen.getByText("474")).toBeInTheDocument();
  });

  it("lists the three techniques in the legend", () => {
    render(<ActivityChart range={7} />);

    const chart = screen.getByTestId("activity-chart");
    for (const name of ["Flashcards", "Active recall", "Exámenes"]) {
      expect(within(chart).getByText(name)).toBeInTheDocument();
    }
  });

  it("switches range through links to the ?range= URL, keeping 7 days clean", () => {
    render(<ActivityChart range={15} />);

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
    render(<ActivityChart range={7} />);

    const chart = screen.getByTestId("activity-chart");
    for (const label of [
      "sáb 19",
      "dom 20",
      "lun 21",
      "mar 22",
      "mié 23",
      "jue 24",
      "vie 25",
    ]) {
      expect(within(chart).getByText(label)).toBeInTheDocument();
    }
  });

  it("labels only every fifth day at 30 days so ticks never overlap", () => {
    render(<ActivityChart range={30} />);

    const chart = screen.getByTestId("activity-chart");
    // First day of the window (index 0) is labelled; its neighbour is not.
    expect(within(chart).getByText("jue 27")).toBeInTheDocument();
    expect(within(chart).queryByText("vie 28")).toBeNull();
  });

  it("marks the Mondays with their week label at 15 and 30 days only", () => {
    const { unmount } = render(<ActivityChart range={7} />);
    expect(screen.queryByText("Sem 4")).toBeNull();
    unmount();

    render(<ActivityChart range={15} />);
    expect(screen.getByText("Sem 3")).toBeInTheDocument();
    expect(screen.getByText("Sem 4")).toBeInTheDocument();
  });
});
