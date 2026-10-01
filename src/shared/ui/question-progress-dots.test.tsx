import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuestionProgressDots } from "./question-progress-dots";

describe("QuestionProgressDots", () => {
  it("renders one jump button per question", () => {
    render(
      <QuestionProgressDots
        total={4}
        current={0}
        answered={new Set()}
        onJump={() => {}}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: "Ir a la pregunta 4" }),
    ).toBeInTheDocument();
  });

  it("marks only the current question with aria-current", () => {
    render(
      <QuestionProgressDots
        total={3}
        current={1}
        answered={new Set()}
        onJump={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Ir a la pregunta 2" }),
    ).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("button", { name: "Ir a la pregunta 1" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("tints answered, current and unanswered dots differently", () => {
    render(
      <QuestionProgressDots
        total={3}
        current={0}
        answered={new Set([0, 2])}
        onJump={() => {}}
      />,
    );

    const [first, second, third] = screen.getAllByRole("button");
    // The current dot wins over the answered tint.
    expect(first).toHaveClass("bg-rose-500");
    expect(second).toHaveClass("bg-neutral-200/60");
    expect(third).toHaveClass("bg-pastel-pink-fg");
  });

  it("jumps to the zero-based index of the clicked dot", async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();
    render(
      <QuestionProgressDots
        total={3}
        current={0}
        answered={new Set()}
        onJump={onJump}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Ir a la pregunta 3" }),
    );

    expect(onJump).toHaveBeenCalledWith(2);
  });
});
