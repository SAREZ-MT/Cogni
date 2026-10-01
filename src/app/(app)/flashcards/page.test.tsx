import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import FlashcardsHubPage from "./page";

describe("FlashcardsHubPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("renders the hub while design previews are enabled", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<FlashcardsHubPage />);

    expect(
      screen.getByRole("heading", { name: "Flashcards" }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("answers 404 in production so sample decks never reach a visitor", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    expect(() => FlashcardsHubPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("renders in production when the preview opt-in is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "1");

    render(<FlashcardsHubPage />);

    expect(
      screen.getByRole("heading", { name: "Flashcards" }),
    ).toBeInTheDocument();
  });

  it("summarises every sample notebook with the totals derived from its decks", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<FlashcardsHubPage />);

    // 8 + 12 cards in Biología, 10 in Cálculo, 6 in Historia.
    expect(screen.getByText("36 tarjetas · 3 cuadernos")).toBeInTheDocument();
    const biologia = screen.getByRole("link", { name: /Biología Celular/ });
    expect(biologia).toHaveAttribute("href", "/flashcards/biologia-celular");
    expect(within(biologia).getByText(/20 tarjetas/)).toBeInTheDocument();
    expect(within(biologia).getByText(/5 pendientes/)).toBeInTheDocument();
  });

  it("offers a quick start into the first deck that has due cards", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<FlashcardsHubPage />);

    expect(
      screen.getByRole("link", { name: /Estudiar ahora/ }),
    ).toHaveAttribute(
      "href",
      "/flashcards/biologia-celular/session?deck=mitocondria-semana-3",
    );
    expect(
      screen.getByText("14 pendientes hoy", { selector: "span.block" }),
    ).toBeInTheDocument();
  });
});
