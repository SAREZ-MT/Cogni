import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarDayCell, CalendarGrid } from "./calendar-grid";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

describe("CalendarGrid", () => {
  it("heads seven Monday-first columns and lists its day cells", () => {
    render(
      <CalendarGrid aria-label="Octubre 2026" weekdays={WEEKDAYS}>
        <CalendarDayCell
          day="2026-10-12"
          dayNumber={12}
          label="lunes, 12 de octubre"
        />
      </CalendarGrid>,
    );

    const grid = screen.getByRole("list", { name: "Octubre 2026" });
    expect(grid).toHaveAttribute("data-slot", "calendar-grid");
    expect(within(grid).getAllByRole("listitem")).toHaveLength(1);
    const header = screen.getByTestId("calendar-weekdays");
    expect(header).toHaveAttribute("aria-hidden", "true");
    expect(header).toHaveTextContent(WEEKDAYS.join(""));
  });
});

describe("CalendarGrid header numbers", () => {
  it("puts each day's number next to its weekday, today's in a violet square", () => {
    render(
      <CalendarGrid
        aria-label="Semana"
        weekdays={WEEKDAYS}
        weekdayNumbers={WEEKDAYS.map((_, index) => ({
          dayNumber: 12 + index,
          isToday: index === 1,
        }))}
      >
        <CalendarDayCell day="2026-10-12" dayNumber={12} label="lunes" />
      </CalendarGrid>,
    );

    const header = screen.getByTestId("calendar-weekdays");
    expect(header).toHaveAttribute("aria-hidden", "true");
    expect(header).toHaveTextContent("Lun12Mar13Mié14");
    const numbers = header.querySelectorAll('[data-part="weekday-number"]');
    expect(numbers).toHaveLength(7);
    expect(numbers[1]).toHaveClass("bg-primary-600", "text-white");
    expect(numbers[0]).not.toHaveClass("bg-primary-600");
  });
});

