import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import ExamResultsPage from "./page";

function params(notebookId: string, pageId: string) {
  return { params: Promise.resolve({ notebookId, pageId }) };
}

describe("ExamResultsPage (stored results)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    await expect(
      ExamResultsPage(params("biologia-celular", "mitocondria")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([
    ["no-existe", "mitocondria"],
    ["biologia-celular", "no-existe"],
    ["calculo-iii", "derivadas-parciales"],
  ])("answers 404 for %s/%s (unknown or never attempted)", async (notebookId, pageId) => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(ExamResultsPage(params(notebookId, pageId))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("renders the last stored session of a failed page with the retake link", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(await ExamResultsPage(params("biologia-celular", "mitocondria")));

    expect(screen.getByTestId("exam-score")).toHaveTextContent("60%");
    expect(screen.getByText("Presentado el 22 sept")).toBeInTheDocument();
    expect(screen.getByText("Nota menor a 70 %")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Repetir examen" }),
    ).toHaveAttribute("href", "/exams/biologia-celular/mitocondria?retake=1");
    expect(screen.getByText("09:00")).toBeInTheDocument();
  });

  it("renders a passed page as approved, linking a fresh session", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(await ExamResultsPage(params("historia-del-arte", "renacimiento")));

    expect(screen.getByTestId("exam-score")).toHaveTextContent("100%");
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nuevo examen/ })).toHaveAttribute(
      "href",
      "/exams/historia-del-arte/renacimiento",
    );
  });
});
