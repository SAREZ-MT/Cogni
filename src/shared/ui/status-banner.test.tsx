import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBanner } from "./status-banner";

describe("StatusBanner", () => {
  it("shows the title and the description", () => {
    render(
      <StatusBanner
        tone="pending"
        title="Evaluando…"
        description="Un momento"
      />,
    );

    expect(screen.getByText("Evaluando…")).toBeInTheDocument();
    expect(screen.getByText("Un momento")).toBeInTheDocument();
  });

  it.each([
    ["pending", "bg-warning-50"],
    ["success", "bg-success-50"],
    ["error", "bg-error-50"],
  ] as const)("paints the %s tone with %s", (tone, className) => {
    render(
      <StatusBanner
        data-testid="banner"
        tone={tone}
        title="t"
        description="d"
      />,
    );

    const banner = screen.getByTestId("banner");
    expect(banner).toHaveAttribute("data-tone", tone);
    expect(banner).toHaveClass(className);
  });

  it("spins its icon only while pending, and respects reduced motion", () => {
    const { container, rerender } = render(
      <StatusBanner tone="pending" title="t" description="d" />,
    );
    const spinner = container.querySelector("svg.animate-spin");
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveClass("motion-reduce:animate-none");

    rerender(<StatusBanner tone="success" title="t" description="d" />);
    expect(container.querySelector("svg.animate-spin")).toBeNull();
  });

  it("forwards div props and merges className", () => {
    render(
      <StatusBanner
        data-testid="banner"
        className="mt-5"
        tone="error"
        title="t"
        description="d"
      />,
    );

    expect(screen.getByTestId("banner")).toHaveClass("mt-5");
  });
});
