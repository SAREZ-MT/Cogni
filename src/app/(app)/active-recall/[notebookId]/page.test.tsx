import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import ActiveRecallNotebookPage from "./page";

const params = (notebookId: string) => Promise.resolve({ notebookId });

describe("ActiveRecallNotebookPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("lists the sessions by page while design previews are enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      await ActiveRecallNotebookPage({ params: params("biologia-celular") }),
    );

    expect(
      screen.getByRole("heading", { name: "Biología Celular" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("3 sesiones · 2 páginas con preguntas"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mitocondria/ })).toHaveAttribute(
      "href",
      "/active-recall/biologia-celular/mitocondria",
    );
    expect(
      screen.getByRole("link", { name: /Membrana celular/ }),
    ).toHaveAttribute(
      "href",
      "/active-recall/biologia-celular/membrana-celular",
    );
  });

  it("answers 404 in production even for a known notebook", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    await expect(
      ActiveRecallNotebookPage({ params: params("biologia-celular") }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers 404 for an unknown notebook", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(
      ActiveRecallNotebookPage({ params: params("no-existe") }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
