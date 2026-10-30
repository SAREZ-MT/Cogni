import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Closing } from "./closing";

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe("Closing", () => {
  it("names the section with its headline and one italic keyword", () => {
    render(<Closing />);
    const section = screen.getByRole("region", {
      name: "Tu primer repaso empieza hoy.",
    });
    const accents = section.querySelectorAll("h2 em");
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent("hoy");
    expect(section).toHaveTextContent("Empieza hoy");
  });

  it("sends the one action to the existing sign-up route", () => {
    render(<Closing />);
    expect(screen.getByRole("link", { name: "Empieza ya" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(document.body).toHaveTextContent(
      "Sube tu primer apunte: tu primera sesión está lista hoy mismo.",
    );
  });

  it("drops the price and age note under the button", () => {
    render(<Closing />);
    expect(document.body).not.toHaveTextContent("18 años");
  });

  it("hands the nav from the light lilac to the dark night", () => {
    render(<Closing />);
    const themes = Array.from(
      document.querySelectorAll("[data-nav-theme]"),
      (el) => el.getAttribute("data-nav-theme"),
    );
    expect(themes).toEqual(["light", "dark"]);
  });
});
