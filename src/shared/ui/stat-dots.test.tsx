import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatDots } from "./stat-dots";

const FOUR = [
  { key: "again", count: 4, dotClassName: "bg-error-500" },
  { key: "hard", count: 3, dotClassName: "bg-warning-500" },
  { key: "good", count: 2, dotClassName: "bg-success-500" },
  { key: "easy", count: 1, dotClassName: "bg-primary-600" },
];

describe("StatDots", () => {
  it("shows the counts in the order the caller gives them", () => {
    render(<StatDots items={FOUR} />);

    const values = within(screen.getByTestId("stat-dots"))
      .getAllByText(/^\d+$/)
      .map((node) => node.textContent);
    expect(values).toEqual(["4", "3", "2", "1"]);
  });

  it("renders zeros explicitly", () => {
    render(<StatDots items={FOUR.map((item) => ({ ...item, count: 0 }))} />);

    expect(
      within(screen.getByTestId("stat-dots")).getAllByText("0"),
    ).toHaveLength(4);
  });

  it("is not tied to four tones: three items render three dots", () => {
    render(
      <StatDots
        items={[
          { key: "a", count: 1, dotClassName: "bg-error-500" },
          { key: "b", count: 2, dotClassName: "bg-warning-500" },
          { key: "c", count: 3, dotClassName: "bg-success-500" },
        ]}
      />,
    );

    expect(
      within(screen.getByTestId("stat-dots")).getAllByText(/^\d+$/),
    ).toHaveLength(3);
  });

  it("paints each dot with the class the caller chose", () => {
    render(<StatDots items={FOUR} />);

    const dots = screen
      .getByTestId("stat-dots")
      .querySelectorAll('span[aria-hidden="true"]');
    expect([...dots].map((dot) => dot.className)).toEqual([
      expect.stringContaining("bg-error-500"),
      expect.stringContaining("bg-warning-500"),
      expect.stringContaining("bg-success-500"),
      expect.stringContaining("bg-primary-600"),
    ]);
  });
});
