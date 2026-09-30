import { render, screen } from "@testing-library/react";
import { NotebookPen } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatCard } from "./stat-card";

// ui_kits/app/Home Page.html .stat-card: pastel icon circle + label, big
// value, an optional hint line, and a thin progress bar only when a real
// ratio was passed in (Product decision 1: never an invented metric).
describe("StatCard", () => {
  it("renders the label, value and hint", () => {
    render(
      <StatCard
        label="Cuadernos"
        icon={<NotebookPen aria-hidden="true" size={14} />}
        iconBgClass="bg-pastel-purple text-pastel-purple-fg"
        value="3"
        hint="12 páginas en total"
      />,
    );

    expect(screen.getByText("Cuadernos")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("12 páginas en total")).toBeInTheDocument();
  });

  it("renders no progress bar when none is given", () => {
    const { container } = render(
      <StatCard
        label="Cuadernos"
        icon={<NotebookPen aria-hidden="true" size={14} />}
        iconBgClass="bg-pastel-purple text-pastel-purple-fg"
        value="3"
      />,
    );

    expect(container.querySelector('[data-slot="progress-bar"]')).toBeNull();
  });

  it("renders a progress bar clamped to [0, 100] when a real ratio is given", () => {
    const { container } = render(
      <StatCard
        label="Editadas esta semana"
        icon={<NotebookPen aria-hidden="true" size={14} />}
        iconBgClass="bg-pastel-green text-pastel-green-fg"
        value="2"
        progress={140}
      />,
    );

    const fill = container.querySelector('[data-slot="progress-fill"]');
    expect(fill).toHaveStyle({ width: "100%" });
  });

  it("names the progress bar after the stat label", () => {
    render(
      <StatCard
        label="Editadas esta semana"
        icon={<NotebookPen aria-hidden="true" size={14} />}
        iconBgClass="bg-pastel-green text-pastel-green-fg"
        value="2"
        progress={60}
      />,
    );

    const bar = screen.getByRole("progressbar", {
      name: "Editadas esta semana",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "60");
  });

  it("gives each card's bar its own label reference", () => {
    render(
      <>
        <StatCard
          label="Uno"
          icon={null}
          iconBgClass=""
          value="1"
          progress={10}
        />
        <StatCard
          label="Dos"
          icon={null}
          iconBgClass=""
          value="2"
          progress={20}
        />
      </>,
    );

    expect(screen.getByRole("progressbar", { name: "Uno" })).toHaveAttribute(
      "aria-valuenow",
      "10",
    );
    expect(screen.getByRole("progressbar", { name: "Dos" })).toHaveAttribute(
      "aria-valuenow",
      "20",
    );
  });
});
