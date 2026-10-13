import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarNav } from "./calendar-nav";

describe("CalendarNav", () => {
  it("links previous, today and next periods with accessible names", () => {
    render(
      <CalendarNav
        aria-label="Navegar meses"
        prev={{ href: "/c?date=2026-09-01", label: "Mes anterior" }}
        today={{ href: "/c", label: "Hoy" }}
        next={{ href: "/c?date=2026-11-01", label: "Mes siguiente" }}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Navegar meses" });
    expect(nav).toHaveAttribute("data-slot", "calendar-nav");
    const links = screen.getAllByRole("link");
    expect(
      links.map((link) => link.getAttribute("aria-label") ?? link.textContent),
    ).toEqual(["Mes anterior", "Hoy", "Mes siguiente"]);
    expect(screen.getByRole("link", { name: "Mes anterior" })).toHaveAttribute(
      "href",
      "/c?date=2026-09-01",
    );
    expect(screen.getByRole("link", { name: "Hoy" })).toHaveAttribute(
      "href",
      "/c",
    );
    expect(screen.getByRole("link", { name: "Mes siguiente" })).toHaveAttribute(
      "href",
      "/c?date=2026-11-01",
    );
  });
});
