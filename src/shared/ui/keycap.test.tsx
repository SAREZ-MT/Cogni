import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Keycap } from "./keycap";

describe("Keycap", () => {
  it("renders the key as text in a span", () => {
    render(<Keycap>⌘</Keycap>);

    const key = screen.getByText("⌘");
    expect(key.tagName).toBe("SPAN");
    expect(key).toHaveAttribute("data-slot", "keycap");
  });

  it("forwards className and props", () => {
    render(
      <Keycap className="extra" aria-hidden="true" data-testid="k">
        H
      </Keycap>,
    );

    const key = screen.getByTestId("k");
    expect(key).toHaveClass("extra");
    expect(key).toHaveAttribute("aria-hidden", "true");
  });
});
