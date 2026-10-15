import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextDivider } from "./text-divider";

describe("TextDivider", () => {
  it("renders its label between two decorative rules", () => {
    render(<TextDivider data-testid="divider">o</TextDivider>);

    const divider = screen.getByTestId("divider");
    expect(divider).toHaveAttribute("data-slot", "text-divider");
    expect(divider).toHaveTextContent("o");
    expect(divider.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it("forwards className", () => {
    render(
      <TextDivider data-testid="divider" className="extra">
        o
      </TextDivider>,
    );

    expect(screen.getByTestId("divider")).toHaveClass("extra");
  });
});
