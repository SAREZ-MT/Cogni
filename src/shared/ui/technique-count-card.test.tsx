import { render, screen } from "@testing-library/react";
import { Layers } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  TechniqueCountCard,
  type TechniqueCountCardProps,
} from "./technique-count-card";

const BASE: TechniqueCountCardProps = {
  href: "/flashcards",
  icon: Layers,
  tone: "yellow",
  label: "Flashcards",
  value: "3",
  valueSuffix: "de 8",
  emphasis: "tone",
  sub: "repasos hechos hoy",
  ring: { percent: 37, center: "percent" },
  ariaLabel: "Flashcards: 3 de 8 repasos hechos hoy",
};

describe("TechniqueCountCard", () => {
  it("is one link to the technique hub with today's progress", () => {
    render(<TechniqueCountCard {...BASE} />);

    const link = screen.getByRole("link", {
      name: "Flashcards: 3 de 8 repasos hechos hoy",
    });
    expect(link).toHaveAttribute("href", "/flashcards");
    expect(link).toHaveTextContent("Flashcards");
    expect(link).toHaveTextContent("3");
    expect(link).toHaveTextContent("de 8");
    expect(link).toHaveTextContent("repasos hechos hoy");
    expect(link).toHaveTextContent("37%");
  });

  it("colours a toned value with the technique's shade", () => {
    const { rerender } = render(<TechniqueCountCard {...BASE} />);
    expect(screen.getByText("3")).toHaveClass("text-warning-600");

    rerender(<TechniqueCountCard {...BASE} tone="green" />);
    expect(screen.getByText("3")).toHaveClass("text-success-600");

    rerender(<TechniqueCountCard {...BASE} tone="rose" />);
    expect(screen.getByText("3")).toHaveClass("text-rose-600");
  });

  it("mutes a phrase value and shows a dash in the ring", () => {
    const { container } = render(
      <TechniqueCountCard
        {...BASE}
        value="Aún no generas"
        valueSuffix={null}
        emphasis="muted"
        sub="Genera desde una página"
        ring={{ percent: 0, center: "dash" }}
      />,
    );
    expect(screen.getByText("Aún no generas")).toHaveClass("text-fg-secondary");
    expect(
      container.querySelector('[data-slot="progress-ring"]'),
    ).toHaveTextContent("—");
    expect(screen.queryByText("de 8")).not.toBeInTheDocument();
  });

  it("shows a check in a full ring when the day is done", () => {
    const { container } = render(
      <TechniqueCountCard
        {...BASE}
        value="Al día"
        valueSuffix={null}
        ring={{ percent: 100, center: "check" }}
      />,
    );
    const ring = container.querySelector('[data-slot="progress-ring"]');
    expect(ring?.querySelector("svg.lucide-check")).not.toBeNull();
    expect(
      container.querySelector('[data-slot="progress-ring-indicator"]'),
    ).toHaveAttribute("stroke-dasharray", "100 100");
  });
});
