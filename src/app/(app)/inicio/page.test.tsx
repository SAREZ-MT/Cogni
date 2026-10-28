import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb, BreadcrumbProvider } from "../_components/breadcrumb";

const { getCurrentUser, getCurrentTimeZoneSetting } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getCurrentTimeZoneSetting: vi.fn(),
}));
vi.mock("@/modules/identity", () => ({
  getCurrentUser,
  getCurrentTimeZoneSetting,
}));

const { getDashboardTechniqueMetrics, getHomeWeakTopics } = vi.hoisted(() => ({
  getDashboardTechniqueMetrics: vi.fn(),
  getHomeWeakTopics: vi.fn(),
}));
vi.mock("@/modules/analytics", async () => ({
  ...(await import("@/modules/analytics/domain")),
  getDashboardTechniqueMetrics,
  getHomeWeakTopics,
}));

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
  COLOR_PALETTE: [
    "pink",
    "green",
    "yellow",
    "purple",
    "orange",
    "blue",
    "mint",
  ],
  // The per-card kebab menu needs server actions and the router; it is not
  // what this page-level test is about.
  NotebookCardActions: () => null,
  CreateNotebookTrigger: ({
    variant,
    label = "Nuevo cuaderno",
    tourId,
  }: {
    variant?: string;
    label?: string;
    tourId?: string;
  }) => (
    <button type="button" data-tour={tourId}>
      {variant === "tile" ? `${label} (tile)` : label}
    </button>
  ),
}));

const { getDueToday, getTechniqueOverview } = vi.hoisted(() => ({
  getDueToday: vi.fn(),
  getTechniqueOverview: vi.fn(),
}));
vi.mock("@/modules/scheduling", async () => ({
  ...(await import("@/modules/scheduling/domain")),
  getDueToday,
  getTechniqueOverview,
}));

type Kind = "flashcard" | "exam_question" | "recall_question";
interface TotalsInput {
  total: number;
  nextDueAt?: Date | null;
  pendingUnits?: number;
  doneUnits?: number;
}

