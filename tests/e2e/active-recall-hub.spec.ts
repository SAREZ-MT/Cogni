import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import postgres from "postgres";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import { withStudyFiller } from "./helpers/study-text";

// Phase 6 T7 (documento-maestro §3.3, §8.5): after a session the sidebar
// opens the active recall hub on real data, the notebook view lists the
// page with its latest session (date, questions, AI buckets, percentage),
// its card opens that past session's results, and a "No estoy de acuerdo"
// recorded there is still marked after a reload. With the fake provider
// (AI_PROVIDER_MODE=fake) a question built from a sentence has its first
// two word pairs as key concepts.

const SENTENCES = [
  "La mitocondria produce la mayor parte del ATP de la célula.",
  "La membrana interna forma pliegues llamados crestas mitocondriales.",
  "La matriz mitocondrial contiene enzimas del ciclo de Krebs.",
].join(" ");

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

async function stored(pageId: string) {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  try {
    const answers = await sql<{ disagreed: boolean }[]>`
      select a.disagreed from recall_answers a
      join recall_questions q on q.id = a.question_id
      where q.page_id = ${pageId}
      order by a.created_at, a.id
    `;
    const [mastery] = await sql<{ score: number }[]>`
      select score from page_mastery where page_id = ${pageId}
    `;
    const [due] = await sql<{ count: number }[]>`
      select count(*)::int as count from study_items
      where page_id = ${pageId} and kind = 'recall_question'
        and suspended_at is null and due_at <= now()
    `;
    return {
      disagreed: answers.map((a) => a.disagreed),
      masteryScore: mastery?.score ?? null,
      dueRecallQuestions: due?.count ?? 0,
    };
  } finally {
    await sql.end();
  }
}

// Moves every recall study item of the page to tomorrow, so none is due.
async function postponeRecallItems(pageId: string) {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  try {
    await sql`
      update study_items set due_at = now() + interval '1 day'
      where page_id = ${pageId} and kind = 'recall_question'
    `;
  } finally {
    await sql.end();
  }
}

async function answer(page: Page, text: string, rating: number) {
  await page.getByTestId("answer-textarea").click();
  // Keys sent <15 ms after a click can precede Chrome's selectionchange.
  await page.waitForTimeout(60);
  await page.keyboard.type(text);
  await page.getByRole("button", { name: /Calificar respuesta/ }).click();
  await page.getByTestId(`self-rate-${rating}`).click();
}

