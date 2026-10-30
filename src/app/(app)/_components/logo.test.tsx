import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";

describe("Logo", () => {
  it("links home and shows the wordmark next to the mark by default", () => {
    render(<Logo />);

    const link = screen.getByRole("link", { name: "Cogni" });
    expect(link).toHaveAttribute("href", "/inicio");
    expect(link).not.toHaveAttribute("aria-label");
    expect(link.querySelector('[data-slot="brand-wordmark"]')).toHaveAttribute(
      "src",
      "/brand/cogni-wordmark.svg",
    );
  });

  it("renders the shared BrandMark with the decorative 20px favicon-build mark", () => {
    const { container } = render(<Logo />);

    const mark = container.querySelector('[data-slot="brand-glyph"]');
    expect(mark).toHaveAttribute("src", "/brand/cogni-favicon.svg");
    expect(mark).toHaveAttribute("alt", "");
    expect(mark).toHaveAttribute("aria-hidden", "true");
  });

  it("hides the wordmark when collapsed and moves the accessible name to the link", () => {
    render(<Logo collapsed />);

    const link = screen.getByRole("link", { name: "Cogni" });
    expect(link).toHaveAttribute("aria-label", "Cogni");
    expect(link.textContent).toBe("");
  });
});
