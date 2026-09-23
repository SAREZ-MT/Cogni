import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";

describe("Logo", () => {
  it("links home and shows the wordmark next to the mark by default", () => {
    render(<Logo />);

    const link = screen.getByRole("link", { name: "Cogni" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).not.toHaveAttribute("aria-label");
    expect(screen.getByText("Cogni")).toHaveClass("font-bold", "text-fg");
  });

  it("renders the mark as a 36px rounded-square with the aria-hidden three-circle glyph", () => {
    const { container } = render(<Logo />);

    const mark = container.querySelector("span.size-9");
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveClass("bg-neutral-900");

    const svg = mark?.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.querySelectorAll("circle")).toHaveLength(3);
  });

  it("hides the wordmark when collapsed and moves the accessible name to the link", () => {
    render(<Logo collapsed />);

    const link = screen.getByRole("link", { name: "Cogni" });
    expect(link).toHaveAttribute("aria-label", "Cogni");
    expect(link.textContent).toBe("");
  });
});
