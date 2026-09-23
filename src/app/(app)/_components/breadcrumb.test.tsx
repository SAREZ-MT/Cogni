import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumb, BreadcrumbProvider, SetBreadcrumb } from "./breadcrumb";

describe("Breadcrumb", () => {
  it("shows the default trail 'Cogni › Inicio' when no route has published crumbs", () => {
    render(
      <BreadcrumbProvider>
        <Breadcrumb />
      </BreadcrumbProvider>,
    );

    expect(screen.getByText("Cogni")).toBeInTheDocument();
    expect(screen.getByText("Inicio")).toBeInTheDocument();
  });

  it("falls back to the default trail without a mounted provider", () => {
    render(<Breadcrumb />);

    expect(screen.getByText("Cogni")).toBeInTheDocument();
    expect(screen.getByText("Inicio")).toBeInTheDocument();
  });

  it("renders a navigation landmark with the Spanish accessible name", () => {
    render(
      <BreadcrumbProvider>
        <Breadcrumb />
      </BreadcrumbProvider>,
    );

    expect(
      screen.getByRole("navigation", { name: "Ruta de navegación" }),
    ).toBeInTheDocument();
  });

  it("marks the separators as decorative", () => {
    render(
      <BreadcrumbProvider>
        <SetBreadcrumb
          items={[{ label: "Biología" }, { label: "Mitocondria" }]}
        />
        <Breadcrumb />
      </BreadcrumbProvider>,
    );

    const separators = screen
      .getByRole("navigation", { name: "Ruta de navegación" })
      .querySelectorAll('[aria-hidden="true"]');
    // "Cogni › Biología › Mitocondria" has two separators.
    expect(separators).toHaveLength(2);
  });

  it("styles only the last segment as the current, emphasized crumb", () => {
    render(
      <BreadcrumbProvider>
        <SetBreadcrumb
          items={[{ label: "Biología" }, { label: "Mitocondria" }]}
        />
        <Breadcrumb />
      </BreadcrumbProvider>,
    );

    expect(screen.getByText("Cogni")).not.toHaveClass("text-fg");
    expect(screen.getByText("Biología")).not.toHaveClass("text-fg");
    const current = screen.getByText("Mitocondria");
    expect(current).toHaveClass("text-fg");
    expect(current).toHaveClass("font-medium");
  });

  it("lets a page route override the default trail through SetBreadcrumb", () => {
    render(
      <BreadcrumbProvider>
        <SetBreadcrumb
          items={[{ label: "Biología Celular" }, { label: "Mitocondria" }]}
        />
        <Breadcrumb />
      </BreadcrumbProvider>,
    );

    expect(screen.getByText("Cogni")).toBeInTheDocument();
    expect(screen.getByText("Biología Celular")).toBeInTheDocument();
    expect(screen.getByText("Mitocondria")).toBeInTheDocument();
    expect(screen.queryByText("Inicio")).not.toBeInTheDocument();
  });

  it("restores the default trail once the publishing route unmounts", () => {
    function Wrapper({ published }: { published: boolean }) {
      return (
        <BreadcrumbProvider>
          {published && <SetBreadcrumb items={[{ label: "Biología" }]} />}
          <Breadcrumb />
        </BreadcrumbProvider>
      );
    }

    const { rerender } = render(<Wrapper published />);
    expect(screen.getByText("Biología")).toBeInTheDocument();

    rerender(<Wrapper published={false} />);
    expect(screen.queryByText("Biología")).not.toBeInTheDocument();
    expect(screen.getByText("Inicio")).toBeInTheDocument();
  });
});
