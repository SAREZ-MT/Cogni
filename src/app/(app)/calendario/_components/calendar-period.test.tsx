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
  nav: {
    prev: { href: "/p", label: "Mes anterior" },
    next: { href: "/n", label: "Mes siguiente" },
  },
  badgeDay: "2026-10-12",
  cells: [
    cell("2026-09-30", { outside: true }),
    cell("2026-10-12", { isToday: true }),
    cell("2026-10-14", {
      events: [
        {
          key: "p1:flashcard",
          tone: "yellow",
          techniqueLabel: "Flashcards",
          label: "Mitosis",
          meta: "Biología",
          href: "/notebooks/nb/pages/p1",
          ariaLabel: "Flashcards de Mitosis: 3 ítems",
        },
        {
          key: "p1:exam_question",
          tone: "rose",
          techniqueLabel: "Examen",
          label: "Mitosis",
          meta: "Biología",
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
    expect(flashcards).toHaveTextContent("Mitosis");
    expect(flashcards).not.toHaveTextContent("3");
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

  it("puts the week's day numbers in the weekday header and notebook sublines on chips", () => {
    render(<CalendarPeriod view={VIEW} variant="week" />);

    const header = screen.getByTestId("calendar-weekdays");
    const numbers = header.querySelectorAll('[data-part="weekday-number"]');
    expect([...numbers].map((number) => number.textContent)).toEqual([
      "30",
      "12",
      "14",
    ]);
    expect(numbers[1]).toHaveClass("bg-primary-600");
    // The cells show their number only where the days stack.
    const days = screen.getAllByRole("listitem");
    expect(days[1]?.querySelector('[data-part="number-row"]')).toHaveClass(
      "@2xl:hidden",
    );
    expect(days[1]).not.toHaveClass("bg-primary-50");
    const chip = screen.getByRole("link", {
      name: "Flashcards de Mitosis: 3 ítems",
    });
    expect(chip.querySelector('[data-part="meta"]')).toHaveTextContent(
      "Biología",
    );
    expect(chip.querySelector('[data-part="label"]')).toHaveClass(
      "line-clamp-2",
    );
  });

  it("lets the week grid fill the card's height, not the month", () => {
    const { unmount } = render(<CalendarPeriod view={VIEW} variant="week" />);
    expect(
      document.querySelector('[data-slot="calendar-grid-frame"]'),
    ).toHaveClass("flex-1");
    unmount();
    render(<CalendarPeriod view={VIEW} variant="month" />);
    expect(
      document.querySelector('[data-slot="calendar-grid-frame"]'),
    ).not.toHaveClass("flex-1");
  });

  it("keeps month chips to one title line and the numbers in the cells", () => {
    render(
      <CalendarPeriod
        view={{ ...VIEW, cells: [...VIEW.cells, cell("2026-10-15")] }}
        variant="month"
      />,
    );
    const chip = screen.getByRole("link", {
      name: "Flashcards de Mitosis: 3 ítems",
    });
    expect(chip.querySelector('[data-part="label"]')).toHaveClass("truncate");
    expect(chip.querySelector('[data-part="meta"]')).toBeNull();
    expect(document.querySelector('[data-part="weekday-number"]')).toBeNull();
    expect(document.querySelector('[data-part="number-row"]')).not.toHaveClass(
      "@2xl:hidden",
    );
  });

  it("puts the month's side panel beside the grid", () => {
    render(<CalendarPeriod view={VIEW} variant="month" aside={<p>panel</p>} />);
    expect(
      screen.getByText("panel").closest('[data-part="aside"]'),
    ).not.toBeNull();
  });

  // User report 2026-10-19: Semana showed an empty right column because
  // the page passed `aside={null}` for the week.
  it("draws no side column when there is no panel, even a null one", () => {
    const { container } = render(
      <CalendarPeriod view={VIEW} variant="week" aside={null} />,
    );
    expect(container.querySelector('[data-part="aside"]')).toBeNull();
  });

  it("lets a month day select itself, the selected one outlined", () => {
    render(
      <CalendarPeriod
        view={{
          ...VIEW,
          cells: [
            cell("2026-10-20", {
              selectHref: "/calendario?view=mes&date=2026-10-20",
              isSelected: true,
            }),
          ],
        }}
        variant="month"
      />,
    );
    expect(
      screen.getByRole("link", { name: "Ver día 2026-10-20" }),
    ).toHaveAttribute("aria-current", "date");
    expect(screen.getByRole("listitem")).toHaveAttribute(
      "data-selected",
      "true",
    );
  });
});
