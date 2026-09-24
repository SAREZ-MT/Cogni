import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_COOKIE, Sidebar } from "./sidebar";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/" } }));
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
    pathname.current = "/";
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

  it("renders the Menú principal, Técnicas and Configuración sections with an active Inicio", () => {
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByText("Menú principal")).toBeInTheDocument();
    expect(screen.getByText("Técnicas")).toBeInTheDocument();
    // "Configuración" is both the section label and its one (disabled) nav
    // item's label; scope to the label element specifically.
    expect(
      screen.getByText("Configuración", { selector: "p" }),
    ).toBeInTheDocument();

    // "Inicio"'s accessible name also includes its "⌘ H" shortcut keycap
    // (nav-item.tsx renders it whenever the row isn't collapsed, active or
    // not) — a substring match instead of the stale exact-"Inicio" one.
    expect(screen.getByRole("link", { name: /Inicio/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    for (const label of ["Exámenes"]) {
      expect(
        screen.getByText(label).closest("[aria-disabled]"),
      ).toHaveAttribute("aria-disabled", "true");
    }
  });

  // Flashcards is a design preview: a link to /flashcards while previews are
  // enabled, a disabled "pronto" row otherwise (its route 404s in production).
  it("links the Flashcards nav item to /flashcards while previews are enabled", () => {
    render(<Sidebar initialCollapsed={false} user={USER} previewsEnabled />);

    expect(screen.getByRole("link", { name: "Flashcards" })).toHaveAttribute(
      "href",
      "/flashcards",
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

  it("keeps Flashcards as a disabled 'pronto' row when previews are disabled", () => {
    render(
      <Sidebar initialCollapsed={false} user={USER} previewsEnabled={false} />,
    );

    expect(
      screen.queryByRole("link", { name: "Flashcards" }),
    ).not.toBeInTheDocument();
    const row = screen.getByText("Flashcards").closest("[aria-disabled]");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveTextContent("pronto");
  });

  // Active recall design preview (design/shell-look, 2026-09-24): same
  // treatment as Flashcards above — no longer disabled/"pronto" once the
  // preview screens exist at /active-recall.
  it("links the Active recall nav item to /active-recall", () => {
    render(<Sidebar initialCollapsed={false} user={USER} />);

    expect(screen.getByRole("link", { name: "Active recall" })).toHaveAttribute(
      "href",
      "/active-recall",
    );
  });

  // design pass 2: "Cuadernos" is now a plain nav item to /notebooks
  // (no longer a "/" href and no longer a tree section header).
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

  // Design previews (Dashboard, Flashcards, Active recall, Exámenes) are
  // sample-data screens whose routes ship in later slices; until then every
  // one of them is a disabled "pronto" row, whatever the server-computed
  // flag says, so a link never points at a missing route.
  describe.each([
    ["enabled", true],
    ["disabled", false],
  ])("with design previews %s", (_state, previewsEnabled) => {
    // Flashcards has a preview route now; its enabled/disabled states are
    // covered by the dedicated Flashcards tests above.
    it.each([
      "Dashboard",
      "Active recall",
      "Exámenes",
    ])("renders %s as a disabled 'pronto' row", (label) => {
      render(
        <Sidebar
          initialCollapsed={false}
          user={USER}
          previewsEnabled={previewsEnabled}
        />,
      );

      const row = screen.getByText(label).closest("[aria-disabled]");
      expect(row).toHaveAttribute("aria-disabled", "true");
      expect(row).toHaveTextContent("pronto");
      expect(
        screen.queryByRole("link", { name: new RegExp(label) }),
      ).not.toBeInTheDocument();
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
        "/",
      );
      expect(screen.getByRole("link", { name: "Cuadernos" })).toHaveAttribute(
        "href",
        "/notebooks",
      );
    });
  });
});
