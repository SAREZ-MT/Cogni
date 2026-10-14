import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sampleView } from "../_lib/dashboard-view.fixtures";
import { DashboardHero } from "./hero";

describe("DashboardHero", () => {
  it("greets the user by name", () => {
    render(<DashboardHero hero={sampleView().hero} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Buenos días, Ana" }),
    ).toBeInTheDocument();
  });

  it("points at the weakest notebook, from the same numbers as the page", () => {
    render(<DashboardHero hero={sampleView().hero} />);

    expect(
      screen.getByText(
        "Historia sigue en Aprendiendo: dedícale dos repasos para retomar impulso.",
      ),
    ).toBeInTheDocument();
  });

  it("links the call to action to today's reviews", () => {
    render(<DashboardHero hero={sampleView().hero} />);

    expect(
      screen.getByRole("link", { name: /Ver repasos de hoy/ }),
    ).toHaveAttribute("href", "/");
  });

  it("keeps the illustration decorative", () => {
    const { container } = render(<DashboardHero hero={sampleView().hero} />);

    const illustration = Array.from(container.querySelectorAll("svg")).find(
      (svg) => svg.getAttribute("viewBox") === "0 0 160 140",
    );
    expect(illustration).not.toBeNull();
    expect(illustration).toHaveAttribute("aria-hidden", "true");
  });
});
