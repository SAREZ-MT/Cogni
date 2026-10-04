import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TERMS_VERSION } from "../domain";
import { TERMS_COPY } from "./terms-copy";
import { TermsOfUse } from "./terms-of-use";

describe("TermsOfUse", () => {
  it("renders the heading and the current version", () => {
    render(<TermsOfUse />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Términos de uso" }),
    ).toBeInTheDocument();
    expect(screen.getByText(`Versión ${TERMS_VERSION}`)).toBeInTheDocument();
  });

  it("renders every clause as its own headed section", () => {
    render(<TermsOfUse />);

    const titles = TERMS_COPY.sections.map((section) => section.title);
    expect(titles).toEqual([
      "Edad mínima",
      "Regiones no disponibles",
      "Procesamiento con proveedores de IA",
      "Datos sensibles y de terceros",
      "Servicio académico en desarrollo",
      "Eliminación de la cuenta",
      "Contacto",
    ]);
    for (const title of titles) {
      expect(
        screen.getByRole("heading", { level: 2, name: title }),
      ).toBeInTheDocument();
    }
  });

  it("names the minimum age, the excluded regions and the AI providers", () => {
    render(<TermsOfUse />);

    expect(screen.getByText(/18 años/)).toBeInTheDocument();
    expect(
      screen.getByText(/Espacio Económico Europeo, el Reino Unido y Suiza/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Google Gemini, Cloudflare Workers AI, OpenRouter y Groq/,
      ),
    ).toBeInTheDocument();
  });
});
