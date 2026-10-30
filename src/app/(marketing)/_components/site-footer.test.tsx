import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEGAL, SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("links the landing sections with their paths so it works on every page", () => {
    render(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: "Pie de página" });
    for (const [name, href] of [
      ["Cómo funciona", "/landing#como-funciona"],
      ["Técnicas", "/landing#tecnicas"],
      ["Comparación", "/landing#comparacion"],
      ["Preguntas", "/landing#preguntas"],
    ]) {
      expect(within(nav).getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  it("links the science page and a small legal group", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("link", { name: "La ciencia detrás de Cogni →" }),
    ).toHaveAttribute("href", "/ciencia");
    for (const [name, href] of [
      ["Términos de uso", "/legal/terminos"],
      ["Privacidad", "/legal/privacidad"],
      ["Créditos", "/creditos"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(LEGAL).toHaveLength(3);
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
});
