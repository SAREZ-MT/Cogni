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

  it("fills its grid cell at least as tall as a deck summary card", () => {
    render(<TechniqueCreateTile label="Crear examen" />);

    expect(screen.getByRole("button", { name: "Crear examen" })).toHaveClass(
      "h-full",
      "min-h-[156px]",
    );
  });
});
