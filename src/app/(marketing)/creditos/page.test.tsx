import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CREDIT_GROUPS } from "./_components/credits-list";
import CreditsPage, { metadata } from "./page";

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

describe("/creditos", () => {
  it("has its own title and description", () => {
    expect(metadata.title).toBe("Créditos · Cogni");
    expect(metadata.description).toBeTruthy();
  });

  it("opens with one h1 and a single serif italic keyword", () => {
    render(<CreditsPage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Hecho con ayuda.");
    expect(heading.querySelectorAll("em")).toHaveLength(1);
  });

  it("credits the illustrations, every landing font and both icon sets", () => {
    render(<CreditsPage />);
    expect(CREDIT_GROUPS.map((group) => group.title)).toEqual([
      "Ilustraciones",
      "Tipografías",
      "Íconos",
    ]);
    const fonts = screen.getByRole("region", { name: "Tipografías" });
    for (const font of [
      "Inter",
      "Instrument Serif",
      "Manrope",
      "JetBrains Mono",
      "Caveat",
    ]) {
      expect(fonts).toHaveTextContent(font);
    }
    expect(fonts).toHaveTextContent("SIL Open Font License 1.1");
    const icons = screen.getByRole("region", { name: "Íconos" });
    expect(icons).toHaveTextContent("Lucide");
    expect(icons).toHaveTextContent("Licencia ISC");
    expect(icons).toHaveTextContent("Phosphor Icons");
    expect(icons).toHaveTextContent("Licencia MIT");
  });

  it("marks the open Magnific details as visibly pending", () => {
    render(<CreditsPage />);
    const illustrations = screen.getByRole("region", { name: "Ilustraciones" });
    expect(illustrations).toHaveTextContent("Designed by Magnific");
    const pending = Array.from(
      illustrations.querySelectorAll("mark"),
      (mark) => mark.textContent,
    );
    expect(pending).toEqual([
      "PENDIENTE: confirmar qué ilustraciones son de Magnific",
      "PENDIENTE: enlace a Magnific",
    ]);
    expect(within(illustrations).queryByRole("link")).toBeNull();
  });
});
