import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumb, BreadcrumbProvider } from "./_components/breadcrumb";
import HomePage from "./page";

describe("HomePage (app shell empty state)", () => {
  it("shows the encouraging empty-state copy in Spanish", () => {
    render(<HomePage />);

    expect(
      screen.getByText("Aún no tienes cuadernos. Crea uno para empezar."),
    ).toBeInTheDocument();
  });

  it("does not expose any product feature link", () => {
    render(<HomePage />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("publishes 'Inicio' as the breadcrumb trail", () => {
    render(
      <BreadcrumbProvider>
        <HomePage />
        <Breadcrumb />
      </BreadcrumbProvider>,
    );

    expect(screen.getByText("Cogni")).toBeInTheDocument();
    expect(screen.getByText("Inicio")).toBeInTheDocument();
  });
});
