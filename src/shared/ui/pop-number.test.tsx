import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PopNumber } from "./pop-number";

describe("PopNumber", () => {
  it("renders its final value from the first render", () => {
    render(<PopNumber value={12} className="text-success-600" />);

    expect(screen.getByText("12")).toHaveClass("text-success-600");
  });
});