describe("CalendarDayCell selection", () => {
  it("covers a selectable day with a link that selects it, keeping its chips clickable", () => {
    render(
      <ul>
        <CalendarDayCell
          day="2026-10-20"
          dayNumber={20}
          label="martes, 20 de octubre"
          selectHref="/calendario?view=mes&date=2026-10-20"
        >
          <a href="/chip">chip</a>
        </CalendarDayCell>
      </ul>,
    );

    const select = screen.getByRole("link", {
      name: "Ver martes, 20 de octubre",
    });
    expect(select).toHaveAttribute(
      "href",
      "/calendario?view=mes&date=2026-10-20",
    );
    expect(select).toHaveAttribute("data-part", "select");
    expect(select).not.toHaveAttribute("aria-current");
    // Chips sit above the cover, so they stay their own links.
    expect(
      screen
        .getByRole("link", { name: "chip" })
        .closest("[data-part='events']"),
    ).toHaveClass("relative");
  });

  it("outlines the selected day in violet and marks it as the current date", () => {
    render(
      <ul>
        <CalendarDayCell
          day="2026-10-20"
          dayNumber={20}
          label="martes, 20 de octubre"
          selectHref="/x"
          isSelected
        />
      </ul>,
    );

    const cell = screen.getByRole("listitem");
    expect(cell).toHaveAttribute("data-selected", "true");
    expect(cell).toHaveClass("ring-2", "ring-inset", "ring-primary-600");
    expect(
      screen.getByRole("link", { name: "Ver martes, 20 de octubre" }),
    ).toHaveAttribute("aria-current", "date");
  });

  it("has no selection cover without a selectHref", () => {
    render(
      <ul>
        <CalendarDayCell day="2026-09-30" dayNumber={30} label="x" outside />
      </ul>,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("CalendarGrid fill", () => {
  it("grows to fill its flex parent when asked, so the days reach the bottom", () => {
    const { container } = render(
      <CalendarGrid aria-label="Semana" weekdays={WEEKDAYS} fill>
        <CalendarDayCell day="2026-10-12" dayNumber={12} label="lunes" />
      </CalendarGrid>,
    );

    const frame = container.querySelector('[data-slot="calendar-grid-frame"]');
    expect(frame).toHaveClass("flex", "flex-1", "flex-col");
    expect(screen.getByRole("list")).toHaveClass("flex-1");
  });
});

describe("CalendarDayCell", () => {
  it("shows the day number and names the day for assistive tech", () => {
    render(
      <ul>
        <CalendarDayCell
          day="2026-10-14"
          dayNumber={14}
          label="miércoles, 14 de octubre"
        >
          <span>chip</span>
        </CalendarDayCell>
      </ul>,
    );

    const cell = screen.getByRole("listitem");
    expect(cell).toHaveAttribute("data-slot", "calendar-day");
    expect(cell).toHaveAttribute("data-day", "2026-10-14");
    expect(cell.querySelector("[data-part='number']")).toHaveTextContent("14");
    expect(cell.querySelector("time")).toHaveAttribute(
      "dateTime",
      "2026-10-14",
    );
    expect(cell).toHaveTextContent("miércoles, 14 de octubre");
    expect(within(cell).getByText("chip")).toBeInTheDocument();
    expect(cell).not.toHaveAttribute("data-today");
    expect(cell).not.toHaveAttribute("data-outside");
  });

  it("marks today with a violet square on a faint violet cell and announces it", () => {
    render(
      <ul>
        <CalendarDayCell
          day="2026-10-12"
          dayNumber={12}
          label="lunes, 12 de octubre"
          isToday
        />
      </ul>,
    );

    const cell = screen.getByRole("listitem");
    expect(cell).toHaveAttribute("data-today", "true");
    expect(cell).toHaveClass("bg-primary-50");
    expect(cell.querySelector("[data-part='number']")).toHaveClass(
      "bg-primary-600",
      "text-white",
      "rounded-md",
    );
    expect(cell).toHaveTextContent("(hoy)");
  });

  it("in the week variant shows the number only where the days stack, with no background", () => {
    render(
      <ul>
        <CalendarDayCell
          day="2026-10-12"
          dayNumber={12}
          label="lunes, 12 de octubre"
          weekday="Lun"
          isToday
          variant="week"
        />
      </ul>,
    );

    const cell = screen.getByRole("listitem");
    expect(cell).toHaveAttribute("data-today", "true");
    expect(cell).toHaveTextContent("(hoy)");
    // A soft violet wash fading down the whole of today's column.
    expect(cell).toHaveClass("bg-linear-to-b", "from-primary-100/70");
    expect(cell).not.toHaveClass("bg-primary-50");
    expect(cell.querySelector('[data-part="number-row"]')).toHaveClass(
      "@2xl:hidden",
    );
    expect(cell.querySelector("[data-part='number']")).toHaveClass(
      "bg-primary-600",
    );
  });

  it("greys a day outside the shown month", () => {
    render(
      <ul>
        <CalendarDayCell
          day="2026-09-30"
          dayNumber={30}
          label="miércoles, 30 de septiembre"
          outside
        />
      </ul>,
    );

    const cell = screen.getByRole("listitem");
    expect(cell).toHaveAttribute("data-outside", "true");
    expect(cell).toHaveClass("bg-neutral-50");
  });

  it("links the overflow to where every event of the day is listed", () => {
    render(
      <ul>
        <CalendarDayCell
          day="2026-10-14"
          dayNumber={14}
          label="miércoles, 14 de octubre"
          more={{
            count: 2,
            href: "/calendario?view=semana&date=2026-10-14",
          }}
        />
      </ul>,
    );

    const more = screen.getByRole("link", {
      name: "2 más el miércoles, 14 de octubre",
    });
    expect(more).toHaveAttribute(
      "href",
      "/calendario?view=semana&date=2026-10-14",
    );
    expect(more).toHaveTextContent("2 más…");
  });
});
