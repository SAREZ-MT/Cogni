import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sampleView } from "../_lib/dashboard-view.fixtures";
import { DashboardHero } from "./hero";

describe("DashboardHero", () => {
  it("welcomes the user back by name", () => {
    render(<DashboardHero hero={sampleView().hero} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Qué gusto volver a verte por acá, Ana",
      }),
    ).toBeInTheDocument();
  });

  it("welcomes without a comma when the account has no name", () => {
    render(<DashboardHero hero={{ ...sampleView().hero, name: "" }} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Qué gusto volver a verte por acá",
      }),
    ).toBeInTheDocument();
  });

  it("says what the page is for, in an encouraging line", () => {
    render(<DashboardHero hero={sampleView().hero} />);

    expect(
      screen.getByText(
        "Tu esfuerzo se nota semana a semana. Revisa tus métricas, descubre qué temas ya dominas y cuáles te conviene repasar.",
      ),
    ).toBeInTheDocument();
  });

  // Hidden, not removed (user decision 2026-11-26).
  it("hides the reviews button and the weakest-notebook sentence", () => {
    render(<DashboardHero hero={sampleView().hero} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/dedícale dos repasos/)).toBeNull();
  });

  it("keeps the illustration decorative", () => {
    const { container } = render(<DashboardHero hero={sampleView().hero} />);

    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
