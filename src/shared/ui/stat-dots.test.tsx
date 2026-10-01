import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatDots } from "./stat-dots";

describe("StatDots", () => {
  it("shows the four counts in again, hard, good, easy order", () => {
    render(<StatDots counts={{ again: 4, hard: 3, good: 2, easy: 1 }} />);

    const values = within(screen.getByTestId("stat-dots"))
      .getAllByText(/^\d+$/)
      .map((node) => node.textContent);
    expect(values).toEqual(["4", "3", "2", "1"]);
  });

  it("renders zeros explicitly", () => {
    render(<StatDots counts={{ again: 0, hard: 0, good: 0, easy: 0 }} />);

    expect(
      within(screen.getByTestId("stat-dots")).getAllByText("0"),
    ).toHaveLength(4);
  });
});
