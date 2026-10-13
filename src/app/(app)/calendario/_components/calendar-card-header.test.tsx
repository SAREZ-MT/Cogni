import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarCardHeader } from "./calendar-card-header";

describe("CalendarCardHeader", () => {
  it("shows today's badge, the period title and subtitle, and the navigation", () => {
    render(
      <CalendarCardHeader
        now={new Date("2026-10-12T12:00:00.000Z")}
        timeZone="UTC"
        title="Octubre 2026"
        subtitle="1 oct 2026 – 31 oct 2026"
        nav={{
          prev: { href: "/p", label: "Mes anterior" },
          today: { href: "/t", label: "Hoy" },
          next: { href: "/n", label: "Mes siguiente" },
        }}
        navLabel="Navegar meses"
      />,
    );

    expect(
      document.querySelector('[data-slot="date-badge"] [data-part="day"]'),
    ).toHaveTextContent("12");
    expect(
      screen.getByRole("heading", { level: 2, name: "Octubre 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 oct 2026 – 31 oct 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegar meses" }),
    ).toBeInTheDocument();
  });

  it("omits the navigation when none is given (Hoy)", () => {
    render(
      <CalendarCardHeader
        now={new Date("2026-10-12T12:00:00.000Z")}
        timeZone="UTC"
        title="Hoy"
        subtitle="Lunes"
      />,
    );
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
