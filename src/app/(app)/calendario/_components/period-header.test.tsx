import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PeriodHeader } from "./period-header";

const NAV = {
  prev: { href: "/p", label: "Semana anterior" },
  next: { href: "/n", label: "Semana siguiente" },
};

describe("PeriodHeader", () => {
  it("shows the overline over the period title, with the bare arrows beside it", () => {
    const { container } = render(
      <PeriodHeader
        overline="Semana 4"
        title="19 – 25 de octubre"
        nav={NAV}
        navLabel="Navegar semanas"
      />,
    );

    expect(screen.getByText("Semana 4")).toHaveAttribute(
      "data-part",
      "overline",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "19 – 25 de octubre" }),
    ).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Navegar semanas" });
    expect(nav.querySelectorAll("a")).toHaveLength(2);
    // The date badge lives beside the page title, not here.
    expect(container.querySelector('[data-slot="date-badge"]')).toBeNull();
  });

  it("shows a subtitle under the title when given (Hoy)", () => {
    render(
      <PeriodHeader
        title="Martes 20 de octubre"
        subtitle="2 repasos programados"
        nav={NAV}
        navLabel="Navegar días"
      />,
    );
    expect(screen.getByText("2 repasos programados")).toBeInTheDocument();
    expect(screen.queryByText(/Semana \d/)).toBeNull();
  });
});
