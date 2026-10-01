import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OptionRow, type OptionRowState } from "./option-row";

describe("OptionRow", () => {
  it("shows the letter badge and the option text under an index-based test id", () => {
    render(
      <OptionRow index={2} letter="C" text="Opción tres" state="default" />,
    );

    const row = screen.getByTestId("exam-option-2");
    expect(row).toHaveTextContent("C");
    expect(row).toHaveTextContent("Opción tres");
  });

  it("calls onClick when pressed and not when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <OptionRow
        index={0}
        letter="A"
        text="x"
        state="default"
        onClick={onClick}
      />,
    );

    await user.click(screen.getByTestId("exam-option-0"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <OptionRow
        index={0}
        letter="A"
        text="x"
        state="default"
        onClick={onClick}
        disabled
      />,
    );
    await user.click(screen.getByTestId("exam-option-0"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["selected", "border-rose-500"],
    ["correct", "border-success-500"],
    ["incorrect", "border-error-500"],
    ["muted", "opacity-70"],
  ] as [
    OptionRowState,
    string,
  ][])("paints the %s state with %s", (state, className) => {
    render(<OptionRow index={0} letter="A" text="x" state={state} />);

    expect(screen.getByTestId("exam-option-0")).toHaveClass(className);
  });

  it("swaps the letter for a mark in the correct and incorrect states", () => {
    const { rerender } = render(
      <OptionRow index={0} letter="A" text="x" state="correct" />,
    );
    expect(screen.getByTestId("exam-option-0")).not.toHaveTextContent("A");

    rerender(<OptionRow index={0} letter="A" text="x" state="incorrect" />);
    expect(screen.getByTestId("exam-option-0")).not.toHaveTextContent("A");

    rerender(<OptionRow index={0} letter="A" text="x" state="selected" />);
    expect(screen.getByTestId("exam-option-0")).toHaveTextContent("A");
  });
});
