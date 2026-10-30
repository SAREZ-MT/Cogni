import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyStateCta } from "./empty-state-cta";

// Phase 8 H10: the violet pill of the illustrated empty states, as a link.
describe("EmptyStateCta", () => {
  it("is a link to the given route with its label as the name", () => {
    render(<EmptyStateCta href="/notebooks">Ir a mis cuadernos</EmptyStateCta>);

    const link = screen.getByRole("link", { name: "Ir a mis cuadernos" });
    expect(link).toHaveAttribute("href", "/notebooks");
    expect(link).toHaveClass("rounded-pill", "bg-primary-600");
  });

  // Phase 8 H11: inside a technique theme the pill takes the technique's
  // CTA colours (technique-cta) instead of the violet.
  it("takes the technique colours with tone technique", () => {
    render(
      <EmptyStateCta href="/notebooks" tone="technique">
        Ir
      </EmptyStateCta>,
    );

    const link = screen.getByRole("link", { name: "Ir" });
    expect(link).toHaveClass("rounded-pill", "technique-cta");
    expect(link).not.toHaveClass("bg-primary-600");
  });

  // Phase 8 H11: without `href` it is a button (a dialog trigger).
  it("is a button that forwards its handlers when no href is given", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyStateCta tone="technique" onClick={onClick}>
        Crear mi primer examen
      </EmptyStateCta>,
    );

    const button = screen.getByRole("button", {
      name: "Crear mi primer examen",
    });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("rounded-pill", "technique-cta");
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
