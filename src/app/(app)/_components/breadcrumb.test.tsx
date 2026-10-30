import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Breadcrumb,
  BreadcrumbProvider,
  SetBreadcrumb,
  useBreadcrumb,
} from "./breadcrumb";

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

  // Review follow-up from S3 (R3-setbreadcrumb-effect-identity): the
  // provider's context value used to be a fresh object literal on every
  // render, so SetBreadcrumb's effect (which depended on that whole
  // object) re-ran an extra time after its own publish() call caused the
  // provider to re-render — a second, redundant publish that re-rendered
  // every context consumer again. An inline `items` array (its identity
  // changes on every render of the caller, same as a real page route)
  // must still settle after exactly one publish.
  it("settles publishing after one render with an inline items array, not two", () => {
    const renders: string[] = [];
    function Probe() {
      const items = useBreadcrumb();
      renders.push(items.map((item) => item.label).join(">"));
      return null;
    }

    render(
      <BreadcrumbProvider>
        <SetBreadcrumb items={[{ label: "Biología" }]} />
        <Probe />
      </BreadcrumbProvider>,
    );

    expect(renders).toEqual(["Inicio", "Biología"]);
  });
});

describe("Breadcrumb links", () => {
  function renderTrail() {
    return render(
      <BreadcrumbProvider>
        <SetBreadcrumb
          items={[
            { label: "Cuadernos", href: "/notebooks" },
            { label: "Biología", href: "/notebooks/nb1" },
            { label: "Mitosis" },
          ]}
        />
        <Breadcrumb />
      </BreadcrumbProvider>,
    );
  }

  it("links the root and every intermediate segment to its screen", () => {
    renderTrail();

    expect(screen.getByRole("link", { name: "Cogni" })).toHaveAttribute(
      "href",
      "/inicio",
    );
    expect(screen.getByRole("link", { name: "Cuadernos" })).toHaveAttribute(
      "href",
      "/notebooks",
    );
    expect(screen.getByRole("link", { name: "Biología" })).toHaveAttribute(
      "href",
      "/notebooks/nb1",
    );
  });

  it("never links the current (last) segment and marks it aria-current=page", () => {
    renderTrail();

    expect(
      screen.queryByRole("link", { name: "Mitosis" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Mitosis")).toHaveAttribute("aria-current", "page");
  });

  it("does not link the last segment even when it carries an href", () => {
    render(
      <BreadcrumbProvider>
        <SetBreadcrumb items={[{ label: "Cuadernos", href: "/notebooks" }]} />
        <Breadcrumb />
      </BreadcrumbProvider>,
    );

    expect(
      screen.queryByRole("link", { name: "Cuadernos" }),
    ).not.toBeInTheDocument();
  });

  it("renders a segment without href as plain text", () => {
    render(
      <BreadcrumbProvider>
        <SetBreadcrumb items={[{ label: "Biología" }, { label: "Mitosis" }]} />
        <Breadcrumb />
      </BreadcrumbProvider>,
    );

    expect(
      screen.queryByRole("link", { name: "Biología" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Biología")).toBeInTheDocument();
  });
});
