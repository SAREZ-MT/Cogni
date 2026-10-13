import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  CalendarCellView,
  CalendarPeriodView,
} from "../_lib/calendar-view";
import { CalendarPeriod } from "./calendar-period";

const cell = (
  day: string,
  overrides: Partial<CalendarCellView> = {},
): CalendarCellView => ({
  day,
  dayNumber: Number(day.slice(8)),
  label: `día ${day}`,
  weekday: "Lun",
  isToday: false,
  outside: false,
  events: [],
  ...overrides,
});

const VIEW: CalendarPeriodView = {
  title: "Octubre 2026",
  rangeLabel: "1 oct 2026 – 31 oct 2026",
  nav: {
    prev: { href: "/p", label: "Mes anterior" },
    today: { href: "/t", label: "Hoy" },
    next: { href: "/n", label: "Mes siguiente" },
  },
  cells: [
    cell("2026-09-30", { outside: true }),
    cell("2026-10-12", { isToday: true }),
    cell("2026-10-14", {
      events: [
        {
          key: "p1:flashcard",
          tone: "yellow",
          label: "Mitosis",
          meta: "3",
          href: "/notebooks/nb/pages/p1",
          ariaLabel: "Flashcards de Mitosis: 3 ítems",
        },
        {
          key: "p1:exam_question",
          tone: "rose",
          label: "Mitosis",
          meta: "1",
          href: "/notebooks/nb/pages/p1",
          ariaLabel: "Examen de Mitosis: 1 ítem",
        },
      ],
      more: { count: 2, href: "/calendario?view=semana&date=2026-10-14" },
    }),
  ],
};

describe("CalendarPeriod", () => {
  it("renders every day of the period in a grid named by its title", () => {
    render(<CalendarPeriod view={VIEW} variant="month" />);

    const grid = screen.getByRole("list", { name: "Octubre 2026" });
    const days = within(grid).getAllByRole("listitem");
    expect(days.map((day) => day.getAttribute("data-day"))).toEqual([
      "2026-09-30",
      "2026-10-12",
      "2026-10-14",
    ]);
    expect(days[0]).toHaveAttribute("data-outside", "true");
    expect(days[1]).toHaveAttribute("data-today", "true");
  });

  it("links each event chip to its page, coloured by technique", () => {
    render(<CalendarPeriod view={VIEW} variant="month" />);

    const flashcards = screen.getByRole("link", {
      name: "Flashcards de Mitosis: 3 ítems",
    });
    expect(flashcards).toHaveAttribute("href", "/notebooks/nb/pages/p1");
    expect(flashcards).toHaveAttribute("data-tone", "yellow");
    expect(flashcards).toHaveAttribute(
      "title",
      "Flashcards de Mitosis: 3 ítems",
    );
    expect(flashcards).toHaveTextContent("Mitosis3");
    expect(
      screen.getByRole("link", { name: "Examen de Mitosis: 1 ítem" }),
    ).toHaveAttribute("data-tone", "rose");
    expect(
      screen.getByRole("link", { name: "2 más el día 2026-10-14" }),
    ).toHaveAttribute("href", "/calendario?view=semana&date=2026-10-14");
  });

  it("collapses month chips to dots on narrow screens but keeps week chips whole", () => {
    const { unmount } = render(<CalendarPeriod view={VIEW} variant="month" />);
    expect(
      screen.getByRole("link", { name: "Examen de Mitosis: 1 ítem" }),
    ).toHaveAttribute("data-collapse", "dot-when-narrow");
    unmount();

    render(<CalendarPeriod view={VIEW} variant="week" />);
    expect(
      screen.getByRole("link", { name: "Examen de Mitosis: 1 ítem" }),
    ).not.toHaveAttribute("data-collapse");
    expect(screen.getByTestId("calendar-weekdays")).toHaveClass(
      "@max-2xl:hidden",
    );
  });
});
