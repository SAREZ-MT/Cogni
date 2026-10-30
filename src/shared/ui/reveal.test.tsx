import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevealGroup, RevealItem, revealVariants } from "./reveal";

describe("revealVariants", () => {
  it("rises items in with a short stagger, each under 400 ms", () => {
    const { group, item } = revealVariants(false);

    expect(item.hidden).toEqual({ opacity: 0, y: 8 });
    expect(item.shown.transition.visualDuration).toBeLessThanOrEqual(0.4);
    expect(group.shown.transition.delayChildren).not.toBe(0);
  });

  it("drops every animation under prefers-reduced-motion", () => {
    const { group, item } = revealVariants(true);

    expect(item.shown.transition).toEqual({ duration: 0 });
    expect(group.shown.transition).toEqual({ delayChildren: 0 });
  });
});

describe("RevealGroup / RevealItem", () => {
  it("renders its children", () => {
    render(
      <RevealGroup className="group">
        <RevealItem>
          <p>Hola</p>
        </RevealItem>
      </RevealGroup>,
    );

    expect(screen.getByText("Hola")).toBeInTheDocument();
  });
});
