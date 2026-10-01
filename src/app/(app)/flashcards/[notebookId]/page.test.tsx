import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import FlashcardsNotebookPage from "./page";

const params = (notebookId: string) => Promise.resolve({ notebookId });

describe("FlashcardsNotebookPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("renders the deck list while design previews are enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      await FlashcardsNotebookPage({ params: params("biologia-celular") }),
    );

    expect(
      screen.getByRole("heading", { name: "Biología Celular" }),
    ).toBeInTheDocument();
  });

  it("answers 404 in production even for a known notebook", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    await expect(
      FlashcardsNotebookPage({ params: params("biologia-celular") }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers 404 for an unknown notebook", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(
      FlashcardsNotebookPage({ params: params("no-existe") }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lists one deck per page of the notebook, titled by the page, with its derived card count and a session link", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      await FlashcardsNotebookPage({ params: params("biologia-celular") }),
    );

    const deck = screen.getByRole("link", { name: /Mitocondria/ });
    expect(deck).toHaveAttribute(
      "href",
      "/flashcards/biologia-celular/mitocondria",
    );
    expect(deck).toHaveTextContent("8 tarjetas");
    expect(deck).toHaveTextContent("5 pendientes");
    expect(
      screen.getByRole("link", { name: /Membrana celular/ }),
    ).toHaveTextContent("Al día");
    expect(
      screen.getByText("20 tarjetas · 2 páginas con flashcards"),
    ).toBeInTheDocument();
  });

  it("offers no notebook-level card creation: cards are created from a page", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      await FlashcardsNotebookPage({ params: params("biologia-celular") }),
    );

    expect(
      screen.queryByRole("button", { name: /Nueva tarjeta/ }),
    ).not.toBeInTheDocument();
  });
});
