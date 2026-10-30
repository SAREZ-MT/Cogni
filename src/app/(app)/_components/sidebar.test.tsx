import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_COOKIE, Sidebar } from "./sidebar";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/inicio" } }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

const USER = { id: "user-1", email: "jane.doe@example.com" };

// Design pass 2 (odd/tasks, user decision "Sidebar = navigation only"):
// Sidebar no longer accepts `children`/`collapsedCreateAction` — the
// notebook/page tree moved off the sidebar entirely (now /notebooks and
// /notebooks/[id]), so the tests that exercised that slot were removed
// instead of adapted to a feature that no longer exists here.
describe("Sidebar", () => {
  beforeEach(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: cookieStore is missing in jsdom
    document.cookie = `${SIDEBAR_COOKIE}=; max-age=0; path=/`;
    pathname.current = "/inicio";
  });

  it("starts expanded and offers to collapse", () => {
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    const toggle = screen.getByRole("button", {
      name: "Contraer barra lateral",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("navigation", { name: "Barra lateral" }),
    ).toHaveAttribute("data-collapsed", "false");
  });

  it("collapses on click and persists the choice in a cookie", async () => {
    const user = userEvent.setup();
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    await user.click(
      screen.getByRole("button", { name: "Contraer barra lateral" }),
    );

    expect(
      screen.getByRole("button", { name: "Expandir barra lateral" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("navigation", { name: "Barra lateral" }),
    ).toHaveAttribute("data-collapsed", "true");
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=collapsed`);
  });

  it("respects the persisted collapsed state on first render", () => {
    render(<Sidebar initialCollapsed={true} user={USER} previewsEnabled />);

    expect(
      screen.getByRole("button", { name: "Expandir barra lateral" }),
    ).toBeInTheDocument();
  });

  it("always renders the Cogni logo in the header row", () => {
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: "Cogni" })).toBeInTheDocument();
  });

  it("renders the Menú principal, Técnicas and General sections with an active Inicio", () => {
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByText("Menú principal")).toBeInTheDocument();
    expect(screen.getByText("Técnicas")).toBeInTheDocument();
    // User decision 2026-10-17: the last section is "General"; the
    // "Configuración" name stays only on its nav item.
    expect(screen.getByText("General", { selector: "p" })).toBeInTheDocument();
    expect(
      screen.queryByText("Configuración", { selector: "p" }),
    ).not.toBeInTheDocument();

    // User decision 2026-10-17: "Inicio" no longer shows the "⌘ H" keycaps
    // (no shortcut was wired to them), so its name is exactly "Inicio".
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Phase 7 T1: the old disabled "Horarios" row is now the live
    // "Calendario" entry (tests below), so no "Horarios" row remains.
    expect(screen.queryByText("Horarios")).not.toBeInTheDocument();
  });

  // Flashcards runs on real data (Phase 3): a plain link to /flashcards
  // whatever the design-preview flag says.
  it("links the Flashcards nav item to /flashcards while previews are enabled", () => {
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: "Flashcards" })).toHaveAttribute(
      "href",
      "/flashcards",
    );
  });

  it.each([
    ["/flashcards/biologia-celular", "Flashcards", "yellow"],
    ["/active-recall/nb-1/pg-1", "Recordación activa", "green"],
    ["/exams/nb-1/pg-1", "Exámenes", "rose"],
  ])("highlights the active technique %s in its own colour", (path, label, tone) => {
    pathname.current = path;
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "data-tone",
      tone,
    );
  });

  it("keeps the neutral highlight for entries that are not techniques", () => {
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: /Inicio/ })).not.toHaveAttribute(
      "data-tone",
    );
  });

  it("marks Flashcards active on its own routes", () => {
    pathname.current = "/flashcards/biologia-celular";
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: "Flashcards" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps Flashcards a live link when previews are disabled (production)", () => {
    render(
      <Sidebar initialCollapsed={false} user={USER} previewsEnabled={false} />,
    );

    expect(screen.getByRole("link", { name: "Flashcards" })).toHaveAttribute(
      "href",
      "/flashcards",
    );
    expect(
      screen.getByText("Flashcards").closest("[aria-disabled]"),
    ).toBeNull();
  });

  // Active recall runs on real data (Phase 6 T7): a plain link to
  // /active-recall whatever the design-preview flag says, like Exámenes.
  it("links the Active recall nav item to /active-recall while previews are enabled", () => {
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(
      screen.getByRole("link", { name: "Recordación activa" }),
    ).toHaveAttribute("href", "/active-recall");
  });

  it("marks Active recall active on its own routes", () => {
    pathname.current = "/active-recall/biologia-celular/mitocondria";
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(
      screen.getByRole("link", { name: "Recordación activa" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("keeps Active recall a live link when previews are disabled (production)", () => {
    pathname.current = "/active-recall/biologia-celular";
    render(
      <Sidebar initialCollapsed={false} user={USER} previewsEnabled={false} />,
    );

    const link = screen.getByRole("link", { name: "Recordación activa" });
    expect(link).toHaveAttribute("href", "/active-recall");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByText("Recordación activa").closest("[aria-disabled]"),
    ).toBeNull();
  });

  // design pass 2: "Cuadernos" is now a plain nav item to /notebooks
  // (no longer a "/" href and no longer a tree section header).
  // Exams runs on real data (Phase 5 T9): a plain link to /exams whatever
  // the design-preview flag says, like Flashcards.
  it("links the Exámenes nav item to /exams while previews are enabled", () => {
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: "Exámenes" })).toHaveAttribute(
      "href",
      "/exams",
    );
  });

  it("marks Exámenes active on its own routes", () => {
    pathname.current = "/exams/nb-1/page-1/resultados";
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: "Exámenes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps Exámenes a live link when previews are disabled (production)", () => {
    render(
      <Sidebar initialCollapsed={false} user={USER} previewsEnabled={false} />,
    );

    expect(screen.getByRole("link", { name: "Exámenes" })).toHaveAttribute(
      "href",
      "/exams",
    );
    expect(screen.getByText("Exámenes").closest("[aria-disabled]")).toBeNull();
  });

  // Dashboard runs on real data since Phase 7 T4 (documento-maestro §3.6):
  // a plain link to /dashboard whatever the design-preview flag says,
  // active on its own routes.
  it("marks Dashboard active on its own routes", () => {
    pathname.current = "/dashboard";
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: "Progreso" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("links the Cuadernos nav item to /notebooks", () => {
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: "Cuadernos" })).toHaveAttribute(
      "href",
      "/notebooks",
    );
  });

  it("pins the user footer card at the bottom with the sign-out menu", async () => {
    const eventUser = userEvent.setup();
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByText("JD")).toBeInTheDocument();
    await eventUser.click(
      screen.getByRole("button", { name: "Opciones de la cuenta" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });

  // Calendario runs on real data (Phase 7 T1, documento-maestro §3.5): a
  // plain link to /calendario whatever the design-preview flag says, active
  // on its own routes.
  it("marks Calendario active on its own routes", () => {
    pathname.current = "/calendario";
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: "Calendario" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  // H2-T2: the product tour anchors on stable data-tour attributes, never on
  // classes or copy, in both the expanded and the collapsed sidebar.
  it.each([
    ["expanded", false],
    ["collapsed", true],
  ])("exposes the product tour anchors while %s", (_state, collapsed) => {
    const { container } = render(
      <Sidebar initialCollapsed={collapsed} user={USER} previewsEnabled />,
    );

    const cuadernos = container.querySelector('[data-tour="cuadernos"]');
    expect(cuadernos).toHaveAttribute("href", "/notebooks");
    // Step 4 highlights Progreso and Calendario together (user 2026-10-18).
    const avance = container.querySelector('[data-tour="avance"]');
    expect(
      Array.from(avance?.querySelectorAll("a") ?? []).map((link) =>
        link.getAttribute("href"),
      ),
    ).toEqual(["/dashboard", "/calendario"]);
    const tecnicas = container.querySelector('[data-tour="tecnicas"]');
    expect(
      Array.from(tecnicas?.querySelectorAll("a") ?? []).map((link) =>
        link.getAttribute("href"),
      ),
    ).toEqual(["/flashcards", "/active-recall", "/exams"]);
  });

  // Configuración is live since Phase 7 T2a (the time-zone setting).
  it("marks Configuración active on its own routes", () => {
    pathname.current = "/configuracion";
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  // Dashboard, Flashcards, Exámenes, Active recall and Calendario run on
  // real data.
  describe.each([
    ["enabled", true],
    ["disabled", false],
  ])("with design previews %s", (_state, previewsEnabled) => {
    it("links Dashboard to /dashboard as a live entry", () => {
      render(
        <Sidebar
          initialCollapsed={false}
          user={USER}
          previewsEnabled={previewsEnabled}
        />,
      );

      expect(screen.getByRole("link", { name: "Progreso" })).toHaveAttribute(
        "href",
        "/dashboard",
      );
      expect(
        screen.getByText("Progreso").closest("[aria-disabled]"),
      ).toBeNull();
    });

    it("links Calendario to /calendario as a live entry", () => {
      render(
        <Sidebar
          initialCollapsed={false}
          user={USER}
          previewsEnabled={previewsEnabled}
        />,
      );

      expect(screen.getByRole("link", { name: "Calendario" })).toHaveAttribute(
        "href",
        "/calendario",
      );
      expect(
        screen.getByText("Calendario").closest("[aria-disabled]"),
      ).toBeNull();
    });

    it("links Configuración to /configuracion as a live entry", () => {
      render(
        <Sidebar
          initialCollapsed={false}
          user={USER}
          previewsEnabled={previewsEnabled}
        />,
      );

      expect(
        screen.getByRole("link", { name: "Configuración" }),
      ).toHaveAttribute("href", "/configuracion");
      expect(
        screen
          .getByRole("link", { name: "Configuración" })
          .closest("[aria-disabled]"),
      ).toBeNull();
    });

    it("keeps the real routes (Inicio, Cuadernos) as links", () => {
      render(
        <Sidebar
          initialCollapsed={false}
          user={USER}
          previewsEnabled={previewsEnabled}
        />,
      );

      expect(screen.getByRole("link", { name: /Inicio/ })).toHaveAttribute(
        "href",
        "/inicio",
      );
      expect(screen.getByRole("link", { name: "Cuadernos" })).toHaveAttribute(
        "href",
        "/notebooks",
      );
    });
  });
});
