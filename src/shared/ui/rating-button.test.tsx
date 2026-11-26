import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RatingButton } from "./rating-button";

describe("RatingButton", () => {
  it("renders only its label under a tone-specific test id", () => {
    render(<RatingButton tone="good" label="Bien" />);

    const button = screen.getByTestId("rate-good");
    expect(button).toHaveTextContent(/^Bien$/);
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<RatingButton tone="hard" label="Difícil" onClick={onClick} />);

    await userEvent.click(screen.getByTestId("rate-hard"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick while disabled", async () => {
    const onClick = vi.fn();
    render(
      <RatingButton tone="easy" label="Fácil" onClick={onClick} disabled />,
    );

    await userEvent.click(screen.getByTestId("rate-easy"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("is not a submit button", () => {
    render(<RatingButton tone="again" label="Otra vez" />);

    expect(screen.getByTestId("rate-again")).toHaveAttribute("type", "button");
  });
});
