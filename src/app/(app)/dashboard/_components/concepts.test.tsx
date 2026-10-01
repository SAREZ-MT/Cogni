import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Concepts } from "./concepts";

describe("Concepts", () => {
  it("lists the five strongest concepts, best first", () => {
    render(<Concepts />);

    const list = within(
      screen.getByRole("figure", { name: /Fortalezas/ }),
    ).getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("Perspectiva lineal");
    expect(items[0]).toHaveTextContent("95%");
    expect(items[4]).toHaveTextContent("Multiplicadores de Lagrange");
  });

  it("lists the five weakest concepts, worst first", () => {
    render(<Concepts />);

    const list = within(
      screen.getByRole("figure", { name: /Puntos débiles/ }),
    ).getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("Regulación de la apoptosis");
    expect(items[0]).toHaveTextContent("20%");
  });

  it("fills strengths in success and weak points in error", () => {
    render(<Concepts />);

    const fill = (name: RegExp) =>
      screen.getByRole("figure", { name }).querySelector("[role=img] > span");
    expect(fill(/Fortalezas/)).toHaveClass("bg-success-500");
    expect(fill(/Puntos débiles/)).toHaveClass("bg-error-500");
  });

  it("describes both lists", () => {
    render(<Concepts />);

    expect(
      screen.getByText("Los 5 conceptos con mejor desempeño."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Los 5 conceptos que más necesitan repaso."),
    ).toBeInTheDocument();
  });
});
