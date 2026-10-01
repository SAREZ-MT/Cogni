import { fireEvent, render, screen } from "@testing-library/react";
import { PanelLeft } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { PanelToggleButton } from "./panel-toggle-button";

describe("PanelToggleButton", () => {
  it("renders a non-submitting button with the caller's accessible name", () => {
    render(<PanelToggleButton icon={PanelLeft} aria-label="Contraer" />);

    const button = screen.getByRole("button", { name: "Contraer" });
    expect(button).toHaveAttribute("type", "button");
  });

  it("calls onClick and forwards aria-expanded", () => {
    const onClick = vi.fn();
    render(
      <PanelToggleButton
        icon={PanelLeft}
        aria-label="Contraer"
        aria-expanded={true}
        onClick={onClick}
      />,
    );

    const button = screen.getByRole("button", { name: "Contraer" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies the given icon size", () => {
    render(<PanelToggleButton icon={PanelLeft} size={12} aria-label="x" />);

    const svg = screen.getByRole("button").querySelector("svg");
    expect(svg).toHaveAttribute("width", "12");
  });
});
