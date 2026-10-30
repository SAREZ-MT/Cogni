import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarNav } from "./calendar-nav";

describe("CalendarNav", () => {
  it("is two bare arrows linking the previous and next periods", () => {
    render(
      <CalendarNav
        aria-label="Navegar meses"
        prev={{ href: "/c?date=2026-09-01", label: "Mes anterior" }}
        next={{ href: "/c?date=2026-11-01", label: "Mes siguiente" }}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Navegar meses" });
    expect(nav).toHaveAttribute("data-slot", "calendar-nav");
    // No container look and no middle button (user reference ref-arrows).
    expect(nav).not.toHaveClass("bg-neutral-100", "border");
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Mes anterior" })).toHaveAttribute(
      "href",
      "/c?date=2026-09-01",
    );
    const next = screen.getByRole("link", { name: "Mes siguiente" });
    expect(next).toHaveAttribute("href", "/c?date=2026-11-01");
    expect(next).toHaveClass("text-fg-muted", "hover:text-fg", "rounded-full");
  });

  it("renders a disabled arrow as an inert, dimmed non-link that keeps its name", () => {
    render(
      <CalendarNav
        aria-label="Navegar días"
        prev={{ href: "/p", label: "Día anterior", disabled: true }}
        next={{ href: "/n", label: "Día siguiente" }}
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(1);
    const prev = screen.getByText("Día anterior").closest("[aria-disabled]");
    expect(prev?.tagName).toBe("SPAN");
    expect(prev).toHaveAttribute("aria-disabled", "true");
    expect(prev).toHaveClass("opacity-35");
  });
});
