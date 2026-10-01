import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import ExamQuestionsPage from "./page";

function params(notebookId: string, pageId: string) {
  return { params: Promise.resolve({ notebookId, pageId }) };
}

describe("ExamQuestionsPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    await expect(
      ExamQuestionsPage(params("biologia-celular", "mitocondria")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([
    ["no-existe", "mitocondria"],
    ["biologia-celular", "no-existe"],
    ["calculo-iii", "mitocondria"],
  ])("answers 404 for %s/%s", async (notebookId, pageId) => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(ExamQuestionsPage(params(notebookId, pageId))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("lists the page's management questions with their origins", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(await ExamQuestionsPage(params("biologia-celular", "mitocondria")));

    expect(
      screen.getByRole("heading", { name: "Mitocondria — preguntas" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("exam-question-row")).toHaveLength(15);
    expect(screen.getAllByText("Retirada")).toHaveLength(4);
    expect(screen.getAllByText("Variante").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual")).toHaveLength(1);
  });

  it("lists a plain page as AI generated, nothing retired", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      await ExamQuestionsPage(params("historia-del-arte", "renacimiento")),
    );

    expect(screen.getAllByTestId("exam-question-row")).toHaveLength(5);
    expect(screen.queryByText("Retirada")).not.toBeInTheDocument();
    expect(screen.queryByText("Manual")).not.toBeInTheDocument();
  });
});
