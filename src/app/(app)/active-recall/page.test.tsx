import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import ActiveRecallHubPage from "./page";

describe("ActiveRecallHubPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it("renders the hub while design previews are enabled", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<ActiveRecallHubPage />);

    expect(
      screen.getByRole("heading", { name: "Active recall" }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("answers 404 in production so sample sessions never reach a visitor", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "");

    expect(() => ActiveRecallHubPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("renders in production when the preview opt-in is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COGNI_DESIGN_PREVIEWS", "1");

    render(<ActiveRecallHubPage />);

    expect(
      screen.getByRole("heading", { name: "Active recall" }),
    ).toBeInTheDocument();
  });

  it("totals the sample sessions and notebooks in the header", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<ActiveRecallHubPage />);

    expect(screen.getByText("8 sesiones · 3 cuadernos")).toBeInTheDocument();
  });

  it("summarises sessions, average accuracy and notebooks in pills", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<ActiveRecallHubPage />);

    // (80 + 70 + 58 + 33 + 58 + 100 + 90 + 70) / 8 = 69.9
    expect(screen.getByText("8 sesiones guardadas")).toBeInTheDocument();
    expect(screen.getByText("70% precisión promedio")).toBeInTheDocument();
    expect(screen.getByText("3 cuadernos activos")).toBeInTheDocument();
  });

  it("offers a quick start into the first page that has questions", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<ActiveRecallHubPage />);

    const start = screen.getByRole("link", { name: /Nueva sesión/ });
    expect(start).toHaveAttribute(
      "href",
      "/active-recall/biologia-celular/mitocondria",
    );
    expect(start).toHaveTextContent("4 páginas con preguntas");
  });

  it("links each notebook card to its sessions with the derived meta", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<ActiveRecallHubPage />);

    const biologia = screen.getByRole("link", { name: /Biología Celular/ });
    expect(biologia).toHaveAttribute("href", "/active-recall/biologia-celular");
    expect(within(biologia).getByText(/3 sesiones/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /sesiones ·/ })).toHaveLength(3);
  });
});
