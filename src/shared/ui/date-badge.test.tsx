import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateBadge } from "./date-badge";

describe("DateBadge", () => {
  it("shows the abbreviated Spanish month in capitals over the day number", () => {
    render(
      <DateBadge
        data-testid="badge"
        date={new Date("2026-10-12T15:00:00.000Z")}
        timeZone="UTC"
        className="extra"
      />,
    );

    const badge = screen.getByTestId("badge");
    expect(badge).toHaveAttribute("data-slot", "date-badge");
    expect(badge).toHaveClass("extra");
    expect(badge.querySelector('[data-part="month"]')).toHaveTextContent("OCT");
    expect(badge.querySelector('[data-part="day"]')).toHaveTextContent("12");
  });

  it("reads the day in the given time zone", () => {
    // 02:00 UTC on the 13th is still the 12th in Bogotá (UTC-5).
    render(
      <DateBadge
        data-testid="badge"
        date={new Date("2026-10-13T02:00:00.000Z")}
        timeZone="America/Bogota"
      />,
    );

    expect(
      screen.getByTestId("badge").querySelector('[data-part="day"]'),
    ).toHaveTextContent("12");
  });

  it("exposes the full date as a time element for assistive technology", () => {
    render(
      <DateBadge date={new Date("2026-10-12T15:00:00.000Z")} timeZone="UTC" />,
    );

    const time = screen.getByText((_, element) => element?.tagName === "TIME");
    expect(time).toHaveAttribute("datetime", "2026-10-12");
  });
});
