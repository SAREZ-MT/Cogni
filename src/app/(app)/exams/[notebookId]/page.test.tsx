import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import ExamsNotebookPage from "./page";

function params(notebookId: string) {
  return { params: Promise.resolve({ notebookId }) };
}

describe("ExamsNotebookPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    await expect(ExamsNotebookPage(params("biologia-celular"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("answers 404 for an unknown notebook", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(ExamsNotebookPage(params("no-existe"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("lists the notebook's exams by page with the retake state", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(await ExamsNotebookPage(params("biologia-celular")));

    expect(
      screen.getByText("3 exámenes · 2 páginas con preguntas"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mitocondria/ })).toHaveAttribute(
      "href",
      "/exams/biologia-celular/mitocondria",
    );
    expect(screen.getByText("Repetir pendiente")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Membrana celular/ }),
    ).toBeInTheDocument();
  });

  it("lists a never-attempted page as 'Sin intentar'", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(await ExamsNotebookPage(params("calculo-iii")));

    expect(screen.getByText("Sin intentar")).toBeInTheDocument();
    expect(screen.getByText("Presentar examen →")).toBeInTheDocument();
  });
});
