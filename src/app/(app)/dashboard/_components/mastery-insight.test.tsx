import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MasteryInsight } from "./mastery-insight";

describe("MasteryInsight", () => {
  it("shows the global mastery percentage", () => {
    render(<MasteryInsight />);

    expect(screen.getByText("Dominio global")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("shows the rising week-over-week delta as success", () => {
    render(<MasteryInsight />);

    const delta = screen.getByText("2 pts vs la semana pasada");
    expect(delta).toHaveClass("text-success-600");
    expect(delta.querySelector("svg")).toHaveClass("lucide-arrow-up");
  });

  it("renders one strip bar per page", () => {
    render(<MasteryInsight />);

    expect(
      screen.getByRole("img", { name: "Dominio por página: 19 páginas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", { name: /Dominio global:/ }),
    ).toBeInTheDocument();
  });
});
