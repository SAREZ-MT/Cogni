import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  milestoneHint,
  StreakWeek,
  type StreakWeekDay,
  streakLabel,
} from "./streak-week";

const day = (
  key: string,
  initial: string,
  name: string,
  studied: boolean,
  isToday = false,
): StreakWeekDay => ({ key, initial, name, studied, isToday });

const WEEK = [
  day("2026-10-12", "L", "lunes", false),
  day("2026-10-13", "M", "martes", true),
  day("2026-10-14", "M", "miércoles", false),
  day("2026-10-15", "J", "jueves", true),
  day("2026-10-16", "V", "viernes", true),
  day("2026-10-17", "S", "sábado", true),
  day("2026-10-18", "D", "domingo", false, true),
];

describe("streakLabel", () => {
  it("uses the singular for one day", () => {
    expect(streakLabel(0)).toBe("0 días seguidos");
    expect(streakLabel(1)).toBe("1 día seguido");
    expect(streakLabel(12)).toBe("12 días seguidos");
  });
});

describe("milestoneHint", () => {
  it("counts the days left to the next milestone", () => {
    expect(milestoneHint(0)).toBeNull();
    expect(milestoneHint(1)).toBe("6 días más para tu primera semana");
    expect(milestoneHint(6)).toBe("1 día más para tu primera semana");
    expect(milestoneHint(7)).toBe("23 días más para llegar a 30");
    expect(milestoneHint(99)).toBe("1 día más para llegar a 100");
    expect(milestoneHint(100)).toBeNull();
  });
});

describe("StreakWeek", () => {
  it("shows the streak number, the helper and one item per day with a text status", () => {
    render(
      <StreakWeek
        streakDays={3}
        helper="Repasa hoy para no perder tu racha."
        days={WEEK}
      />,
    );

    expect(screen.getByText("3 días seguidos")).toBeInTheDocument();
    expect(
      screen.getByText("Repasa hoy para no perder tu racha."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("4 días más para tu primera semana"),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Últimos 7 días" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(items[0]).toHaveTextContent("lunes: sin repasos");
    expect(items[6]).toHaveTextContent("domingo (hoy): sin repasos");
    expect(items[6]).toHaveAttribute("data-today", "true");
    expect(items[5]).not.toHaveAttribute("data-today");
  });

  it("joins consecutive reviewed days and only marks reviewed days", () => {
    const { container } = render(
      <StreakWeek streakDays={3} helper="h" days={WEEK} />,
    );

    // jueves→viernes and viernes→sábado are linked; martes stands alone.
    expect(container.querySelectorAll('[data-part="link"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="check"]')).toHaveLength(4);
  });

  it("is dormant without a streak and lit with one", () => {
    const { container, rerender } = render(
      <StreakWeek streakDays={0} helper="h" days={WEEK} />,
    );
    const block = container.querySelector('[data-slot="streak-week"]');
    expect(block).toHaveAttribute("data-state", "dormant");
    expect(screen.queryByText(/para tu primera semana/)).toBeNull();

    rerender(<StreakWeek streakDays={2} helper="h" days={WEEK} />);
    expect(block).toHaveAttribute("data-state", "lit");
  });
});
