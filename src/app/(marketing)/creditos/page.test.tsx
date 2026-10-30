import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CREDIT_GROUPS } from "./_components/credits-list";
import CreditsPage, { metadata } from "./page";

// The page reads the session to pick the nav; anonymous unless a test signs
// a user in.
const session = vi.hoisted(() => ({
  user: null as { id: string; email: string | null } | null,
}));
vi.mock("@/modules/identity", () => ({
  getCurrentUser: vi.fn(async () => session.user),
}));

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

describe("/creditos", () => {
  it("has its own title and description", async () => {
    expect(metadata.title).toBe("Créditos · Cogni");
    expect(metadata.description).toBeTruthy();
  });

  it("opens with one h1 and a single serif italic keyword", async () => {
    render(await CreditsPage());
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Hecho con ayuda.");
    expect(heading.querySelectorAll("em")).toHaveLength(1);
  });

  it("credits the illustrations, every landing font and both icon sets", async () => {
    render(await CreditsPage());
    expect(CREDIT_GROUPS.map((group) => group.title)).toEqual([
      "Ilustraciones",
      "Tipografías",
      "Íconos",
    ]);
    const fonts = screen.getByRole("region", { name: "Tipografías" });
    for (const font of [
      "Inter",
      "Instrument Serif",
      "Manrope",
      "JetBrains Mono",
      "Caveat",
    ]) {
      expect(fonts).toHaveTextContent(font);
    }
    expect(fonts).toHaveTextContent("SIL Open Font License 1.1");
    const icons = screen.getByRole("region", { name: "Íconos" });
    expect(icons).toHaveTextContent("Lucide");
    expect(icons).toHaveTextContent("Licencia ISC");
    expect(icons).toHaveTextContent("Phosphor Icons");
    expect(icons).toHaveTextContent("Licencia MIT");
  });

  it("marks the open Magnific details as visibly pending", async () => {
    render(await CreditsPage());
    const illustrations = screen.getByRole("region", { name: "Ilustraciones" });
    expect(illustrations).toHaveTextContent("Designed by Magnific");
    const pending = Array.from(
      illustrations.querySelectorAll("mark"),
      (mark) => mark.textContent,
    );
    expect(pending).toEqual([
      "PENDIENTE: confirmar qué ilustraciones son de Magnific",
      "PENDIENTE: enlace a Magnific",
    ]);
    expect(within(illustrations).queryByRole("link")).toBeNull();
  });

  it("shows visitors the landing section links in the nav", async () => {
    session.user = null;
    render(await CreditsPage());
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(
      within(nav).getByRole("link", { name: "Cómo funciona" }),
    ).toHaveAttribute("href", "/#como-funciona");
    expect(within(nav).queryByRole("link", { name: "Ir a la app" })).toBeNull();
  });

  it("gives a signed-in user an Ir a la app button instead of the section links", async () => {
    session.user = { id: "u1", email: "a@b.test" };
    render(await CreditsPage());
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(
      within(nav).getByRole("link", { name: "Ir a la app" }),
    ).toHaveAttribute("href", "/inicio");
    expect(
      within(nav).queryByRole("link", { name: "Cómo funciona" }),
    ).toBeNull();
    session.user = null;
  });

  it("points every landing and sign-up link to the app for a signed-in user", async () => {
    session.user = { id: "u1", email: "a@b.test" };
    render(await CreditsPage());
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(
        /^\/(#.*)?$|^\/(login|register|forgot-password)/,
      );
    }
    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", {
        name: "Ir a la app",
      }),
    ).toHaveAttribute("href", "/inicio");
    session.user = null;
  });
});
