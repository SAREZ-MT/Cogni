import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DaySelectLink } from "./day-select-link";

describe("DaySelectLink", () => {
  it("is a link that Space also activates, like a button", () => {
    render(
      <DaySelectLink
        href="/calendario?view=mes&date=2026-10-20"
        aria-label="Ver martes"
      />,
    );
    const link = screen.getByRole("link", { name: "Ver martes" });
    const click = vi.spyOn(link, "click");
    fireEvent.keyDown(link, { key: " " });
    expect(click).toHaveBeenCalledTimes(1);
  });
});
