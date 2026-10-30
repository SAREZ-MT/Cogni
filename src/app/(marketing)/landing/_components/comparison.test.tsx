import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Comparison, PAINS, ROUTE } from "./comparison";

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

describe("Comparison", () => {
  it("is a light section at #comparacion named by its headline", () => {
    render(<Comparison />);
    const section = screen.getByRole("region", {
      name: "Dos formas de llegar al examen.",
    });
    expect(section).toHaveAttribute("id", "comparacion");
    expect(section).toHaveAttribute("data-nav-theme", "light");
  });

  it("sets exactly one keyword of the headline in the serif italic, next to a red exam object", () => {
    render(<Comparison />);
    const heading = screen.getByRole("heading", { level: 2 });
    const accents = heading.querySelectorAll("em");
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent("examen");
    const slot = heading.querySelector('[data-glyph="exam"]');
    expect(slot).toHaveAttribute("data-tone", "red");
  });

  it("lists the four pains of the usual way", () => {
    render(<Comparison />);
    expect(
      screen.getByRole("heading", { level: 3, name: "El camino de siempre" }),
    ).toBeInTheDocument();
    for (const pain of PAINS) {
      expect(screen.getByText(pain)).toBeInTheDocument();
    }
    expect(PAINS).toHaveLength(4);
  });

  it("walks the five-step Cogni route in order, each with its mechanism and a link to its section", () => {
    render(<Comparison />);
    const route = document.querySelector("ol") as HTMLElement;
    const steps = within(route).getAllByRole("listitem");
    expect(steps).toHaveLength(5);
    expect(
      steps.map((step) => within(step).getByRole("heading").textContent),
    ).toEqual([
      "Importas tu apunte",
      "Generas tus técnicas",
      "Repasas lo que vence hoy",
      "Cierras con un siguiente paso",
      "Llegas sabiendo qué dominas",
    ]);
    expect(
      steps.map((step) => within(step).getByRole("link").getAttribute("href")),
    ).toEqual([
      "#pilar-apuntes",
      "#tecnicas",
      "#pilar-repeticion",
      "#tecnicas",
      "#pilar-progreso",
    ]);
    expect(ROUTE.map((step) => step.mechanism)).toEqual([
      "PDF · Word · PowerPoint",
      "Solo tu página",
      "SM-2 · Vista Hoy",
      "Resumen de sesión",
      "Dominio por página",
    ]);
  });

  it("drops the false claims of the v1 frame", () => {
    render(<Comparison />);
    expect(document.body).not.toHaveTextContent("+3");
    expect(document.body).not.toHaveTextContent("revisas y editas");
  });

  it("closes with the honest line and the science link", () => {
    render(<Comparison />);
    expect(document.body).toHaveTextContent(
      "Las apps de tarjetas y los asistentes de IA hacen muy bien su parte: unas programan repasos, otros explican tus documentos. Cogni une crear, repasar y saber cuándo.",
    );
    expect(
      screen.getByRole("link", { name: "La ciencia detrás de Cogni" }),
    ).toHaveAttribute("href", "/ciencia");
  });
});
