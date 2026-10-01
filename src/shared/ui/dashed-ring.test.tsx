import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashedRing } from "./dashed-ring";

function progressCircle(container: HTMLElement): SVGCircleElement {
  return container.querySelectorAll("circle")[1] as SVGCircleElement;
}

describe("DashedRing", () => {
  it("states the value in words for screen readers and shows it centred", () => {
    render(
      <DashedRing
        value={76}
        label="Tasa de acierto"
        icon={<i data-testid="i" />}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Tasa de acierto: 76%" }),
    ).toBeInTheDocument();
    expect(screen.getByText("76%")).toBeInTheDocument();
    expect(screen.getByText("Tasa de acierto")).toBeInTheDocument();
    expect(screen.getByTestId("i")).toBeInTheDocument();
  });

  it("draws the progress arc proportional to the value", () => {
    const { container } = render(
      <DashedRing value={25} label="x" icon={null} size={100} />,
    );

    const radius = 100 / 2 - 8;
    const circumference = 2 * Math.PI * radius;
    expect(progressCircle(container).getAttribute("stroke-dasharray")).toBe(
      `${0.25 * circumference} ${circumference}`,
    );
  });

  it("draws the track as a dashed circle", () => {
    const { container } = render(
      <DashedRing value={50} label="x" icon={null} />,
    );

    expect(container.querySelectorAll("circle")[0]).toHaveAttribute(
      "stroke-dasharray",
      "2 6",
    );
  });

  it("clamps values outside 0-100 and rounds the label", () => {
    const { rerender } = render(
      <DashedRing value={140} label="x" icon={null} />,
    );
    expect(screen.getByRole("img", { name: "x: 100%" })).toBeInTheDocument();

    rerender(<DashedRing value={-5} label="x" icon={null} />);
    expect(screen.getByRole("img", { name: "x: 0%" })).toBeInTheDocument();

    rerender(<DashedRing value={61.6} label="x" icon={null} />);
    expect(screen.getByText("62%")).toBeInTheDocument();
  });

  it("uses the primary token by default and accepts another colour", () => {
    const { container, rerender } = render(
      <DashedRing value={50} label="x" icon={null} />,
    );
    expect(progressCircle(container)).toHaveAttribute(
      "stroke",
      "var(--color-primary-600)",
    );

    rerender(
      <DashedRing
        value={50}
        label="x"
        icon={null}
        colorVar="var(--color-success-600)"
      />,
    );
    expect(progressCircle(container)).toHaveAttribute(
      "stroke",
      "var(--color-success-600)",
    );
  });

  it("applies the requested size", () => {
    const { container } = render(
      <DashedRing value={50} label="x" icon={null} size={120} />,
    );

    expect(container.firstElementChild).toHaveStyle({
      width: "120px",
      height: "120px",
    });
  });
});
