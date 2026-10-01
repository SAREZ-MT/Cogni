import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import FlashcardsSessionPage from "./page";

const props = (notebookId: string, pageId: string) => ({
  params: Promise.resolve({ notebookId, pageId }),
});

describe("FlashcardsSessionPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("starts the deck of the page while design previews are enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      await FlashcardsSessionPage(
        props("biologia-celular", "membrana-celular"),
      ),
    );

    expect(screen.getByText("Membrana celular")).toBeInTheDocument();
    expect(screen.getByText("12 tarjetas en esta sesión")).toBeInTheDocument();
  });

  it("answers 404 in production even for a known page", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    await expect(
      FlashcardsSessionPage(props("biologia-celular", "membrana-celular")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers 404 for an unknown notebook", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(
      FlashcardsSessionPage(props("no-existe", "membrana-celular")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers 404 for a page of another notebook", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(
      FlashcardsSessionPage(props("calculo-iii", "membrana-celular")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers 404 for an unknown page", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(
      FlashcardsSessionPage(props("biologia-celular", "no-existe")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
