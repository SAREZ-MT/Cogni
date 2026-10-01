import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartCard } from "./chart-card";

describe("ChartCard", () => {
  it("names the chart body with its aria-label", () => {
    render(
      <ChartCard title="Actividad" ariaLabel="Repasos por día">
        <p>cuerpo</p>
      </ChartCard>,
    );

    const figure = screen.getByRole("figure", { name: "Repasos por día" });
    expect(figure).toHaveTextContent("cuerpo");
  });

  it("renders the title as a heading with optional description and eyebrow", () => {
    render(
      <ChartCard
        title="Actividad"
        eyebrow="Progreso"
        description="Últimos días"
        ariaLabel="x"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Actividad" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Progreso")).toBeInTheDocument();
    expect(screen.getByText("Últimos días")).toBeInTheDocument();
  });

  it("omits eyebrow and description when not given", () => {
    const { container } = render(<ChartCard title="Solo" ariaLabel="x" />);

    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("renders the icon, actions and footer slots", () => {
    render(
      <ChartCard
        title="T"
        ariaLabel="x"
        icon={<span data-testid="icon" />}
        actions={<button type="button">filtro</button>}
        footer={<p>pie</p>}
      />,
    );

    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "filtro" })).toBeInTheDocument();
    expect(screen.getByText("pie")).toBeInTheDocument();
  });

  it("draws the header divider only when asked", () => {
    const { container, rerender } = render(
      <ChartCard title="T" ariaLabel="x" />,
    );
    expect(container.querySelector(".border-b")).toBeNull();

    rerender(<ChartCard title="T" ariaLabel="x" divider />);
    expect(container.querySelector(".border-b")).not.toBeNull();
  });

  it("forwards props and body classes", () => {
    render(
      <ChartCard
        title="T"
        ariaLabel="x"
        data-testid="card"
        bodyClassName="body-extra"
      />,
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByRole("figure")).toHaveClass("body-extra");
  });
});
