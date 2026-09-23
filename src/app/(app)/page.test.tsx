import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb, BreadcrumbProvider } from "./_components/breadcrumb";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));

// Defect: Home ran getCurrentUser and getHomeOverview in Promise.all, so a
// session that disappeared mid-request (e.g. sign-out) made
// getHomeOverview's requireOwnerId() throw instead of a clean redirect —
// the same guard layout.tsx already has.
const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const { getHomeOverview } = vi.hoisted(() => ({ getHomeOverview: vi.fn() }));
vi.mock("@/modules/notebooks", () => ({
  getHomeOverview,
  CreateNotebookTrigger: ({ variant }: { variant?: string }) => (
    <button type="button">
      {variant === "tile" ? "Nuevo cuaderno (tile)" : "Nuevo cuaderno"}
    </button>
  ),
}));

function emptyOverview() {
  return {
    notebookCount: 0,
    pageCount: 0,
    pagesEditedThisWeek: 0,
    lastActivityAt: null,
    notebooks: [],
    recentPages: [],
  };
}

function populatedOverview() {
  return {
    notebookCount: 1,
    pageCount: 3,
    pagesEditedThisWeek: 2,
    lastActivityAt: new Date("2026-09-23T10:00:00.000Z"),
    notebooks: [
      {
        id: "n1",
        title: "Biología Celular",
        icon: null,
        color: "purple",
        pageCount: 3,
        updatedAt: new Date("2026-09-23T10:00:00.000Z"),
      },
    ],
    recentPages: [
      {
        id: "p1",
        notebookId: "n1",
        notebookTitle: "Biología Celular",
        title: "Mitocondria",
        updatedAt: new Date("2026-09-23T10:00:00.000Z"),
      },
    ],
  };
}

async function renderHome() {
  const { default: HomePage } = await import("./page");
  const element = (await HomePage()) as ReactElement;
  return render(element);
}

describe("HomePage", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "ana@example.com",
    });
    getHomeOverview.mockReset();
    redirect.mockReset();
  });

  describe("without a session", () => {
    beforeEach(() => {
      getCurrentUser.mockReset();
      getCurrentUser.mockResolvedValue(null);
    });

    it("redirects to /login without calling getHomeOverview", async () => {
      const { default: HomePage } = await import("./page");
      await HomePage();

      expect(redirect).toHaveBeenCalledWith("/login");
      expect(getHomeOverview).not.toHaveBeenCalled();
    });
  });

  describe("empty state (no notebooks)", () => {
    beforeEach(() => {
      getHomeOverview.mockResolvedValue(emptyOverview());
    });

    it("shows the encouraging empty-state copy in Spanish", async () => {
      await renderHome();

      expect(
        screen.getByText("Aún no tienes cuadernos. Crea uno para empezar."),
      ).toBeInTheDocument();
    });

    it("offers the create-notebook CTA", async () => {
      await renderHome();

      expect(
        screen.getByRole("button", { name: "Nuevo cuaderno" }),
      ).toBeInTheDocument();
    });

    it("does not expose any product feature link", async () => {
      await renderHome();

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("publishes 'Inicio' as the breadcrumb trail", async () => {
      const { default: HomePage } = await import("./page");
      const element = (await HomePage()) as ReactElement;
      render(
        <BreadcrumbProvider>
          {element}
          <Breadcrumb />
        </BreadcrumbProvider>,
      );

      expect(screen.getByText("Cogni")).toBeInTheDocument();
      expect(screen.getByText("Inicio")).toBeInTheDocument();
    });
  });

  describe("populated state (real notebooks/pages)", () => {
    beforeEach(() => {
      getHomeOverview.mockResolvedValue(populatedOverview());
    });

    it("greets the user and shows the four real stats", async () => {
      await renderHome();

      expect(
        screen.getByText(/^Buen(os días|as tardes|as noches), Ana$/),
      ).toBeInTheDocument();
      expect(screen.getByText("Cuadernos")).toBeInTheDocument();
      expect(screen.getByText("Páginas")).toBeInTheDocument();
      expect(screen.getByText("Editadas esta semana")).toBeInTheDocument();
      expect(screen.getByText("Última actividad")).toBeInTheDocument();
    });

    it("renders the notebook grid and the recent pages list from real data", async () => {
      await renderHome();

      expect(screen.getByText("Mis cuadernos")).toBeInTheDocument();
      const links = screen.getAllByRole("link");
      const notebookLink = links.find(
        (link) => link.getAttribute("href") === "/notebooks/n1",
      );
      const pageLink = links.find(
        (link) => link.getAttribute("href") === "/notebooks/n1/pages/p1",
      );
      expect(notebookLink).toHaveTextContent("Biología Celular");
      expect(pageLink).toHaveTextContent("Mitocondria");
    });

    it("never shows the empty-state copy", async () => {
      await renderHome();

      expect(
        screen.queryByText("Aún no tienes cuadernos. Crea uno para empezar."),
      ).not.toBeInTheDocument();
    });
  });
});
