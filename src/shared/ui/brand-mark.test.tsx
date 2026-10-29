import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./brand-mark";

function glyph(brand: HTMLElement) {
  return brand.querySelector('[data-slot="brand-glyph"]');
}

function wordmarkImage(brand: HTMLElement) {
  return brand.querySelector('[data-slot="brand-wordmark"]');
}

describe("BrandMark", () => {
  it("renders the decorative mark and the Cogni wordmark", () => {
    render(<BrandMark data-testid="brand" />);

    const brand = screen.getByTestId("brand");
    expect(brand).toHaveAttribute("data-slot", "brand-mark");
    expect(glyph(brand)).toHaveAttribute("alt", "");
    expect(glyph(brand)).toHaveAttribute("aria-hidden", "true");
    expect(brand).toHaveTextContent("Cogni");
    expect(screen.getByText("Cogni")).toHaveClass("sr-only");
    expect(wordmarkImage(brand)).toHaveAttribute("alt", "");
  });

  it("uses the paper glass on light surfaces and the ink glass on dark ones", () => {
    const { rerender } = render(<BrandMark data-testid="brand" />);
    let brand = screen.getByTestId("brand");
    expect(brand).toHaveAttribute("data-tone", "light");
    expect(glyph(brand)).toHaveAttribute("src", "/brand/cogni-mark.svg");
    expect(wordmarkImage(brand)).toHaveAttribute(
      "src",
      "/brand/cogni-wordmark.svg",
    );

    rerender(<BrandMark data-testid="brand" tone="dark" />);
    brand = screen.getByTestId("brand");
    expect(brand).toHaveAttribute("data-tone", "dark");
    expect(glyph(brand)).toHaveAttribute("src", "/brand/cogni-mark-ink.svg");
    expect(wordmarkImage(brand)).toHaveAttribute(
      "src",
      "/brand/cogni-wordmark-ink.svg",
    );
  });

  it("drops the wordmark when asked, keeping the decorative mark", () => {
    render(<BrandMark data-testid="brand" wordmark={false} />);

    const brand = screen.getByTestId("brand");
    expect(brand.textContent).toBe("");
    expect(wordmarkImage(brand)).toBeNull();
    expect(glyph(brand)).toHaveAttribute("aria-hidden", "true");
  });

  it("switches to the blur-free favicon build at the 20px sidebar size", () => {
    render(<BrandMark data-testid="brand" size="sm" tone="dark" />);

    const brand = screen.getByTestId("brand");
    const mark = glyph(brand);
    expect(mark).toHaveAttribute("src", "/brand/cogni-favicon.svg");
    expect(mark).toHaveAttribute("width", "20");
    expect(wordmarkImage(brand)).toHaveAttribute("height", "20");
  });
});
