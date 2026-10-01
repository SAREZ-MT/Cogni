import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PeriodFilter } from "./period-filter";

const hrefFor = (range: number) => `/dashboard?range=${range}`;

describe("PeriodFilter", () => {
  it("offers 7, 15 and 30 day links to the URL of each range", () => {
    render(<PeriodFilter value={7} hrefFor={hrefFor} />);

    expect(screen.getByRole("link", { name: "7 días" })).toHaveAttribute(
      "href",
      "/dashboard?range=7",
    );
    expect(screen.getByRole("link", { name: "15 días" })).toHaveAttribute(
      "href",
      "/dashboard?range=15",
    );
    expect(screen.getByRole("link", { name: "30 días" })).toHaveAttribute(
      "href",
      "/dashboard?range=30",
    );
    expect(screen.queryByRole("link", { name: "90 días" })).toBeNull();
  });

  it.each([
    [7, "7 días"],
    [15, "15 días"],
    [30, "30 días"],
  ] as const)("marks only the %s day option as current", (value, label) => {
    render(<PeriodFilter value={value} hrefFor={hrefFor} />);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "true");
    expect(current.map((link) => link.textContent)).toEqual([label]);
  });

  it("merges className", () => {
    const { container } = render(
      <PeriodFilter value={7} hrefFor={hrefFor} className="extra" />,
    );

    expect(container.firstElementChild).toHaveClass("extra");
  });
});
