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

  it("marks today with a dark circle and announces it", () => {
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
    expect(cell.querySelector("[data-part='number']")).toHaveClass(
      "bg-fg",
      "text-card",
      "rounded-full",
    );
    expect(cell).toHaveTextContent("(hoy)");
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
