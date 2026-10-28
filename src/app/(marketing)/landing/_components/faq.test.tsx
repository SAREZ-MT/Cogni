import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FAQ_ITEMS, Faq } from "./faq";

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

const QUESTIONS = [
  "¿La IA se inventa cosas?",
  "¿Puedo importar cualquier archivo?",
  "¿Qué pasa con mis apuntes?",
  "¿Funciona en el celular?",
  "¿Por qué no muestran cuánto tiempo estudié?",
];

describe("Faq", () => {
  it("is a light section at #preguntas named by its headline", () => {
    render(<Faq />);
    const section = screen.getByRole("region", {
      name: "Preguntas frecuentes.",
    });
    expect(section).toHaveAttribute("id", "preguntas");
    expect(section).toHaveAttribute("data-nav-theme", "light");
    const accents = within(section)
      .getByRole("heading", { level: 2 })
      .querySelectorAll("em");
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent("frecuentes");
  });

  it("asks exactly the five approved questions, in order", () => {
    render(<Faq />);
    expect(
      screen.getAllByRole("button").map((button) => button.textContent?.trim()),
    ).toEqual(QUESTIONS);
    expect(FAQ_ITEMS).toHaveLength(5);
    expect(document.body).not.toHaveTextContent("¿Cuánto cuesta?");
    expect(document.body).not.toHaveTextContent("18 años");
  });

  it("opens the first answer and keeps the rest closed", () => {
    render(<Faq />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-expanded"))).toEqual([
      "true",
      "false",
      "false",
      "false",
      "false",
    ]);
    const panel = document.getElementById(
      buttons[0].getAttribute("aria-controls") ?? "",
    );
    expect(panel?.tagName).toBe("SECTION");
    expect(panel).toHaveAccessibleName(QUESTIONS[0]);
    expect(panel).not.toHaveAttribute("inert");
  });

  it("toggles an answer with its button", async () => {
    const user = userEvent.setup();
    render(<Faq />);
    const button = screen.getByRole("button", {
      name: "¿Funciona en el celular?",
    });
    const panel = document.getElementById(
      button.getAttribute("aria-controls") ?? "",
    );
    expect(panel).toHaveAttribute("inert");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveAttribute("inert");
    expect(panel).toHaveTextContent(
      "Funciona en el navegador web, también en el del celular, pero está pensado sobre todo para usarlo en la computadora. No hay app nativa para celular.",
    );
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("answers the study-time question without showing any study time", () => {
    render(<Faq />);
    expect(document.body).toHaveTextContent(
      "Porque más horas no es lo mismo que recordar más. Cogni cuenta repasos completados y tu dominio por página.",
    );
  });
});
