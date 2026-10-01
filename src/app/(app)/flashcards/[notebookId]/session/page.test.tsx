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

const props = (notebookId: string, deck?: string) => ({
  params: Promise.resolve({ notebookId }),
  searchParams: Promise.resolve({ deck }),
});

describe("FlashcardsSessionPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("starts the requested deck while design previews are enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      await FlashcardsSessionPage(
        props("biologia-celular", "membrana-celular"),
      ),
    );

    expect(screen.getByText("Membrana celular")).toBeInTheDocument();
    expect(screen.getByText("12 tarjetas en esta sesión")).toBeInTheDocument();
  });

  it("falls back to the first deck of the notebook for an unknown deck id", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(await FlashcardsSessionPage(props("biologia-celular", "otro")));

    expect(screen.getByText("Mitocondria · Semana 3")).toBeInTheDocument();
  });

  it("answers 404 in production even for a known deck", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    await expect(
      FlashcardsSessionPage(props("biologia-celular", "membrana-celular")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers 404 for an unknown notebook", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(FlashcardsSessionPage(props("no-existe"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
