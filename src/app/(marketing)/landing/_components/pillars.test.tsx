import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pillars } from "./pillars";

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
});
