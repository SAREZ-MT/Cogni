import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// `--color-popover` is never registered in globals.css `@theme`, so the
// `bg-popover` utility emits no CSS and the panel renders transparent. The
// content must use the registered design-system card surface instead.
describe("PopoverContent", () => {
  it("renders on the card surface with the design-system border and radius", () => {
    render(
      <Popover open>
        <PopoverTrigger>abrir</PopoverTrigger>
        <PopoverContent data-testid="content">contenido</PopoverContent>
      </Popover>,
    );

    const { className } = screen.getByTestId("content");
    expect(className).toContain("bg-card");
    expect(className).toContain("border-border-default");
    expect(className).toContain("rounded-xl");
    expect(className).not.toContain("bg-popover");
    expect(className).not.toContain("text-popover-foreground");
  });

  it("lets a caller extend the classes", () => {
    render(
      <Popover open>
        <PopoverTrigger>abrir</PopoverTrigger>
        <PopoverContent data-testid="content" className="w-96">
          contenido
        </PopoverContent>
      </Popover>,
    );

    expect(screen.getByTestId("content").className).toContain("w-96");
  });
});
