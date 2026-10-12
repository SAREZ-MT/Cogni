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
const { redirect, unstable_rethrow } = vi.hoisted(() => ({
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect, unstable_rethrow }));

const { getHomeOverview } = vi.hoisted(() => ({ getHomeOverview: vi.fn() }));
vi.mock("@/modules/notebooks", () => ({
  getHomeOverview,
  // The per-card kebab menu needs server actions and the router; it is not
  // what this page-level test is about.
  NotebookCardActions: () => null,
  CreateNotebookTrigger: ({ variant }: { variant?: string }) => (
    <button type="button">
      {variant === "tile" ? "Nuevo cuaderno (tile)" : "Nuevo cuaderno"}
    </button>
  ),
}));

const { listDueTodayAction } = vi.hoisted(() => ({
  listDueTodayAction: vi.fn(),
}));
vi.mock("@/modules/scheduling", async () => ({
  ...(await import("@/modules/scheduling/domain")),
  listDueTodayAction,
}));

function duePage(
  pageId: string,
  due: { flashcard: number; exam_question: number; recall_question: number },
) {
  return {
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId: "n1",
    notebookTitle: "Biología Celular",
    notebookColor: "purple",
    due,
    earliestDueAt: new Date("2026-10-12T08:00:00.000Z"),
  };
}

function emptyOverview() {
  return {
    notebookCount: 0,
    pageCount: 0,
    pagesEditedThisWeek: 0,
    lastActivityAt: null,
    notebooks: [],
    recentPages: [],
    readyToReview: { items: [], totalReady: 0, totalRich: 0 },
    streak: { activeDays: 0, days: Array(14).fill(false) },
    weeklyGoal: { activeDays: 0, days: Array(7).fill(false), goal: 5 },
  };
}

const READY_PAGE = {
  id: "p1",
  notebookId: "n1",
  notebookTitle: "Biología Celular",
  notebookColor: "purple",
  title: "Mitocondria",
  updatedAt: new Date("2026-09-23T10:00:00.000Z"),
};

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
    recentPages: [READY_PAGE],
    readyToReview: { items: [READY_PAGE], totalReady: 1, totalRich: 4 },
    streak: {
      activeDays: 3,
      days: [...Array(11).fill(false), true, false, true],
    },
    weeklyGoal: {
      activeDays: 2,
      days: [false, false, false, false, false, true, true],
      goal: 5,
    },
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
    unstable_rethrow.mockReset();
    listDueTodayAction.mockReset();
    listDueTodayAction.mockResolvedValue({ ok: true, value: [] });
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

    it("greets the user by the name derived from their email", async () => {
      await renderHome();

      expect(
        screen.getByText(/^Buen(os días|as tardes|as noches), Ana$/),
      ).toBeInTheDocument();
    });

    it("shows the four study-metric cards with the values derived from the overview", async () => {
      await renderHome();

      // The ready-to-review label is also the heading of the panel below.
      expect(
        screen.getAllByText("Notas listas para repasar").length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Índice de constancia")).toBeInTheDocument();
      expect(screen.getByText("3/14 días")).toBeInTheDocument();
      expect(screen.getByText("Meta semanal de estudio")).toBeInTheDocument();
      expect(screen.getByText("meta: 5 días por semana")).toBeInTheDocument();
      expect(screen.getByText("Repasos pendientes hoy")).toBeInTheDocument();
    });

    it("points the ready-to-review card at the most urgent page", async () => {
      await renderHome();

      expect(
        screen.getByText("la más urgente: Mitocondria"),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Repasar →" })).toHaveAttribute(
        "href",
        "/notebooks/n1/pages/p1",
      );
    });

    it("says nothing is ready and offers no review link when no page qualifies", async () => {
      getHomeOverview.mockResolvedValue({
        ...populatedOverview(),
        readyToReview: { items: [], totalReady: 0, totalRich: 0 },
      });

      await renderHome();

      expect(
        screen.getByText("Ninguna nota lista todavía"),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Repasar →" }),
      ).not.toBeInTheDocument();
    });

    it("counts every technique's reviews due today and links to the calendar", async () => {
      listDueTodayAction.mockResolvedValue({
        ok: true,
        value: [
          duePage("a", { flashcard: 2, exam_question: 1, recall_question: 0 }),
          duePage("b", { flashcard: 0, exam_question: 0, recall_question: 3 }),
        ],
      });

      await renderHome();

      const card = screen.getByTestId("due-today-stat");
      expect(card).toHaveTextContent("6 repasos");
      expect(card).toHaveTextContent("en 2 páginas");
      expect(card).not.toHaveTextContent("Flashcards llegan pronto");
      expect(card).not.toHaveTextContent("pronto");
      expect(
        screen.getByRole("link", { name: "Ver calendario →" }),
      ).toHaveAttribute("href", "/calendario");
    });

    it("says nothing is due today when the list is empty", async () => {
      await renderHome();

      const card = screen.getByTestId("due-today-stat");
      expect(card).toHaveTextContent("0 repasos");
      expect(card).toHaveTextContent("Estás al día");
    });

    it("does not claim zero reviews when the due list cannot load", async () => {
      listDueTodayAction.mockResolvedValue({
        ok: false,
        error: { code: "UNEXPECTED", message: "x" },
      });

      await renderHome();

      const card = screen.getByTestId("due-today-stat");
      expect(card).toHaveTextContent("—");
      expect(card).toHaveTextContent("No pudimos cargar tus repasos");
      expect(card).not.toHaveTextContent("0 repasos");
    });

    // R3-home-due-promise-all: a thrown due read must degrade only the
    // "Repasos pendientes hoy" card, exactly like the typed failure.
    it("degrades only the due card when the due read throws", async () => {
      const failure = new Error("due read exploded");
      listDueTodayAction.mockRejectedValue(failure);

      await renderHome();

      const card = screen.getByTestId("due-today-stat");
      expect(card).toHaveTextContent("—");
      expect(card).toHaveTextContent("No pudimos cargar tus repasos");
      expect(screen.getByText("Mis cuadernos")).toBeInTheDocument();
      // Next.js control-flow errors (redirect/notFound) are handed back to
      // the framework instead of being swallowed.
      expect(unstable_rethrow).toHaveBeenCalledWith(failure);
    });

    it("still fails Home when the overview read throws", async () => {
      getHomeOverview.mockRejectedValue(new Error("overview exploded"));

      await expect(renderHome()).rejects.toThrow("overview exploded");
    });

    it("renders the notebook grid and the recent pages list from real data", async () => {
      await renderHome();

      expect(screen.getByText("Mis cuadernos")).toBeInTheDocument();
      const links = screen.getAllByRole("link");
      const notebookLink = links.find(
        (link) => link.getAttribute("href") === "/notebooks/n1",
      );
      // The same page is linked from the review card and the review panel
      // ("Repasar") as well as the recent-pages list (by title).
      const pageLink = links.find(
        (link) =>
          link.getAttribute("href") === "/notebooks/n1/pages/p1" &&
          link.textContent?.includes("Mitocondria"),
      );
      expect(notebookLink).toHaveTextContent("Biología Celular");
      expect(pageLink).toBeDefined();
    });

    it("never shows the empty-state copy", async () => {
      await renderHome();

      expect(
        screen.queryByText("Aún no tienes cuadernos. Crea uno para empezar."),
      ).not.toBeInTheDocument();
    });
  });
});
