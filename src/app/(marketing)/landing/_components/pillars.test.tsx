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
        "Cuenta lo que hiciste, comparado con la semana pasada.",
      ],
      ["Tu racha", "Días seguidos con al menos un repaso."],
      [
        "Dominio por página",
        "Qué páginas están listas, tu acierto por técnica y tu calibración.",
      ],
    ]);
    render(<Pillars />);
    expect(document.body).toHaveTextContent("Acierto por técnica");
    expect(document.body).not.toHaveTextContent("Dominio por técnica");
  });

  it("never mentions study time", () => {
    render(<Pillars />);
    expect(document.body).not.toHaveTextContent(/tiempo de estudio|horas/i);
  });
});
