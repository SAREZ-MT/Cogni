import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TechniqueCreateTile } from "./technique-create-tile";

// Phase 8 H11: the first, fixed item of a technique hub's grid, in the
// "Nuevo cuaderno" / "Nueva página" create-tile language.
describe("TechniqueCreateTile", () => {
  it("is a button named by its label, with a hint", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <TechniqueCreateTile
        technique="flashcards"
        label="Crear flashcards"
        hint="Elige una página de tus cuadernos"
        onClick={onClick}
      />,
    );

    const tile = screen.getByRole("button", { name: "Crear flashcards" });
    expect(tile).toHaveAttribute("type", "button");
    expect(tile).toHaveAttribute("data-slot", "technique-create-tile");
    expect(
      screen.getByText("Elige una página de tus cuadernos"),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-part="plus"]')).toBeInTheDocument();
    await user.click(tile);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("fills its grid cell at least as tall as a technique item card", () => {
    render(<TechniqueCreateTile technique="exams" label="Crear examen" />);

    expect(screen.getByRole("button", { name: "Crear examen" })).toHaveClass(
      "h-full",
      "min-h-[212px]",
    );
  });

  // Phase 8 H17 (user-approved flat hubs, 2026-10-29): the tile is dashed
  // in its technique's colour, with the technique CTA's disc.
  it("is themed by its technique: dashes, tint and the CTA's disc", () => {
    const { container } = render(
      <TechniqueCreateTile technique="recall" label="Generar preguntas" />,
    );

    const tile = screen.getByRole("button", { name: "Generar preguntas" });
    expect(tile).toHaveAttribute("data-technique-theme", "recall");
    expect(tile).toHaveClass(
      "border-dashed",
      "border-(--theme-dash)",
      "bg-(--theme-tint)",
    );
    expect(container.querySelector('[data-part="plus"]')).toHaveClass(
      "bg-(--theme-cta)",
    );
  });
});
