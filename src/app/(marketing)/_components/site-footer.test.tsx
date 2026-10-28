import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCS } from "./legal-docs";
import { SiteFooter } from "./site-footer";

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

  it("links the science page, the credits and every legal page", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("link", { name: "La ciencia detrás de Cogni →" }),
    ).toHaveAttribute("href", "/ciencia");
    expect(screen.getByRole("link", { name: "Créditos" })).toHaveAttribute(
      "href",
      "/creditos",
    );
    expect(LEGAL_DOCS.map((doc) => doc.slug)).toEqual([
      "terminos",
      "datos-personales",
      "aviso-de-privacidad",
      "cookies",
      "uso-aceptable",
      "integridad-academica",
      "derechos-de-autor",
      "subencargados",
    ]);
    for (const doc of LEGAL_DOCS) {
      expect(screen.getByRole("link", { name: doc.label })).toHaveAttribute(
        "href",
        `/legal/${doc.slug}`,
      );
    }
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
