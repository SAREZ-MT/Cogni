import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KpiCard } from "./kpi-card";

vi.mock("@/shared/ui/sparkline", () => ({
  Sparkline: ({ data }: { data: readonly number[] }) => (
    <div data-testid="sparkline">{data.join(",")}</div>
  ),
}));

describe("KpiCard", () => {
  it("shows label, value and hint", () => {
    render(<KpiCard label="Ítems vencidos" value="62" hint="de 390" />);

    expect(screen.getByText("Ítems vencidos")).toHaveAttribute(
      "title",
      "Ítems vencidos",
    );
    expect(screen.getByText("62")).toBeInTheDocument();
    expect(screen.getByText("de 390")).toBeInTheDocument();
  });

  it("omits the delta pill without a deltaLabel", () => {
    const { container } = render(<KpiCard label="L" value="1" />);

    expect(container.querySelector(".rounded-pill")).toBeNull();
  });

  it.each([
    ["success", "bg-success-100"],
    ["error", "bg-error-100"],
    ["neutral", "bg-neutral-150"],
  ] as const)("tones the delta pill %s", (deltaTone, cls) => {
    const { container } = render(
      <KpiCard label="L" value="1" deltaLabel="+2" deltaTone={deltaTone} />,
    );

    expect(container.querySelector(".rounded-pill")).toHaveClass(cls);
  });

  it.each([
    ["up", "lucide-arrow-up"],
    ["down", "lucide-arrow-down"],
    ["flat", "lucide-minus"],
  ] as const)("picks the %s arrow independently of the tone", (dir, cls) => {
    const { container } = render(
      <KpiCard
        label="L"
        value="1"
        deltaLabel="-11"
        deltaDirection={dir}
        deltaTone="success"
      />,
    );

    expect(container.querySelector("svg")).toHaveClass(cls);
  });

  it("draws a sparkline only with at least two points", () => {
    const { rerender } = render(
      <KpiCard label="L" value="1" sparklineData={[1]} />,
    );
    expect(screen.queryByTestId("sparkline")).toBeNull();

    rerender(<KpiCard label="L" value="1" sparklineData={[1, 2, 3]} />);
    expect(screen.getByTestId("sparkline")).toHaveTextContent("1,2,3");
  });

  it("forwards its test id", () => {
    render(<KpiCard label="L" value="1" data-testid="kpi" />);

    expect(screen.getByTestId("kpi")).toBeInTheDocument();
  });
});
