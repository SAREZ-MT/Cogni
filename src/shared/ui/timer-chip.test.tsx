import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimerChip } from "./timer-chip";

describe("TimerChip", () => {
  it.each([
    [0, "00:00"],
    [59, "00:59"],
    [60, "01:00"],
    [125, "02:05"],
    [3599, "59:59"],
  ])("formats %s seconds as %s", (seconds, label) => {
    render(<TimerChip seconds={seconds} />);

    expect(screen.getByTestId("exam-timer")).toHaveTextContent(label);
  });

  it("floors fractions and clamps negatives to zero", () => {
    const { rerender } = render(<TimerChip seconds={61.9} />);
    expect(screen.getByTestId("exam-timer")).toHaveTextContent("01:01");

    rerender(<TimerChip seconds={-5} />);
    expect(screen.getByTestId("exam-timer")).toHaveTextContent("00:00");
  });
});
