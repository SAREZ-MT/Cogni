import { render, screen } from "@testing-library/react";
import { Layers } from "lucide-react";
import { describe, expect, it } from "vitest";
import { TechniqueCard, TechniqueIconStrip } from "./technique-card";

describe("TechniqueCard", () => {
  function renderCard(props: { disabled?: boolean } = {}) {
    return render(
      <TechniqueCard
        icon={Layers}
        tone="primary"
        name="Flashcards"
        description="Tarjetas con repetición espaciada"
        {...props}
      />,
    );
  }

  it("shows the name and description", () => {
    renderCard();

    expect(screen.getByText("Flashcards")).toBeInTheDocument();
    expect(
      screen.getByText("Tarjetas con repetición espaciada"),
    ).toBeInTheDocument();
  });

  it("offers a single 'Generar' action that is disabled and flagged as coming soon by default", () => {
    renderCard();

    const action = screen.getByRole("button", { name: "Generar" });
    expect(action).toBeDisabled();
    expect(action).toHaveAttribute("aria-disabled", "true");
    expect(action).toHaveAttribute("title", "Disponible pronto");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("enables the action once the technique is wired up", () => {
    renderCard({ disabled: false });

    const action = screen.getByRole("button", { name: "Generar" });
    expect(action).toBeEnabled();
    expect(action).not.toHaveAttribute("title");
  });

  it("is not a link: generating never navigates to a route that may not exist", () => {
    renderCard();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("pronto")).not.toBeInTheDocument();
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
