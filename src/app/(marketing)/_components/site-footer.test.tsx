import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEGAL, SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("links the landing sections with their paths so it works on every page", () => {
    render(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: "Pie de página" });
    for (const [name, href] of [
      ["Cómo funciona", "/#como-funciona"],
      ["Técnicas", "/#tecnicas"],
      ["Comparación", "/#comparacion"],
      ["Preguntas", "/#preguntas"],
    ]) {
      expect(within(nav).getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  it("links the science page and the public legal pages", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("link", { name: "La ciencia detrás de Cogni →" }),
    ).toHaveAttribute("href", "/ciencia");
    for (const [name, href] of [
      ["Términos y condiciones", "/legal/terminos"],
      ["Política de privacidad", "/legal/privacidad"],
      ["Uso aceptable", "/legal/uso-aceptable"],
      ["Derechos de autor", "/legal/derechos-de-autor"],
      ["Créditos", "/creditos"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(LEGAL).toHaveLength(5);
  });

  it("carries the academic notice on the dark ground", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toHaveAttribute(
      "data-nav-theme",
      "dark",
    );
    expect(document.body).toHaveTextContent(
      "Cogni es un proyecto académico (trabajo de grado) en desarrollo.",
    );
  });

  it("keeps the landing logo for visitors", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "cogni" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByRole("link", { name: "Ir a la app" })).toBeNull();
  });

  it("sends a signed-in user to the app instead of the landing sections", () => {
    render(<SiteFooter signedIn />);
    const nav = screen.getByRole("navigation", { name: "Pie de página" });
    expect(
      within(nav).getByRole("link", { name: "Ir a la app" }),
    ).toHaveAttribute("href", "/inicio");
    for (const name of [
      "Cómo funciona",
      "Técnicas",
      "Comparación",
      "Preguntas",
    ]) {
      expect(within(nav).queryByRole("link", { name })).toBeNull();
    }
    expect(screen.getByRole("link", { name: "cogni" })).toHaveAttribute(
      "href",
      "/inicio",
    );
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(/^\/(#.*)?$/);
    }
    expect(
      screen.getByRole("link", { name: "La ciencia detrás de Cogni →" }),
    ).toHaveAttribute("href", "/ciencia");
    expect(screen.getByRole("link", { name: "Créditos" })).toHaveAttribute(
      "href",
      "/creditos",
    );
  });
});
