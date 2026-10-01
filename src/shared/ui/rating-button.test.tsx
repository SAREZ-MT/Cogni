import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RatingButton } from "./rating-button";

describe("RatingButton", () => {
  it("renders its label and hint under a tone-specific test id", () => {
    render(<RatingButton tone="good" label="Bien" hint="Mañana" />);

    const button = screen.getByTestId("rate-good");
    expect(button).toHaveTextContent("Bien");
    expect(button).toHaveTextContent("Mañana");
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(
      <RatingButton tone="hard" label="Difícil" hint="h" onClick={onClick} />,
    );

    await userEvent.click(screen.getByTestId("rate-hard"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick while disabled", async () => {
    const onClick = vi.fn();
    render(
      <RatingButton
        tone="easy"
        label="Fácil"
        hint="h"
        onClick={onClick}
        disabled
      />,
    );

    await userEvent.click(screen.getByTestId("rate-easy"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("is not a submit button", () => {
    render(<RatingButton tone="again" label="Otra vez" hint="h" />);

    expect(screen.getByTestId("rate-again")).toHaveAttribute("type", "button");
  });
});
