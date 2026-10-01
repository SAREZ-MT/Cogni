import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DifficultyScale } from "./difficulty-scale";

describe("DifficultyScale", () => {
  it("asks how hard the answer was", () => {
    render(<DifficultyScale onSelect={() => {}} />);

    expect(
      screen.getByText("¿Qué tan difícil te resultó?"),
    ).toBeInTheDocument();
  });

  it("offers the six labelled options 0 to 5, imposible to trivial", () => {
    render(<DifficultyScale onSelect={() => {}} />);

    const expected = [
      "Imposible",
      "Muy difícil",
      "Difícil",
      "Regular",
      "Fácil",
      "Trivial",
    ];
    expected.forEach((label, value) => {
      const button = screen.getByTestId(`self-rate-${value}`);
      expect(button).toHaveTextContent(String(value));
      expect(button).toHaveTextContent(label);
    });
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });

  it.each([0, 3, 5])("reports %i when that option is chosen", async (value) => {
    const onSelect = vi.fn();
    render(<DifficultyScale onSelect={onSelect} />);

    await userEvent.click(screen.getByTestId(`self-rate-${value}`));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(value);
  });

  it("tints the scale error, warning, success from hard to easy", () => {
    render(<DifficultyScale onSelect={() => {}} />);

    expect(screen.getByTestId("self-rate-0")).toHaveClass("text-error-600");
    expect(screen.getByTestId("self-rate-1")).toHaveClass("text-error-600");
    expect(screen.getByTestId("self-rate-2")).toHaveClass("text-warning-600");
    expect(screen.getByTestId("self-rate-3")).toHaveClass("text-warning-600");
    expect(screen.getByTestId("self-rate-4")).toHaveClass("text-success-600");
    expect(screen.getByTestId("self-rate-5")).toHaveClass("text-success-600");
  });

  it("does not report anything while disabled", async () => {
    const onSelect = vi.fn();
    render(<DifficultyScale onSelect={onSelect} disabled />);

    expect(screen.getByTestId("self-rate-2")).toBeDisabled();
    await userEvent.click(screen.getByTestId("self-rate-2"));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
