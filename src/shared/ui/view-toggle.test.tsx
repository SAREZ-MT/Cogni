import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ViewToggle } from "./view-toggle";

const hrefFor = (view: string) => `/notebooks?view=${view}`;

describe("ViewToggle", () => {
  it("renders one named link per view, pointing at the href the caller builds", () => {
    render(<ViewToggle value="grid" hrefFor={hrefFor} />);

    expect(
      screen.getByRole("link", { name: "Ver como cuadrícula" }),
    ).toHaveAttribute("href", "/notebooks?view=grid");
    expect(
      screen.getByRole("link", { name: "Ver como lista" }),
    ).toHaveAttribute("href", "/notebooks?view=list");
  });

  it("marks only the active view as current (grid)", () => {
    render(<ViewToggle value="grid" hrefFor={hrefFor} />);

    expect(
      screen.getByRole("link", { name: "Ver como cuadrícula" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("link", { name: "Ver como lista" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks only the active view as current (list)", () => {
    render(<ViewToggle value="list" hrefFor={hrefFor} />);

    expect(
      screen.getByRole("link", { name: "Ver como lista" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("link", { name: "Ver como cuadrícula" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("merges a custom className onto the container", () => {
    const { container } = render(
      <ViewToggle value="grid" hrefFor={hrefFor} className="extra" />,
    );

    expect(container.firstElementChild).toHaveClass("extra");
  });
});
