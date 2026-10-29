import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PILLARS, Pillars } from "./pillars";

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

describe("Pillars", () => {
  it("renders four pillars numbered 01–04", () => {
    render(<Pillars />);
    const titles = screen.getAllByRole("heading", { level: 2 });
    expect(titles).toHaveLength(4);
    const eyebrows = titles.map(
      (title) => title.previousElementSibling?.textContent,
    );
    expect(eyebrows).toEqual([
      "Pilar 01 · Tus apuntes",
      "Pilar 02 · Repetición espaciada",
      "Pilar 03 · Cronograma y vista Hoy",
      "Pilar 04 · Tu progreso",
    ]);
    const numbers = titles.map(
      (title) => title.parentElement?.nextElementSibling?.textContent,
    );
    expect(numbers).toEqual(["01", "02", "03", "04"]);
  });

  it("no longer holds the study companion, which moved to Técnicas", () => {
    render(<Pillars />);
    expect(document.body).not.toHaveTextContent("acompañante");
    expect(document.getElementById("pilar-acompanante")).toBeNull();
  });

  it("states the engine's real review intervals, never the old +3/+7/+16", () => {
    render(<Pillars />);
    expect(document.body).toHaveTextContent(
      "Si respondes bien, vuelve mañana, en 6 días y en unas dos semanas. Si te cuesta, vuelve pronto.",
    );
    expect(document.body).not.toHaveTextContent("+3");
    expect(document.body).not.toHaveTextContent("+16");
    expect(document.body).not.toHaveTextContent("Más de la mitad");
  });

  it("counts the streak in days with a review and measures mastery per page", () => {
    const progress = PILLARS.find((pillar) => pillar.id === "pilar-progreso");
    expect(progress?.heading).toBe("Tu progreso, medido en lo que recuerdas.");
    expect(progress?.points.map((point) => [point.title, point.text])).toEqual([
      [
        "Repasos completados",
        "Mira cuántos repasos completaste esta semana y compáralo con la anterior.",
      ],
      [
        "Tu racha",
        "Son los días seguidos en que repasas al menos una vez. Verla crecer te ayuda a mantener el hábito.",
      ],
      [
        "Dominio por página",
        "Mira cuánto has avanzado en cada página con tus repasos y cuáles ya están listas.",
      ],
    ]);
    render(<Pillars />);
    expect(document.body).toHaveTextContent("Acierto por técnica");
    expect(document.body).not.toHaveTextContent("Dominio por técnica");
  });

  it("draws every point icon as a vector glyph on a dithered tile in its pillar's hue", () => {
    render(<Pillars />);
    const tones = Object.fromEntries(
      PILLARS.map((pillar) => {
        const section = document.getElementById(pillar.id) as HTMLElement;
        const tiles = [...section.querySelectorAll<HTMLElement>(".lp-ptile")];
        expect(tiles).toHaveLength(3);
        for (const tile of tiles) {
          expect(tile).toHaveAttribute("aria-hidden", "true");
          const dither = tile.querySelector(".lp-ptile-dither");
          expect(dither).toHaveAttribute("shape-rendering", "crispEdges");
          const glyph = tile.querySelector(".lp-ptile-glyph");
          expect(glyph).not.toBeNull();
          expect(glyph).not.toHaveAttribute("shape-rendering");
          expect(tile.querySelector("use")).toHaveAttribute(
            "href",
            "#lp-ptile-dither",
          );
        }
        return [
          pillar.id,
          [...new Set(tiles.map((tile) => tile.dataset.tone))],
        ];
      }),
    );
    expect(tones).toEqual({
      "pilar-apuntes": ["yellow"],
      "pilar-repeticion": ["violet"],
      "pilar-hoy": ["mint"],
      "pilar-progreso": ["rose"],
    });
    expect(document.querySelectorAll("#lp-ptile-dither")).toHaveLength(1);
  });

  it("gives each of the twelve points its own glyph", () => {
    const icons = PILLARS.flatMap((pillar) =>
      pillar.points.map((point) => point.icon),
    );
    expect(icons).toHaveLength(12);
    expect(new Set(icons).size).toBe(12);
  });

  it("shows only the PDF, DOCX and PPTX file types in the import demo", () => {
    render(<Pillars />);
    const section = document.getElementById("pilar-apuntes") as HTMLElement;
    const kinds = [...section.querySelectorAll<HTMLElement>(".lp-fbadge")].map(
      (badge) => badge.dataset.kind,
    );
    expect(new Set(kinds)).toEqual(new Set(["pdf", "docx", "pptx"]));
    expect(section).not.toHaveTextContent(/png|jpe?g|\.doc\b|\.ppt\b/i);
  });

  it("shows the schedule as a light week of the calendar, today first", () => {
    render(<Pillars />);
    const section = document.getElementById("pilar-hoy") as HTMLElement;
    for (const day of ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]) {
      expect(section).toHaveTextContent(day);
    }
    expect(section.querySelector(".bg-\\(--lp-ground\\)")).toBeNull();
  });

  it("never mentions study time", () => {
    render(<Pillars />);
    expect(document.body).not.toHaveTextContent(/tiempo de estudio|horas/i);
  });
});
