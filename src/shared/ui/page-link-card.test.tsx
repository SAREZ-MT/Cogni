import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageLinkCard } from "./page-link-card";

describe("PageLinkCard", () => {
  it("is one link to the page with its title, meta and trailing label", () => {
    render(
      <PageLinkCard
        href="/notebooks/nb/pages/p"
        title="Mitocondria"
        meta={<span>Biología Celular</span>}
        trailing="Editada hace 2h"
        ariaLabel="Abrir Mitocondria de Biología Celular, editada hace 2h"
      />,
    );

    const link = screen.getByRole("link", {
      name: "Abrir Mitocondria de Biología Celular, editada hace 2h",
    });
    expect(link).toHaveAttribute("href", "/notebooks/nb/pages/p");
    expect(link).toHaveTextContent("Mitocondria");
    expect(link).toHaveTextContent("Biología Celular");
    expect(link).toHaveTextContent("Editada hace 2h");
  });

  // User 2026-10-18: the trailing label sits in the bottom-right corner so
  // it never crowds the page title.
  it("pins the trailing label to the bottom-right corner", () => {
    const { container } = render(
      <PageLinkCard
        href="/notebooks/nb/pages/p"
        title="Mitocondria"
        meta={<span>Biología Celular</span>}
        trailing="Editada hace 2h"
        ariaLabel="Abrir Mitocondria de Biología Celular, editada hace 2h"
      />,
    );

    const trailing = container.querySelector('[data-part="trailing"]');
    expect(trailing).toHaveClass("self-end");
    expect(trailing).not.toHaveClass("self-start");
  });

  // H2-T5q (user 2026-10-18, kokonutui "Widget Grid" reference, no
  // icons): the meta is a small header above a larger title.
  it("puts the meta as a small header above the title", () => {
    render(
      <PageLinkCard
        href="/notebooks/nb/pages/p"
        title="Mitocondria"
        meta={<span>Biología Celular</span>}
        trailing="Editada hace 2h"
        ariaLabel="Abrir Mitocondria de Biología Celular, editada hace 2h"
      />,
    );

    const meta = screen.getByText("Biología Celular");
    const title = screen.getByText("Mitocondria");
    expect(
      meta.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(title).toHaveClass("text-[15px]");
  });

  // H2-T5r: an optional decorative backdrop sits behind the content.
  it("renders an optional backdrop behind the content", () => {
    const { container } = render(
      <PageLinkCard
        href="/notebooks/nb/pages/p"
        title="Mitocondria"
        meta={<span>Biología Celular</span>}
        backdrop={<span data-testid="backdrop" />}
        ariaLabel="Abrir Mitocondria de Biología Celular"
      />,
    );

    const slot = container.querySelector('[data-part="backdrop"]');
    expect(slot).toContainElement(screen.getByTestId("backdrop"));
    expect(slot).toHaveAttribute("aria-hidden", "true");
    expect(slot).toHaveClass("absolute");
  });

  it("starts with the title when there is no meta", () => {
    const { container } = render(
      <PageLinkCard
        href="/notebooks/nb/pages/p"
        title="Mitocondria"
        ariaLabel="Abrir Mitocondria"
      />,
    );

    expect(container.querySelector('[data-part="meta"]')).toBeNull();
    expect(screen.getByText("Mitocondria")).not.toHaveClass("mt-1");
  });

  it("leaves the trailing slot out when there is no label", () => {
    const { container } = render(
      <PageLinkCard
        href="/notebooks/nb/pages/p"
        title="Mitocondria"
        meta="Biología Celular"
        ariaLabel="Abrir Mitocondria de Biología Celular"
      />,
    );

    expect(container.querySelector('[data-part="trailing"]')).toBeNull();
  });
});
