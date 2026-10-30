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
  "¿Qué archivos puedo importar?",
  "¿Cómo crea Cogni las tarjetas y las preguntas?",
  "¿Puedo confiar en lo que genera la IA?",
  "¿Sirve para cualquier materia?",
  "¿Cómo sabe Cogni qué repasar cada día?",
  "¿Cómo sé si estoy aprendiendo?",
  "¿Qué pasa con mis apuntes?",
  "¿Funciona en el celular?",
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

  it("asks the eight visitor questions, in order", () => {
    render(<Faq />);
    expect(
      screen.getAllByRole("button").map((button) => button.textContent?.trim()),
    ).toEqual(QUESTIONS);
    expect(FAQ_ITEMS).toHaveLength(8);
    expect(document.body).not.toHaveTextContent("¿Cuánto cuesta?");
    expect(document.body).not.toHaveTextContent("18 años");
  });

  it("opens the first answer and keeps the rest closed", () => {
    render(<Faq />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-expanded"))).toEqual(
      QUESTIONS.map((_, index) => (index === 0 ? "true" : "false")),
    );
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

  it("never mentions study time, cost or age", () => {
    render(<Faq />);
    const text = FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`)
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/tiempo|horas|minutos|cuesta|precio|18 años/);
  });

  it("links the privacy answer to the privacy policy", async () => {
    const user = userEvent.setup();
    render(<Faq />);
    await user.click(
      screen.getByRole("button", { name: "¿Qué pasa con mis apuntes?" }),
    );
    expect(
      screen.getByRole("link", { name: "Lee la Política de privacidad" }),
    ).toHaveAttribute("href", "/legal/privacidad");
    expect(document.body).toHaveTextContent(
      "No vendemos tus datos, no hacemos publicidad con ellos y no entrenamos modelos propios.",
    );
  });

  it("lists the import formats the ingestion module accepts", () => {
    render(<Faq />);
    expect(document.body).toHaveTextContent(
      "PDF, Word (.docx) y PowerPoint (.pptx) de hasta 20 MB.",
    );
  });
});
