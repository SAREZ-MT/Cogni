import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DotStreak } from "./dot-streak";

describe("DotStreak", () => {
  it("summarises studied days for screen readers", () => {
    render(<DotStreak days={[true, false, true, true]} streakDays={2} />);

    expect(
      screen.getByRole("img", { name: "3 de 4 días con repasos" }),
    ).toBeInTheDocument();
  });

  it("renders one dot per day, filled only for studied days", () => {
    render(
      <DotStreak
        days={[true, false, true]}
        streakDays={1}
        toneClassName="bg-rose-600"
      />,
    );

    const dots = screen.getByRole("img").children;
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveClass("bg-rose-600");
    expect(dots[1]).toHaveClass("bg-neutral-200");
    expect(dots[2]).toHaveClass("bg-rose-600");
  });

  it("pluralises the streak caption", () => {
    const { rerender } = render(<DotStreak days={[true]} streakDays={1} />);
    expect(screen.getByText("Racha · 1 día")).toBeInTheDocument();

    rerender(<DotStreak days={[true]} streakDays={9} />);
    expect(screen.getByText("Racha · 9 días")).toBeInTheDocument();

    rerender(<DotStreak days={[false]} streakDays={0} />);
    expect(screen.getByText("Racha · 0 días")).toBeInTheDocument();
  });
});
