import { render, screen } from "@testing-library/react";
import { type ComponentProps, cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from "./chart";

// jsdom has no layout, so recharts' ResponsiveContainer renders nothing.
// A fixed-size stand-in lets the children (which read the chart context)
// render so the labels and values can be asserted, never SVG geometry.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(
        children as ReactElement<{ width: number; height: number }>,
        {
          width: 400,
          height: 200,
        },
      ),
  };
});

const CONFIG: ChartConfig = {
  flashcards: { label: "Flashcards", color: "var(--color-neutral-900)" },
  exams: { label: "Exámenes" },
};

// Only the fields the tooltip reads; recharts' full entry type also carries
// internal ids, so the fixture is cast once here.
const PAYLOAD = [
  { dataKey: "flashcards", name: "flashcards", value: 1234, color: "red" },
  { dataKey: "exams", name: "exams", value: 2, color: "blue" },
] as unknown as ComponentProps<typeof ChartTooltipContent>["payload"];

describe("ChartContainer", () => {
  it("scopes one CSS variable per configured colour to the chart", () => {
    const { container } = render(
      <ChartContainer config={CONFIG}>
        <svg />
      </ChartContainer>,
    );

    const chart = container.querySelector("[data-slot=chart]") as HTMLElement;
    const id = chart.getAttribute("data-chart");
    const css = container.querySelector("style")?.innerHTML ?? "";
    expect(css).toContain(`[data-chart="${id}"]`);
    expect(css).toContain("--color-flashcards: var(--color-neutral-900);");
    expect(css).not.toContain("--color-exams");
  });

  it("emits no style tag when nothing is coloured", () => {
    const { container } = render(
      <ChartContainer config={{ exams: { label: "Exámenes" } }}>
        <svg />
      </ChartContainer>,
    );

    expect(container.querySelector("style")).toBeNull();
  });

  it("uses an explicit id for the chart scope", () => {
    const { container } = render(
      <ChartContainer id="main" config={CONFIG}>
        <svg />
      </ChartContainer>,
    );

    expect(container.querySelector("[data-slot=chart]")).toHaveAttribute(
      "data-chart",
      "chart-main",
    );
  });
});

describe("ChartTooltipContent", () => {
  function renderTooltip(props: Parameters<typeof ChartTooltipContent>[0]) {
    return render(
      <ChartContainer config={CONFIG}>
        <ChartTooltipContent {...props} />
      </ChartContainer>,
    );
  }

  it("renders nothing while inactive or without payload", () => {
    const { container } = renderTooltip({ active: false, payload: PAYLOAD });
    expect(container.querySelector(".grid")).toBeNull();

    const empty = renderTooltip({ active: true, payload: [] });
    expect(empty.container.querySelector(".grid")).toBeNull();
  });

  it("shows the hovered category, configured series names and localised values", () => {
    renderTooltip({ active: true, payload: PAYLOAD, label: "lun 21" });

    expect(screen.getByText("lun 21")).toBeInTheDocument();
    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(screen.getByText("Exámenes")).toBeInTheDocument();
    expect(
      screen.getByText((1234).toLocaleString("es-ES")),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("can hide the label and the indicators", () => {
    const { container } = renderTooltip({
      active: true,
      payload: PAYLOAD,
      label: "lun 21",
      hideLabel: true,
      hideIndicator: true,
    });

    expect(screen.queryByText("lun 21")).toBeNull();
    expect(container.querySelector("[aria-hidden=true]")).toBeNull();
  });

  it("uses the formatter for values", () => {
    renderTooltip({
      active: true,
      payload: PAYLOAD,
      formatter: (value) => `${value} repasos`,
    });

    expect(screen.getByText("1234 repasos")).toBeInTheDocument();
  });
});

describe("ChartLegendContent", () => {
  it("renders nothing without payload", () => {
    const { container } = render(
      <ChartContainer config={CONFIG}>
        <ChartLegendContent payload={[]} />
      </ChartContainer>,
    );

    expect(container.querySelector(".rounded-pill")).toBeNull();
  });

  it("labels each entry from the config, falling back to its value", () => {
    render(
      <ChartContainer config={CONFIG}>
        <ChartLegendContent
          payload={[
            { value: "flashcards", dataKey: "flashcards", color: "red" },
            { value: "otro", dataKey: "otro", color: "blue" },
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(screen.getByText("otro")).toBeInTheDocument();
  });
});

describe("chart context", () => {
  it("throws when a chart part is used outside a ChartContainer", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(<ChartTooltipContent active payload={PAYLOAD} />),
    ).toThrow("Chart components must be used within a <ChartContainer>");

    spy.mockRestore();
  });
});
