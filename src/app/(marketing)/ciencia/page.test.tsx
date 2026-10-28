import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONCEPTS } from "./_components/science-concepts";
import SciencePage, { metadata } from "./page";

vi.mock("next/navigation", () => ({ usePathname: () => "/ciencia" }));

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

describe("/ciencia", () => {
  it("has its own title and description", () => {
    expect(metadata.title).toBe("La ciencia detrás de Cogni · Cogni");
    expect(metadata.description).toBeTruthy();
  });

  it("opens with one h1 and a single serif italic keyword", () => {
    render(<SciencePage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(
      "Seis ideas para recordar lo que estudias.",
    );
    const accents = heading.querySelectorAll("em");
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent("recordar");
    expect(
      screen.getByRole("link", { name: "Volver a Cogni" }),
    ).toHaveAttribute("href", "/landing");
  });

  it("indexes the six ideas and gives each a section with Cogni's use and a source", () => {
    render(<SciencePage />);
    expect(CONCEPTS).toHaveLength(6);
    const index = screen.getByRole("navigation", { name: "Las seis ideas" });
    expect(
      within(index)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(CONCEPTS.map((concept) => `#${concept.id}`));
    for (const concept of CONCEPTS) {
      const section = screen.getByRole("region", { name: concept.name });
      expect(section).toHaveAttribute("id", concept.id);
      expect(section).toHaveTextContent("Así lo usa Cogni");
      expect(section).toHaveTextContent(concept.inCogni);
      expect(section).toHaveTextContent(concept.source);
    }
  });

  it("uses the engine's real intervals and phrases feedback as strengths and improvement opportunities", () => {
    render(<SciencePage />);
    expect(document.body).toHaveTextContent(
      "si respondes bien, vuelve mañana, en 6 días y en unas dos semanas",
    );
    expect(document.body).not.toHaveTextContent("+3");
    expect(document.body).toHaveTextContent("Oportunidades de mejora");
    expect(document.body).not.toHaveTextContent(/tiempo de estudio/i);
  });

  it("closes with the sign-up action and the shared footer", () => {
    render(<SciencePage />);
    expect(
      screen.getByRole("heading", { name: "Todo esto, en tus páginas." }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Empieza gratis" }).at(-1),
    ).toHaveAttribute("href", "/register");
    expect(
      screen.getByRole("link", { name: "Ver cómo funciona" }),
    ).toHaveAttribute("href", "/landing#como-funciona");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
