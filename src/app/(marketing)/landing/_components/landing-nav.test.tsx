import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingNav, NAV_LINKS } from "./landing-nav";

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

function nav() {
  return screen.getByRole("navigation", { name: "Principal" });
}

describe("LandingNav", () => {
  it("shows visitors the section links and the sign-in and sign-up actions", () => {
    render(<LandingNav />);
    for (const link of NAV_LINKS) {
      expect(
        within(nav()).getByRole("link", { name: link.label }),
      ).toHaveAttribute("href", link.href);
    }
    expect(
      within(nav()).getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/login");
    expect(
      within(nav()).getByRole("link", { name: "Empieza ya" }),
    ).toHaveAttribute("href", "/register");
    expect(
      within(nav()).queryByRole("link", { name: "Ir a la app" }),
    ).toBeNull();
  });

  it("gives a signed-in user a single way into the app instead", () => {
    render(<LandingNav signedIn />);
    expect(
      within(nav()).getByRole("link", { name: "Ir a la app" }),
    ).toHaveAttribute("href", "/inicio");
    for (const link of NAV_LINKS) {
      expect(
        within(nav()).queryByRole("link", { name: link.label }),
      ).toBeNull();
    }
    expect(
      within(nav()).queryByRole("link", { name: "Iniciar sesión" }),
    ).toBeNull();
    expect(
      within(nav()).queryByRole("link", { name: "Empieza ya" }),
    ).toBeNull();
  });
});
