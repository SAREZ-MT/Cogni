import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONCEPTS, referenceText } from "./_components/science-concepts";
import SciencePage, { metadata } from "./page";

vi.mock("next/navigation", () => ({ usePathname: () => "/ciencia" }));

// The page reads the session to pick the nav; anonymous unless a test signs
// a user in.
const session = vi.hoisted(() => ({
  user: null as { id: string; email: string | null } | null,
}));
vi.mock("@/modules/identity", () => ({
  getCurrentUser: vi.fn(async () => session.user),
}));

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

describe("/ciencia", () => {
  it("has its own title and description", async () => {
    expect(metadata.title).toBe("La ciencia detrás de Cogni · Cogni");
    expect(metadata.description).toBeTruthy();
  });

  it("opens with one h1 and a single serif italic keyword", async () => {
    render(await SciencePage());
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(
      "Seis ideas para recordar lo que estudias.",
    );
    const accents = heading.querySelectorAll("em");
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent("recordar");
    expect(
      screen.getByRole("link", { name: "Volver a Cogni" }),
    ).toHaveAttribute("href", "/");
  });

  it("indexes the six ideas and gives each a section with Cogni's use and its references", async () => {
    render(await SciencePage());
    expect(CONCEPTS).toHaveLength(6);
    const index = screen.getByRole("navigation", { name: "Las seis ideas" });
    expect(
      within(index)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(CONCEPTS.map((concept) => `#${concept.id}`));
    for (const concept of CONCEPTS) {
      const section = screen.getByRole("region", { name: concept.name });
      expect(section).toHaveAttribute("id", concept.id);
      expect(section).toHaveTextContent("Así lo usa Cogni");
      expect(section).toHaveTextContent(concept.inCogni);
      const references = within(section).getByRole("list", {
        name: "Referencias",
      });
      expect(
        within(references)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual(concept.references.map(referenceText));
    }
  });

  it("cites every source in full APA 7, with no pending markers", async () => {
    render(await SciencePage());
    const references = CONCEPTS.flatMap((concept) => concept.references);
    expect(references).toHaveLength(10);
    for (const reference of references) {
      // Authors, (year), title, then the italic journal or book.
      expect(referenceText(reference)).toMatch(
        /^[^()]+ \((18|19|20)\d{2}\)\. .+\./,
      );
      expect(reference.italic.length).toBeGreaterThan(0);
    }
    expect(document.body).not.toHaveTextContent(/PENDIENTE|\[R\]|DOI|et al\./);
    expect(
      screen.getAllByText("Psychological Science, 17", { selector: "i" }),
    ).toHaveLength(1);
  });

  it("uses the engine's real intervals and phrases feedback as strengths and improvement opportunities", async () => {
    render(await SciencePage());
    expect(document.body).toHaveTextContent(
      "si respondes bien, vuelve mañana, en 6 días y en unas dos semanas",
    );
    expect(document.body).not.toHaveTextContent("+3");
    expect(document.body).toHaveTextContent("Oportunidades de mejora");
    expect(document.body).not.toHaveTextContent(/tiempo de estudio/i);
  });

  it("closes with the sign-up action and the shared footer", async () => {
    render(await SciencePage());
    expect(
      screen.getByRole("heading", { name: "Todo esto, en tus páginas." }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Empieza gratis" }).at(-1),
    ).toHaveAttribute("href", "/register");
    expect(
      screen.getByRole("link", { name: "Ver cómo funciona" }),
    ).toHaveAttribute("href", "/#como-funciona");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("shows visitors the landing section links in the nav", async () => {
    session.user = null;
    render(await SciencePage());
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(
      within(nav).getByRole("link", { name: "Cómo funciona" }),
    ).toHaveAttribute("href", "/#como-funciona");
    expect(within(nav).queryByRole("link", { name: "Ir a la app" })).toBeNull();
  });

  it("gives a signed-in user an Ir a la app button instead of the section links", async () => {
    session.user = { id: "u1", email: "a@b.test" };
    render(await SciencePage());
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(
      within(nav).getByRole("link", { name: "Ir a la app" }),
    ).toHaveAttribute("href", "/inicio");
    expect(
      within(nav).queryByRole("link", { name: "Cómo funciona" }),
    ).toBeNull();
    session.user = null;
  });
});
