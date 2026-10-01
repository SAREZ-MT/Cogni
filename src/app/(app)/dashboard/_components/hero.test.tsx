import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardHero } from "./hero";

describe("DashboardHero", () => {
  it("greets the user by name", () => {
    render(<DashboardHero />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Buenos días, Valentina" }),
    ).toBeInTheDocument();
  });

  it("states the week's mastery gain and the weakest notebook, from the same numbers as the page", () => {
    render(<DashboardHero />);

    expect(
      screen.getByText(
        "Subiste 2 puntos de dominio esta semana. Historia del Arte sigue en Aprendiendo: dedícale dos repasos.",
      ),
    ).toBeInTheDocument();
  });

  it("links the call to action to today's reviews", () => {
    render(<DashboardHero />);

    expect(
      screen.getByRole("link", { name: /Ver repasos de hoy/ }),
    ).toHaveAttribute("href", "/");
  });

  it("keeps the illustration decorative", () => {
    const { container } = render(<DashboardHero />);

    const illustration = Array.from(container.querySelectorAll("svg")).find(
      (svg) => svg.getAttribute("viewBox") === "0 0 160 140",
    );
    expect(illustration).not.toBeNull();
    expect(illustration).toHaveAttribute("aria-hidden", "true");
  });
});