// Technique overview with study units (pages) per technique; omitted
// fields read zero / null.
function overviewWith(totals: Partial<Record<Kind, TotalsInput>> = {}) {
  const totalsOf = (input: TotalsInput | undefined) => ({
    total: input?.total ?? 0,
    nextDueAt: input?.nextDueAt ?? null,
    pendingUnits: input?.pendingUnits ?? 0,
    doneUnits: input?.doneUnits ?? 0,
  });
  return {
    flashcard: totalsOf(totals.flashcard),
    exam_question: totalsOf(totals.exam_question),
    recall_question: totalsOf(totals.recall_question),
  };
}

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
    getDueToday.mockReset();
    getDueToday.mockResolvedValue({ ok: true, value: [] });
    getTechniqueOverview.mockReset();
    // One flashcard page reviewed today, nothing left due.
    getTechniqueOverview.mockResolvedValue({
      ok: true,
      value: overviewWith({ flashcard: { total: 5, doneUnits: 1 } }),
    });
    getCurrentTimeZoneSetting.mockReset();
    getCurrentTimeZoneSetting.mockResolvedValue({
      status: "ok",
      timeZone: "America/Bogota",
      chosen: true,
    });
    getDashboardTechniqueMetrics.mockReset();
    getDashboardTechniqueMetrics.mockImplementation(
      async (input: { fromDay: string; toDay: string }) => {
        const days: string[] = [];
        for (
          let t = Date.parse(`${input.fromDay}T00:00:00Z`);
          t < Date.parse(`${input.toDay}T00:00:00Z`);
          t += 86_400_000
        ) {
          days.push(new Date(t).toISOString().slice(0, 10));
        }
        const today = days[days.length - 1];
        return {
          ok: true,
          value: {
            today,
            overall: { streakDays: 3 },
            daily: days.map((day) => ({
              day,
              reviews: {
                flashcards: day === today ? 1 : 0,
                recall: 0,
                exam: 0,
              },
            })),
          },
        };
      },
    );
    getHomeWeakTopics.mockReset();
    getHomeWeakTopics.mockResolvedValue({ ok: true, value: [] });
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

    it("shows the H2 empty state instead of the metric cards", async () => {
      await renderHome();

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Tu inicio está vacío por ahora",
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Notas listas para repasar"),
      ).not.toBeInTheDocument();
    });

    it("offers the create-notebook CTA anchored for the tour", async () => {
      await renderHome();

      expect(
        screen.getByRole("button", { name: "Crea tu primer cuaderno" }),
      ).toHaveAttribute("data-tour", "crear-cuaderno");
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
        screen.getByRole("heading", { level: 1, name: "Hola de nuevo, Ana" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Cada repaso y sesión de estudio que haces hoy te ayudan a mejorar tu aprendizaje\./,
        ),
      ).toBeInTheDocument();
      // Today's date in the profile zone, e.g. "Sábado 18 de octubre".
      expect(
        screen.getByText(/^[A-ZÁÉ][a-záéíóú]+ \d{1,2} de [a-z]+$/),
      ).toBeInTheDocument();
    });

    it("reads the review streak of the last 7 local days in the profile zone", async () => {
      await renderHome();

      const input = getDashboardTechniqueMetrics.mock.calls[0]?.[0];
      expect(input).toMatchObject({ timeZone: "America/Bogota" });
      expect(input.toDay).toBe(
        // 7 days: [today - 6, today + 1).
        new Date(Date.parse(`${input.fromDay}T00:00:00Z`) + 7 * 86_400_000)
          .toISOString()
          .slice(0, 10),
      );
      expect(screen.getByText("3 días seguidos")).toBeInTheDocument();
      const week = screen.getByRole("list", { name: "Últimos 7 días" });
      expect(within(week).getAllByRole("listitem")).toHaveLength(7);
      expect(week).toHaveTextContent(/\(hoy\): con repasos/);
      expect(
        screen.getByText("Ya repasaste hoy. ¡Sigue así!"),
      ).toBeInTheDocument();
    });

    it("still greets when the streak cannot load", async () => {
      getDashboardTechniqueMetrics.mockResolvedValue({
        ok: false,
        error: { code: "UNEXPECTED", message: "x" },
      });

      await renderHome();

      expect(
        screen.getByText("No pudimos cargar tu racha."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 1, name: "Hola de nuevo, Ana" }),
      ).toBeInTheDocument();
    });

    it("links each technique card to its hub with today's progress in study units", async () => {
      // H2-T5i: a unit is one page × technique, so three exams due read
      // "0 de 3" however many questions each one holds.
      getTechniqueOverview.mockResolvedValue({
        ok: true,
        value: overviewWith({
          flashcard: { total: 40, pendingUnits: 2, doneUnits: 1 },
          recall_question: { total: 9, pendingUnits: 1 },
          exam_question: { total: 60, pendingUnits: 3 },
        }),
      });

      await renderHome();

      const flashcards = screen.getByRole("link", {
        name: "Flashcards: 1 de 3 repasos hechos hoy",
      });
      expect(flashcards).toHaveAttribute("href", "/flashcards");
      expect(flashcards).toHaveTextContent("33%");
      expect(
        screen.getByRole("link", {
          name: "Recordación activa: 0 de 1 repasos hechos hoy",
        }),
      ).toHaveAttribute("href", "/active-recall");
      expect(
        screen.getByRole("link", {
          name: "Exámenes: 0 de 3 repasos hechos hoy",
        }),
      ).toHaveAttribute("href", "/exams");
    });

    it("never counts individual reviews on the cards", async () => {
      // The streak metrics log 1 flashcard review today; the card only
      // reads the overview's units.
      getTechniqueOverview.mockResolvedValue({
        ok: true,
        value: overviewWith({ flashcard: { total: 20, pendingUnits: 1 } }),
      });

      await renderHome();

      expect(
        screen.getByRole("link", {
          name: "Flashcards: 0 de 1 repasos hechos hoy",
        }),
      ).toBeInTheDocument();
    });

    it("reads today's due items in the profile zone with the page's instant", async () => {
      await renderHome();

      // Reviews are due per local day: the read needs the zone and the
      // instant the page renders with, like the technique totals.
      expect(getDueToday).toHaveBeenCalledWith({
        timeZone: "America/Bogota",
        now: expect.any(Date),
      });
    });

    it("reads the technique totals in the profile zone with the page's instant", async () => {
      await renderHome();

      expect(getTechniqueOverview).toHaveBeenCalledWith({
        timeZone: "America/Bogota",
        now: expect.any(Date),
      });
    });

    it("tells done, idle and never-generated techniques apart", async () => {
      getTechniqueOverview.mockResolvedValue({
        ok: true,
        value: overviewWith({
          flashcard: { total: 5, doneUnits: 1 },
          recall_question: {
            total: 4,
            nextDueAt: new Date(Date.now() + 3 * 86_400_000),
          },
        }),
      });

      await renderHome();

      expect(
        screen.getByRole("link", {
          name: "Flashcards: al día, 1 repaso hecho hoy",
        }),
      ).toHaveTextContent("Al día");
      expect(
        screen.getByRole("link", {
          name: /^Recordación activa: sin repasos hoy, próximo repaso el [a-záéíóú]+ \d{1,2}$/,
        }),
      ).toHaveTextContent("Sin repasos hoy");
      expect(
        screen.getByRole("link", {
          name: "Exámenes: aún no generas contenido",
        }),
      ).toHaveTextContent("Genera desde una página");
    });

    it("shows every card as unavailable when the technique read fails, keeping the rows", async () => {
      getTechniqueOverview.mockRejectedValue(new Error("overview exploded"));

      await renderHome();

      expect(
        screen.getByRole("link", {
          name: "Flashcards: progreso no disponible",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Exámenes: progreso no disponible" }),
      ).toHaveTextContent("No pudimos cargar tu progreso");
      expect(
        screen.getByRole("heading", { level: 2, name: "Repasar hoy" }),
      ).toBeInTheDocument();
    });

    // User 2026-10-18: the cards get a visible heading, styled like
    // "Continúa donde lo dejaste", so progress reads apart from "Repasar hoy".
    it("titles the technique cards with a visible heading", async () => {
      await renderHome();

      const heading = screen.getByRole("heading", {
        level: 2,
        name: "Tu progreso de hoy",
      });
      expect(heading).not.toHaveClass("sr-only");
      expect(
        screen.getByRole("region", { name: "Tu progreso de hoy" }),
      ).toContainElement(screen.getByRole("link", { name: /^Flashcards: / }));
    });

    it("orders today's work first: cards, reviews, recent pages, weak topics", async () => {
      await renderHome();

      // DOM order is the stacked (below lg) order; on wide screens the grid
      // moves "Repasar hoy" into the right column.
      const cards = screen.getByRole("region", {
        name: "Tu progreso de hoy",
      });
      const review = screen.getByRole("region", { name: /^Repasar hoy$/ });
      const recent = screen.getByRole("region", {
        name: "Continúa donde lo dejaste",
      });
      const weak = screen.getByRole("region", { name: /Temas débiles/ });
      const follows = (a: Element, b: Element) =>
        Boolean(
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      expect(follows(cards, review)).toBe(true);
      expect(follows(review, recent)).toBe(true);
      expect(follows(recent, weak)).toBe(true);
    });

    it("lists the review rows as borderless list items in their card", async () => {
      getDueToday.mockResolvedValue({
        ok: true,
        value: [
          duePage("a", { flashcard: 2, exam_question: 0, recall_question: 0 }),
        ],
      });

      const { container } = await renderHome();

      expect(
        container.querySelector('[data-slot="review-row"]'),
      ).toHaveAttribute("data-layout", "tile");
    });

    it("continues where the user left off, below the reviews of the day", async () => {
      await renderHome();

      const recent = screen.getByRole("region", {
        name: "Continúa donde lo dejaste",
      });
      expect(
        within(recent).getByRole("link", {
          name: /^Abrir Mitocondria de Biología Celular, editada /,
        }),
      ).toHaveAttribute("href", "/notebooks/n1/pages/p1");
      const review = screen.getByRole("region", { name: /^Repasar hoy$/ });
      expect(
        review.compareDocumentPosition(recent) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("says no page was opened yet when there are no recent pages", async () => {
      getHomeOverview.mockResolvedValue({
        ...populatedOverview(),
        recentPages: [],
      });

      await renderHome();

      expect(
        screen.getByText("Aún no abriste ninguna página."),
      ).toBeInTheDocument();
    });

    // H2-T6 (user decision 2026-10-18): once an exam session of a page is
    // completed today, scheduling reports that page's exam as done and no
    // longer lists its exam questions, so card and rows agree.
    it("shows a completed exam as done on the card and lists no exam row for it", async () => {
      getTechniqueOverview.mockResolvedValue({
        ok: true,
        value: overviewWith({ exam_question: { total: 40, doneUnits: 1 } }),
      });
      getDueToday.mockResolvedValue({
        ok: true,
        value: [
          duePage("a", { flashcard: 2, exam_question: 0, recall_question: 0 }),
        ],
      });

      await renderHome();

      expect(
        screen.getByRole("link", {
          name: "Exámenes: al día, 1 repaso hecho hoy",
        }),
      ).toBeInTheDocument();
      const review = screen.getByRole("region", { name: /^Repasar hoy$/ });
      // One tile only: the page's flashcards.
      const links = within(review).getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAccessibleName(/flashcards/i);
    });

    it("lists one row per page and technique due, each opening its session", async () => {
      getDueToday.mockResolvedValue({
        ok: true,
        value: [
          duePage("a", { flashcard: 2, exam_question: 1, recall_question: 0 }),
        ],
      });

      await renderHome();

      expect(
        screen.getByRole("heading", { level: 2, name: "Repasar hoy" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", {
          name: "Repasar Flashcards de Página a: 2 pendientes",
        }),
      ).toHaveAttribute("href", "/flashcards/n1/a?repasar=1");
      expect(
        screen.getByRole("link", {
          name: "Repasar Examen de Página a: 1 pendiente",
        }),
      ).toHaveAttribute("href", "/exams/n1/a");
      // Each tile is one link (chevron, no button): page title over its
      // notebook; technique and count live in the icon and the link's
      // accessible name (user 2026-10-18).
      const review = screen.getByRole("region", { name: "Repasar hoy" });
      expect(
        within(review).getAllByText("Biología Celular").length,
      ).toBeGreaterThan(0);
      expect(within(review).queryByText(/pendientes?$/)).toBeNull();
      // No item total next to the heading; the line under it counts units
      // (one per row). No message at the bottom (user 2026-10-18).
      expect(
        within(review).getByText(
          "Los repasos programados para hoy que aún tienes pendientes. Elige uno y empieza.",
        ),
      ).toBeInTheDocument();
      expect(within(review).queryByText(/tu racha suma un día/)).toBeNull();
    });

    it("says nothing is due today and keeps the cards at zero", async () => {
      await renderHome();

      expect(
        screen.getByText("No tienes repasos pendientes hoy"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", {
          name: "Flashcards: al día, 1 repaso hecho hoy",
        }),
      ).toBeInTheDocument();
    });

    it("does not claim zero reviews when the due list cannot load", async () => {
      getDueToday.mockResolvedValue({
        ok: false,
        error: { code: "UNEXPECTED", message: "x" },
      });

      await renderHome();

      expect(
        screen.getByText(
          "No pudimos cargar tus repasos. Inténtalo de nuevo en un momento.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("No tienes repasos pendientes hoy"),
      ).not.toBeInTheDocument();
      // The cards read their own units, so they keep today's progress.
      expect(
        screen.getByRole("link", {
          name: "Flashcards: al día, 1 repaso hecho hoy",
        }),
      ).toBeInTheDocument();
    });

    // R3-home-due-promise-all: a thrown due read must degrade only the
    // due sections, exactly like the typed failure.
    it("degrades only the due sections when the due read throws", async () => {
      const failure = new Error("due read exploded");
      getDueToday.mockRejectedValue(failure);

      await renderHome();

      expect(
        screen.getByText(
          "No pudimos cargar tus repasos. Inténtalo de nuevo en un momento.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: "Temas débiles" }),
      ).toBeInTheDocument();
      // Next.js control-flow errors (redirect/notFound) are handed back to
      // the framework instead of being swallowed.
      expect(unstable_rethrow).toHaveBeenCalledWith(failure);
    });

    it("still fails Home when the overview read throws", async () => {
      getHomeOverview.mockRejectedValue(new Error("overview exploded"));

      await expect(renderHome()).rejects.toThrow("overview exploded");
    });

    it("lists the weak topics, each linking to its page", async () => {
      getHomeWeakTopics.mockResolvedValue({
        ok: true,
        value: [
          {
            pageId: "p1",
            pageTitle: "Mitocondria",
            notebookId: "n1",
            notebookTitle: "Biología Celular",
            notebookColor: "purple",
            accuracy: 0.42,
            attempts: 7,
          },
        ],
      });

      await renderHome();

      // Scoped: the page also shows under "Continúa donde lo dejaste".
      const weak = screen.getByRole("region", { name: /Temas débiles/ });
      const link = within(weak).getByRole("link", { name: /Mitocondria/ });
      expect(link).toHaveAttribute("href", "/notebooks/n1/pages/p1");
      expect(link).toHaveTextContent("42%");
      expect(link).toHaveTextContent("Biología Celular");
    });

    it("explains when there are no weak topics yet", async () => {
      await renderHome();

      expect(screen.getByText("Aún no hay temas débiles")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Aparecen cuando practiques recordación activa o exámenes.",
        ),
      ).toBeInTheDocument();
    });

    it("never shows the empty-state copy", async () => {
      await renderHome();

      expect(
        screen.queryByText("Tu inicio está vacío por ahora"),
      ).not.toBeInTheDocument();
    });
  });
});
