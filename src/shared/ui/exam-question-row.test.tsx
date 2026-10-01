import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ExamQuestionRow,
  type ExamQuestionRowProps,
} from "./exam-question-row";

const BASE: ExamQuestionRowProps = {
  index: 2,
  stem: "¿Dónde ocurre el ciclo de Krebs?",
  concept: "Ciclo de Krebs",
  origin: "ai",
  options: ["Matriz", "Citosol", "Núcleo", "Lisosoma"],
  correctIndex: 0,
  onEdit: () => {},
  onRetire: () => {},
};

describe("ExamQuestionRow", () => {
  it("numbers the stem and shows the concept", () => {
    render(<ExamQuestionRow {...BASE} />);

    expect(
      screen.getByText("2. ¿Dónde ocurre el ciclo de Krebs?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Concepto: Ciclo de Krebs")).toBeInTheDocument();
  });

  it.each([
    ["ai", "IA", "bg-primary-100"],
    ["manual", "Manual", "bg-success-100"],
    ["ai_variant", "Variante", "bg-rose-500/10"],
  ] as const)("labels the %s origin %s with its own tone", (origin, label, tone) => {
    render(<ExamQuestionRow {...BASE} origin={origin} />);

    expect(screen.getByText(label)).toHaveClass(tone);
  });

  it("previews the four options with only the correct one in bold", () => {
    render(<ExamQuestionRow {...BASE} correctIndex={2} />);

    expect(screen.getByText("C) Núcleo").tagName).toBe("STRONG");
    expect(screen.queryByText("A) Matriz")?.tagName).not.toBe("STRONG");
    expect(screen.getByText(/A\) Matriz/)).toBeInTheDocument();
    expect(screen.getByText(/D\) Lisosoma/)).toBeInTheDocument();
  });

  it("calls onEdit and onRetire from its actions", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onRetire = vi.fn();
    render(<ExamQuestionRow {...BASE} onEdit={onEdit} onRetire={onRetire} />);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Retirar" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRetire).toHaveBeenCalledTimes(1);
  });

  it("marks a retired question as muted and offers no 'Retirar'", () => {
    render(
      <ExamQuestionRow {...BASE} retiredAt="22 sept" onRetire={undefined} />,
    );

    expect(screen.getByText("Retirada")).toBeInTheDocument();
    expect(screen.getByTestId("exam-question-row")).toHaveClass("opacity-60");
    expect(
      screen.queryByRole("button", { name: "Retirar" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("shows no retired marker for an active question", () => {
    render(<ExamQuestionRow {...BASE} />);

    expect(screen.queryByText("Retirada")).not.toBeInTheDocument();
    expect(screen.getByTestId("exam-question-row")).not.toHaveClass(
      "opacity-60",
    );
  });
});
