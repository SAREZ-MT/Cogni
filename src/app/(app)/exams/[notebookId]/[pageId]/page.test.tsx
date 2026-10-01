import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import { getExamQuestions } from "../../_data/sample";
import ExamSessionPage from "./page";

function props(notebookId: string, pageId: string, retake?: string) {
  return {
    params: Promise.resolve({ notebookId, pageId }),
    searchParams: Promise.resolve({ retake }),
  };
}

describe("ExamSessionPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    await expect(
      ExamSessionPage(props("biologia-celular", "mitocondria")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([
    ["no-existe", "mitocondria"],
    ["biologia-celular", "no-existe"],
    ["calculo-iii", "mitocondria"],
  ])("answers 404 for %s/%s", async (notebookId, pageId) => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(ExamSessionPage(props(notebookId, pageId))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("serves the page's own questions", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(await ExamSessionPage(props("biologia-celular", "mitocondria")));

    const [first] = getExamQuestions("mitocondria");
    expect(screen.getByText(first.stem)).toBeInTheDocument();
    expect(screen.queryByText("Examen de repetición")).not.toBeInTheDocument();
  });

  it("serves the variant set only for ?retake=1", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      await ExamSessionPage(props("biologia-celular", "mitocondria", "1")),
    );

    const [first] = getExamQuestions("mitocondria", { retake: true });
    expect(screen.getByText(first.stem)).toBeInTheDocument();
    expect(
      screen.getByText("Examen de repetición", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("ignores any other retake value", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      await ExamSessionPage(props("biologia-celular", "mitocondria", "true")),
    );

    expect(screen.queryByText("Examen de repetición")).not.toBeInTheDocument();
  });
});
