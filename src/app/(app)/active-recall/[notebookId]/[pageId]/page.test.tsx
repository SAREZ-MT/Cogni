import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import ActiveRecallSessionPage from "./page";

const props = (notebookId: string, pageId: string) => ({
  params: Promise.resolve({ notebookId, pageId }),
});

describe("ActiveRecallSessionPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("starts the session of the page while design previews are enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      await ActiveRecallSessionPage(
        props("biologia-celular", "membrana-celular"),
      ),
    );

    expect(screen.getByTestId("active-recall-session")).toBeInTheDocument();
    expect(screen.getByText("Pregunta 1 de 6")).toBeInTheDocument();
  });

  it("answers 404 in production even for a known page", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    await expect(
      ActiveRecallSessionPage(props("biologia-celular", "membrana-celular")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([
    ["an unknown notebook", "no-existe", "membrana-celular"],
    ["a page of another notebook", "calculo-iii", "membrana-celular"],
    ["an unknown page", "biologia-celular", "no-existe"],
  ])("answers 404 for %s", async (_name, notebookId, pageId) => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(
      ActiveRecallSessionPage(props(notebookId, pageId)),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
