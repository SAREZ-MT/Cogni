import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnswerTextarea } from "./answer-textarea";

describe("AnswerTextarea", () => {
  it("is an editable textbox that forwards its props", async () => {
    const onChange = vi.fn();
    render(<AnswerTextarea placeholder="Escribe aquí" onChange={onChange} />);

    const box = screen.getByRole("textbox");
    expect(box).toHaveAttribute("placeholder", "Escribe aquí");
    await userEvent.type(box, "hola");

    expect(box).toHaveValue("hola");
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it("merges a caller className without dropping the base look", () => {
    render(<AnswerTextarea className="mt-9" />);

    const box = screen.getByTestId("answer-textarea");
    expect(box).toHaveClass("mt-9");
    expect(box).toHaveClass("min-h-[120px]");
  });

  it("can be disabled", () => {
    render(<AnswerTextarea disabled />);

    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
