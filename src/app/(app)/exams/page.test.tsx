import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import ExamsHubPage from "./page";

describe("ExamsHubPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("renders the hub while design previews are enabled", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<ExamsHubPage />);

    expect(
      screen.getByRole("heading", { name: "Exámenes" }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("answers 404 in production so sample exams never reach a visitor", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    expect(() => ExamsHubPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("renders in production when the preview opt-in is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "1");

    render(<ExamsHubPage />);

    expect(
      screen.getByRole("heading", { name: "Exámenes" }),
    ).toBeInTheDocument();
  });

  it("derives the totals from the sample pages", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<ExamsHubPage />);

    expect(screen.getByText("4 exámenes · 3 cuadernos")).toBeInTheDocument();
    expect(screen.getByText("4 exámenes presentados")).toBeInTheDocument();
    expect(screen.getByText("2 aprobados")).toBeInTheDocument();
    expect(screen.getByText("1 pendiente de repetir")).toBeInTheDocument();
  });

  it("links the retake banner to the variant set of the failed page", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<ExamsHubPage />);

    expect(
      screen.getByText("Tienes 1 página pendiente de repetir examen"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Repetir examen" }),
    ).toHaveAttribute("href", "/exams/biologia-celular/mitocondria?retake=1");
  });

  it("starts a new exam on the first page with questions", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<ExamsHubPage />);

    expect(screen.getByRole("link", { name: /Nuevo examen/ })).toHaveAttribute(
      "href",
      "/exams/biologia-celular/mitocondria",
    );
  });
});
