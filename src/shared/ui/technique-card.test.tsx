import { render, screen } from "@testing-library/react";
import { Layers } from "lucide-react";
import { describe, expect, it } from "vitest";
import { TechniqueCard, TechniqueIconStrip } from "./technique-card";

describe("TechniqueCard", () => {
  function renderCard() {
    return render(
      <TechniqueCard
        icon={Layers}
        tone="primary"
        name="Flashcards"
        description="Tarjetas con repetición espaciada"
        meta="Sin tarjetas todavía"
        actionLabel="Generar"
      />,
    );
  }

  it("shows the name, description and meta", () => {
    renderCard();

    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(
      screen.getByText("Tarjetas con repetición espaciada"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sin tarjetas todavía")).toBeInTheDocument();
  });

  it("keeps the action disabled and flags the technique as coming soon", () => {
    renderCard();

    expect(screen.getByRole("button", { name: "Generar" })).toBeDisabled();
    expect(screen.getByText("pronto")).toBeInTheDocument();
  });

  it("is not a link: it never navigates to a route that may not exist", () => {
    renderCard();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("TechniqueIconStrip", () => {
  it("exposes the technique name as a tooltip title", () => {
    render(
      <TechniqueIconStrip icon={Layers} tone="green" title="Active recall" />,
    );

    expect(screen.getByTitle("Active recall")).toBeInTheDocument();
  });

  it("is dimmed unless the technique is available", () => {
    const { rerender } = render(
      <TechniqueIconStrip icon={Layers} tone="green" title="t" />,
    );
    expect(screen.getByTitle("t")).toHaveClass("opacity-35");

    rerender(
      <TechniqueIconStrip icon={Layers} tone="green" title="t" available />,
    );
    expect(screen.getByTitle("t")).not.toHaveClass("opacity-35");
  });
});
