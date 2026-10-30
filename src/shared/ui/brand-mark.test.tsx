import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  it("renders the decorative glyph tile and the Cogni wordmark", () => {
    render(<BrandMark data-testid="brand" />);

    const brand = screen.getByTestId("brand");
    expect(brand).toHaveAttribute("data-slot", "brand-mark");
    expect(brand).toHaveTextContent("Cogni");
    expect(brand.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses a dark tile on light surfaces and a glass tile on dark ones", () => {
    const { rerender } = render(<BrandMark data-testid="brand" />);
    expect(screen.getByTestId("brand")).toHaveAttribute("data-tone", "light");

    rerender(<BrandMark data-testid="brand" tone="dark" />);
    expect(screen.getByTestId("brand")).toHaveAttribute("data-tone", "dark");
  });

  it("drops the wordmark when asked, keeping the decorative tile", () => {
    render(<BrandMark data-testid="brand" wordmark={false} />);

    const brand = screen.getByTestId("brand");
    expect(brand.textContent).toBe("");
    expect(brand.querySelector('[data-slot="brand-glyph"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("uses the 14px wordmark for the sidebar size", () => {
    render(<BrandMark size="sm" />);

    expect(screen.getByText("Cogni")).toHaveClass("text-[14px]");
  });
});
