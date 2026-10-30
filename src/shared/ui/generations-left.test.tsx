import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GenerationsLeft } from "./generations-left";

// Phase 8 H12: the generate dialogs' daily budget line.
describe("GenerationsLeft", () => {
  it("shows the copy, calm while generations remain", () => {
    render(
      <GenerationsLeft remaining={3} data-testid="left">
        Te quedan 3 generaciones hoy
      </GenerationsLeft>,
    );

    const line = screen.getByTestId("left");
    expect(line).toHaveTextContent("Te quedan 3 generaciones hoy");
    expect(line).not.toHaveAttribute("data-reached");
  });

  it("flags the reached limit", () => {
    render(
      <GenerationsLeft remaining={0} data-testid="left">
        Llegaste al límite de hoy. Vuelve mañana.
      </GenerationsLeft>,
    );

    expect(screen.getByTestId("left")).toHaveAttribute("data-reached", "true");
  });
});
