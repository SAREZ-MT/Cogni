import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LegalPage } from "./_components/legal-page";
import { LEGAL_DRAFT_NOTICE, type LegalPageSlug } from "./_lib/legal-documents";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));

const SLUGS: LegalPageSlug[] = [
  "terminos",
  "privacidad",
  "uso-aceptable",
  "derechos-de-autor",
];

async function renderPage(slug: LegalPageSlug) {
  return render(await LegalPage({ slug }));
}

describe("legal pages", () => {
  it.each(
    SLUGS,
  )("%s shows version, effective date and the draft notice", async (slug) => {
    await renderPage(slug);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId("legal-version")).toHaveTextContent("1.0");
    expect(screen.getByText("Vigente desde")).toBeInTheDocument();
    expect(screen.getByTestId("legal-draft-notice")).toHaveTextContent(
      LEGAL_DRAFT_NOTICE,
    );
  });

  it.each(
    SLUGS,
  )("%s: every index link targets a heading on the page", async (slug) => {
    const { container } = await renderPage(slug);
    const index = screen.getByRole("navigation", { name: "En esta página" });
    const links = within(index).getAllByRole("link");

    expect(links.length).toBeGreaterThan(2);
    for (const link of links) {
      const id = link.getAttribute("href")?.slice(1) ?? "";
      const target = container.querySelector(`[id="${id}"]`);
      expect(target, `missing #${id}`).not.toBeNull();
      expect(target?.tagName).toMatch(/^H[2-4]$/);
    }
  });

  it.each(SLUGS)("%s: heading ids are unique", async (slug) => {
    const { container } = await renderPage(slug);
    const ids = [...container.querySelectorAll("[id]")].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks every [PENDIENTE: …] placeholder", async () => {
    const { container } = await renderPage("terminos");
    const marks = [...container.querySelectorAll("mark[data-pending]")];

    expect(marks.length).toBeGreaterThan(3);
    for (const mark of marks) {
      expect(mark.textContent).toMatch(/^\[PENDIENTE:[^\]]*\]$/);
    }
    const unmarked = [...container.querySelectorAll("p, li, td, dd")].filter(
      (node) =>
        [...node.childNodes].some(
          (child) =>
            child.nodeType === Node.TEXT_NODE &&
            child.textContent?.includes("[PENDIENTE:"),
        ),
    );
    expect(unmarked).toEqual([]);
  });

  it("puts the cookies, aviso and subencargados sections behind their anchors", async () => {
    const { container } = await renderPage("privacidad");

    expect(container.querySelector("h2#cookies")).toHaveTextContent(
      "Política de cookies de Cogni",
    );
    expect(container.querySelector("h2#aviso-de-privacidad")).toHaveTextContent(
      "Aviso de privacidad de Cogni",
    );
    expect(container.querySelector("h2#subencargados")).toHaveTextContent(
      "Lista de subencargados y proveedores de Cogni",
    );
  });

  it("points internal cross-links at the new routes and anchors", async () => {
    const { container } = await renderPage("terminos");
    const hrefs = [...container.querySelectorAll("article a")].map((a) =>
      a.getAttribute("href"),
    );

    expect(hrefs).toContain("/legal/privacidad");
    expect(hrefs).toContain("/legal/privacidad#cookies");
    expect(hrefs).toContain("/legal/privacidad#subencargados");
    expect(hrefs).toContain("/legal/uso-aceptable#integridad-academica");
    expect(hrefs.some((href) => href?.endsWith(".md"))).toBe(false);
  });

  it("links the other legal pages and marks the current one", async () => {
    await renderPage("uso-aceptable");
    const nav = screen.getByRole("navigation", { name: "Documentos legales" });
    const links = within(nav).getAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/legal/terminos",
      "/legal/privacidad",
      "/legal/uso-aceptable",
      "/legal/derechos-de-autor",
    ]);
    expect(within(nav).getByRole("link", { current: "page" })).toHaveAttribute(
      "href",
      "/legal/uso-aceptable",
    );
  });

  it("never renders raw HTML from the sources", async () => {
    const { container } = await renderPage("privacidad");
    expect(container.querySelector("script, iframe, style")).toBeNull();
  });
});
