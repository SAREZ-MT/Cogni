import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

// `--color-popover` / `--color-accent` are not registered in globals.css
// `@theme`, so the old classes emitted no CSS (transparent panel). The menu
// now uses the same card chrome as the "/" command menu.
function renderOpenMenu() {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>abrir</DropdownMenuTrigger>
      <DropdownMenuContent data-testid="content">
        <DropdownMenuItem>Normal</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe("DropdownMenu", () => {
  it("renders the panel on the card surface with the design-system border and radius", () => {
    renderOpenMenu();

    const { className } = screen.getByTestId("content");
    expect(className).toContain("bg-card");
    expect(className).toContain("border-border-default");
    expect(className).toContain("rounded-xl");
    expect(className).not.toContain("bg-popover");
  });

  it("highlights items with the hover token and keeps the destructive item in the error tone", () => {
    renderOpenMenu();

    const normal = screen.getByRole("menuitem", { name: "Normal" });
    const destructive = screen.getByRole("menuitem", { name: "Eliminar" });
    expect(normal.className).toContain("focus:bg-hover");
    expect(normal.className).not.toContain("bg-accent");
    expect(destructive.className).toContain("text-error-700");
    expect(destructive.className).toContain(
      "data-[variant=destructive]:hover:bg-error-50",
    );
    expect(destructive.className).not.toContain("text-destructive");
    expect(destructive.getAttribute("data-variant")).toBe("destructive");
  });
});
