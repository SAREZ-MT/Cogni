import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CountStepper } from "./count-stepper";

function Controlled({
  initial = 10,
  onChange,
  disabled,
}: {
  initial?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CountStepper
      label="Preguntas"
      value={value}
      min={10}
      max={30}
      step={5}
      disabled={disabled}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      testId="count"
    />
  );
}

describe("CountStepper", () => {
  it("shows the label and the current value inside a labelled group", () => {
    render(<Controlled />);

    expect(screen.getByRole("group", { name: "Preguntas" })).toBeVisible();
    expect(screen.getByTestId("count-value")).toHaveTextContent("10");
  });

  it("steps up and down within the bounds", async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const more = screen.getByRole("button", { name: "Más preguntas" });
    const less = screen.getByRole("button", { name: "Menos preguntas" });

    expect(less).toBeDisabled();
    await userEvent.click(more);
    await userEvent.click(more);
    expect(screen.getByTestId("count-value")).toHaveTextContent("20");
    expect(onChange).toHaveBeenLastCalledWith(20);
    await userEvent.click(less);
    expect(screen.getByTestId("count-value")).toHaveTextContent("15");
  });

  it("disables the increase at the maximum and never passes it", async () => {
    render(<Controlled initial={28} />);
    const more = screen.getByRole("button", { name: "Más preguntas" });

    await userEvent.click(more);
    expect(screen.getByTestId("count-value")).toHaveTextContent("30");
    expect(more).toBeDisabled();
  });

  it("disables both buttons when disabled", () => {
    render(<Controlled initial={20} disabled />);

    expect(
      screen.getByRole("button", { name: "Más preguntas" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Menos preguntas" }),
    ).toBeDisabled();
  });

  // Phase 8 H12: the dialogs' larger field, with the range as a hint.
  it("has a field size for dialogs that shows the range", () => {
    render(
      <CountStepper
        label="Preguntas a generar"
        value={10}
        min={10}
        max={30}
        onChange={() => {}}
        size="field"
        hint="Entre 10 y 30"
      />,
    );

    const group = screen.getByRole("group", { name: "Preguntas a generar" });
    expect(group).toHaveAttribute("data-size", "field");
    expect(group).toHaveTextContent("Entre 10 y 30");
  });
});
