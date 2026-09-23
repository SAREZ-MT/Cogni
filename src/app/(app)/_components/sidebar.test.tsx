import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_COOKIE, Sidebar } from "./sidebar";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/" } }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

const USER = { id: "user-1", email: "jane.doe@example.com" };

describe("Sidebar", () => {
  beforeEach(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: cookieStore is missing in jsdom
    document.cookie = `${SIDEBAR_COOKIE}=; max-age=0; path=/`;
    pathname.current = "/";
  });

  it("starts expanded and offers to collapse", () => {
    render(
      <Sidebar initialCollapsed={false} user={USER}>
        contenido
      </Sidebar>,
    );

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
    render(
      <Sidebar initialCollapsed={false} user={USER}>
        contenido
      </Sidebar>,
    );

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
    render(
      <Sidebar initialCollapsed={true} user={USER}>
        contenido
      </Sidebar>,
    );

    expect(
      screen.getByRole("button", { name: "Expandir barra lateral" }),
    ).toBeInTheDocument();
  });

  it("hides the notebook tree slot while collapsed, without unmounting it", () => {
    render(
      <Sidebar initialCollapsed={true} user={USER}>
        contenido del árbol
      </Sidebar>,
    );

    const slot = screen.getByText("contenido del árbol");
    expect(slot).toBeInTheDocument();
    expect(slot).toHaveClass("hidden");
  });

  it("shows the notebook tree slot when expanded", () => {
    render(
      <Sidebar initialCollapsed={false} user={USER}>
        contenido del árbol
      </Sidebar>,
    );

    expect(screen.getByText("contenido del árbol")).not.toHaveClass("hidden");
  });

  it("always renders the Cogni logo in the header row", () => {
    render(
      <Sidebar initialCollapsed={false} user={USER}>
        contenido
      </Sidebar>,
    );

    expect(screen.getByRole("link", { name: "Cogni" })).toBeInTheDocument();
  });

  it("shows the collapsed create-notebook action only while collapsed", () => {
    const collapsedTrigger = <button type="button">Crear cuaderno</button>;

    const collapsedRender = render(
      <Sidebar
        initialCollapsed={true}
        collapsedCreateAction={collapsedTrigger}
        user={USER}
      >
        contenido
      </Sidebar>,
    );
    expect(
      within(collapsedRender.container).getByRole("button", {
        name: "Crear cuaderno",
      }),
    ).toBeInTheDocument();
    collapsedRender.unmount();

    const expandedRender = render(
      <Sidebar
        initialCollapsed={false}
        collapsedCreateAction={collapsedTrigger}
        user={USER}
      >
        contenido
      </Sidebar>,
    );
    expect(
      within(expandedRender.container).queryByRole("button", {
        name: "Crear cuaderno",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders the Menú principal, Técnicas and Cuenta sections with an active Inicio", () => {
    render(
      <Sidebar initialCollapsed={false} user={USER}>
        contenido
      </Sidebar>,
    );

    expect(screen.getByText("Menú principal")).toBeInTheDocument();
    expect(screen.getByText("Técnicas")).toBeInTheDocument();
    expect(screen.getByText("Cuenta")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Cuadernos" })).not.toHaveAttribute(
      "aria-current",
    );

    for (const label of [
      "Flashcards",
      "Active recall",
      "Exámenes",
      "Configuración",
    ]) {
      expect(
        screen.getByText(label).closest("[aria-disabled]"),
      ).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("marks Cuadernos active on a /notebooks/* route instead of Inicio", () => {
    pathname.current = "/notebooks/nb-1";

    render(
      <Sidebar initialCollapsed={false} user={USER}>
        contenido
      </Sidebar>,
    );

    expect(screen.getByRole("link", { name: "Cuadernos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("pins the user footer card at the bottom with the sign-out menu", async () => {
    const eventUser = userEvent.setup();
    render(
      <Sidebar initialCollapsed={false} user={USER}>
        contenido
      </Sidebar>,
    );

    expect(screen.getByText("JD")).toBeInTheDocument();
    await eventUser.click(
      screen.getByRole("button", { name: "Opciones de la cuenta" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });
});