test.describe("active recall hub", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");
  test.skip(!process.env.DATABASE_URL, "needs DATABASE_URL (cogni-dev)");

  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("lists a finished session in the hub and notebook view and reopens its results", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const notebookTitle = `Cuaderno hub recordación ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    const editable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await editable.click();
    await page.waitForTimeout(100);
    await page.keyboard.type(withStudyFiller(SENTENCES));
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 15000,
    });
    // createNotebookWithOpenPage opens a new "Sin título" page.
    const pageTitle = "Sin título";

    // A new owner: the hub has no session yet.
    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await sidebar.getByRole("link", { name: "Recordación activa" }).click();
    await expect(page).toHaveURL(/\/active-recall$/);
    await expect(
      page.getByText("Practica explicando con tus palabras"),
    ).toBeVisible();
    await page.goBack();

    const panel = page.getByTestId("techniques-panel");
    await panel.getByTestId("generate-recall-questions").click();
    await expect(panel.getByTestId("recall-generation-notice")).toHaveText(
      "Se generaron 10 preguntas.",
      { timeout: 30000 },
    );
    await panel.getByTestId("generated-item-active-recall").click();
    await expect(page.getByText("Pregunta 1 de 10")).toBeVisible();

    // Q1: both key concepts → AI 5; self 1 → combined 3. Q2 skipped → AI
    // 0, combined 0. Q3: none → AI 0; self 5 → combined 2. Buckets 1 / 0 /
    // 2; percentage (3 + 0 + 2) / 3 × 20 = 33.
    await answer(page, "La mitocondria produce la mayor parte del ATP.", 1);
    await expect(page.getByText("Pregunta 2 de 10")).toBeVisible();
    await page.getByRole("button", { name: "Saltar" }).click();
    await expect(page.getByText("Pregunta 3 de 10")).toBeVisible();
    await answer(page, "No lo sé", 5);
    await expect(page.getByText("Pregunta 4 de 10")).toBeVisible();
    await page.getByRole("button", { name: /Terminar/ }).click();
    const banner = page.getByTestId("evaluation-status");
    await expect(banner).toHaveAttribute("data-tone", "success", {
      timeout: 30000,
    });

    // Hub (Phase 8 H17, flat): the page's card with its questions, its
    // session, the study-engine mastery with a bar, and — the page has
    // recall questions due today (the seven it did not show yet are new,
    // hence due) — the due pill and a filled Practicar.
    await sidebar.getByRole("link", { name: "Recordación activa" }).click();
    await expect(page).toHaveURL(/\/active-recall$/);
    await expect(
      sidebar.getByRole("link", { name: "Recordación activa" }),
    ).toHaveAttribute("aria-current", "page");
    const db = await stored(pageId as string);
    expect(db.dueRecallQuestions).toBeGreaterThan(0);
    const mastery = Math.round((db.masteryScore ?? 0) * 100);
    await expect(
      page.getByText("1 sesión · 1 página · 1 cuaderno"),
    ).toBeVisible();
    await expect(page.getByText(/dominio promedio/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Nueva sesión/ })).toHaveCount(
      0,
    );
    const pageCard = page
      .getByRole("article")
      .filter({ hasText: notebookTitle });
    await expect(pageCard).toContainText(pageTitle);
    await expect(pageCard).toContainText("10 preguntas");
    await expect(pageCard).toContainText(`1 sesión · dominio ${mastery} %`);
    await expect(pageCard).toContainText(
      `${db.dueRecallQuestions} para repasar`,
    );
    const practise = pageCard.getByRole("link", { name: /^Practicar/ });
    await expect(practise).toHaveAttribute("data-emphasis", "primary");
    await expect(practise).toHaveAttribute(
      "href",
      `/active-recall/${notebookId}/${pageId}?desde=hub`,
    );
    await shot(page, "hub");

    // Nothing due (every recall item pushed to tomorrow): no pill, soft.
    await postponeRecallItems(pageId as string);
    await page.reload();
    await expect(pageCard).not.toContainText("para repasar");
    await expect(practise).toHaveAttribute("data-emphasis", "soft");
    await shot(page, "hub-no-due");

    // The card's menu opens the latest session's results.
    await pageCard.getByRole("button", { name: /^Acciones de / }).click();
    await page.getByRole("menuitem", { name: "Ver último resultado" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/active-recall/${notebookId}/${pageId}/resultados\\?sesion=`),
    );
    const results = page.getByTestId("active-recall-results");
    await expect(results).toBeVisible();
    await expect(banner).toHaveAttribute("data-tone", "success", {
      timeout: 15000,
    });
    const items = page.getByTestId("question-feedback-item");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("IA 5 / 5");
    await expect(items.nth(1)).toContainText("Pregunta sin responder.");
    await expect(page.getByTestId("combined-quality")).toContainText("1,7 / 5");
    await shot(page, "past-results");

    // "No estoy de acuerdo", then a reload of the results route: still
    // marked (T6's deferred reload check).
    await items
      .nth(0)
      .getByRole("button", { name: "No estoy de acuerdo" })
      .click();
    await expect(
      items.nth(0).getByRole("button", { name: "Marcado como desacuerdo" }),
    ).toBeDisabled();
    await expect
      .poll(async () => (await stored(pageId as string)).disagreed[0], {
        timeout: 15000,
      })
      .toBe(true);
    await page.reload();
    await expect(banner).toHaveAttribute("data-tone", "success", {
      timeout: 15000,
    });
    const marked = items
      .nth(0)
      .getByRole("button", { name: "Marcado como desacuerdo" });
    await expect(marked).toBeVisible();
    await expect(marked).toBeDisabled();
    await expect(
      items.nth(1).getByRole("button", { name: "No estoy de acuerdo" }),
    ).toBeEnabled();
    await items.nth(0).scrollIntoViewIfNeeded();
    await shot(page, "past-results-disagreed-after-reload");

    // A malformed session id is a plain 404, never a server error.
    const malformed = await page.goto(
      `/active-recall/${notebookId}/${pageId}/resultados?sesion=not-a-uuid`,
    );
    expect(malformed?.status()).toBe(404);
    await expect(results).toHaveCount(0);
    await page.goBack();
    await expect(results).toBeVisible();

    // Every link out of the results resolves: "Todas las sesiones" back to
    // the hub filtered by the notebook (Phase 8 H17), "Nueva sesión →" to
    // the page's session.
    await page.getByRole("link", { name: /Todas las sesiones/ }).click();
    await expect(page).toHaveURL(`/active-recall?cuaderno=${notebookId}`);
    await expect(pageCard).toBeVisible();
    await page.goBack();
    await expect(results).toBeVisible();
    await page.getByRole("button", { name: /Nueva sesión/ }).click();
    await expect(page).toHaveURL(
      new RegExp(`/active-recall/${notebookId}/${pageId}$`),
    );
    await expect(page.getByText("Pregunta 1 de")).toBeVisible();
  });
});
