import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconTile } from "./icon-tile";

describe("IconTile", () => {
  it("renders a span with its children and forwarded props", () => {
    render(
      <IconTile data-testid="tile" aria-hidden="true" className="extra">
        <svg data-testid="icon" />
      </IconTile>,
    );

    const tile = screen.getByTestId("tile");
    expect(tile.tagName).toBe("SPAN");
    expect(tile).toHaveAttribute("data-slot", "icon-tile");
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveClass("extra");
    expect(tile).toContainElement(screen.getByTestId("icon"));
  });

  it("renders an emoji child as accessible text when not hidden", () => {
    render(<IconTile>📓</IconTile>);

    expect(screen.getByText("📓")).toBeInTheDocument();
  });

  it.each([
    ["28", "size-7"],
    ["30", "size-[30px]"],
    ["36", "size-9"],
    ["40", "size-10"],
    ["44", "size-11"],
    ["52", "size-[52px]"],
    ["56", "size-14"],
  ] as const)("maps size %s to %s", (size, expected) => {
    render(<IconTile data-testid="t" size={size} />);

    expect(screen.getByTestId("t")).toHaveClass(expected);
  });

  it.each([
    ["md", "rounded-md"],
    ["input", "rounded-input"],
    ["tile", "rounded-tile"],
    ["xl", "rounded-xl"],
  ] as const)("maps radius %s to %s", (radius, expected) => {
    render(<IconTile data-testid="t" radius={radius} />);

    expect(screen.getByTestId("t")).toHaveClass(expected);
  });

  it("defaults the radius to tile", () => {
    render(<IconTile data-testid="t" />);

    expect(screen.getByTestId("t")).toHaveClass("rounded-tile");
  });

  it.each([
    "purple",
    "pink",
    "green",
    "yellow",
    "orange",
    "blue",
    "mint",
  ] as const)("maps the notebook tone %s to its pastel pair", (tone) => {
    render(<IconTile data-testid="t" tone={tone} />);

    const tile = screen.getByTestId("t");
    expect(tile).toHaveClass(`bg-pastel-${tone}`, `text-pastel-${tone}-fg`);
  });

  it("keeps the primary tone distinct from the purple swatch", () => {
    const { rerender } = render(<IconTile data-testid="t" tone="primary" />);
    expect(screen.getByTestId("t")).toHaveClass("bg-primary-100");
    expect(screen.getByTestId("t")).not.toHaveClass("bg-pastel-purple");

    rerender(<IconTile data-testid="t" tone="purple" />);
    expect(screen.getByTestId("t")).toHaveClass("bg-pastel-purple");
  });

  it.each([
    ["neutral", "bg-neutral-150"],
    ["success", "bg-success-100"],
    ["warning", "bg-warning-100"],
    ["error", "bg-error-100"],
    ["info", "bg-info-100"],
    ["rose", "bg-rose-500/10"],
  ] as const)("maps the semantic tone %s", (tone, expected) => {
    render(<IconTile data-testid="t" tone={tone} />);

    expect(screen.getByTestId("t")).toHaveClass(expected);
  });

  it("lets className override the size via tailwind-merge", () => {
    render(<IconTile data-testid="t" size="36" className="size-12" />);

    const tile = screen.getByTestId("t");
    expect(tile).toHaveClass("size-12");
    expect(tile).not.toHaveClass("size-9");
  });
});
