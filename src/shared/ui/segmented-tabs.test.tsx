import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SegmentedTabs } from "./segmented-tabs";

const ITEMS = [
  { value: "hoy", label: "Hoy", href: "/calendario" },
  { value: "semana", label: "Semana", disabled: true, hint: "Próximamente" },
  { value: "mes", label: "Mes", href: "/calendario?vista=mes" },
] as const;

describe("SegmentedTabs", () => {
  it("renders a labelled navigation with one entry per item", () => {
    render(
      <SegmentedTabs
        aria-label="Vistas del calendario"
        items={ITEMS}
        value="hoy"
        className="extra"
      />,
    );

    const nav = screen.getByRole("navigation", {
      name: "Vistas del calendario",
    });
    expect(nav).toHaveAttribute("data-slot", "segmented-tabs");
    expect(nav).toHaveClass("extra");
    expect(nav).toHaveTextContent("HoySemanaMes");
  });

  it("marks the active item as the current page and links the others", () => {
    render(<SegmentedTabs aria-label="Vistas" items={ITEMS} value="hoy" />);

    const active = screen.getByRole("link", { name: "Hoy" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveClass("bg-card", "text-fg");
    const other = screen.getByRole("link", { name: "Mes" });
    expect(other).toHaveAttribute("href", "/calendario?vista=mes");
    expect(other).not.toHaveAttribute("aria-current");
  });

  it("renders a disabled item as a non-link with its hint", () => {
    render(<SegmentedTabs aria-label="Vistas" items={ITEMS} value="hoy" />);

    expect(screen.queryByRole("link", { name: /Semana/ })).toBeNull();
    const disabled = screen.getByText("Semana").closest("[aria-disabled]");
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(disabled).toHaveAttribute("title", "Próximamente");
  });
});
