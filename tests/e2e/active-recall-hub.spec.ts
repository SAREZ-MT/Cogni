import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import postgres from "postgres";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

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

const SHORT_DATE = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

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
    await page.keyboard.type(SENTENCES);
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 15000,
    });
    // createNotebookWithOpenPage opens a new "Sin título" page.
    const pageTitle = "Sin título";

    // A new owner: the hub has no session yet.
    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await sidebar.getByRole("link", { name: "Active recall" }).click();
    await expect(page).toHaveURL(/\/active-recall$/);
    await expect(page.getByText("Sin sesiones todavía")).toBeVisible();
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

    // Hub: the notebook with its session, the study-engine mastery and a
    // quick start on the page, which has recall questions due today (the
    // seven it did not show yet are new, hence due).
    await sidebar.getByRole("link", { name: "Active recall" }).click();
    await expect(page).toHaveURL(/\/active-recall$/);
    await expect(
      sidebar.getByRole("link", { name: "Active recall" }),
    ).toHaveAttribute("aria-current", "page");
    const db = await stored(pageId as string);
    expect(db.dueRecallQuestions).toBeGreaterThan(0);
    await expect(page.getByText("1 sesión · 1 cuaderno")).toBeVisible();
    await expect(page.getByText("1 sesión guardada")).toBeVisible();
    await expect(
      page.getByText(
        `${Math.round((db.masteryScore ?? 0) * 100)} % dominio promedio`,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Nueva sesión/ }),
    ).toHaveAttribute("href", `/active-recall/${notebookId}/${pageId}`);
    const notebookCard = page.getByRole("link", {
      name: new RegExp(notebookTitle),
    });
    await expect(notebookCard).toContainText("1 sesión · último dominio 33 %");
    // The card's red due badge counts the notebook's recall questions due
    // today (user decision 2026-10-08).
    const dueBadge = notebookCard.locator("span.bg-error-500");
    await expect(dueBadge).toHaveText(String(db.dueRecallQuestions));
    await shot(page, "hub");
    await shot(page, "hub-due-badge");

    // Nothing due (every recall item pushed to tomorrow): no badge.
    await postponeRecallItems(pageId as string);
    await page.reload();
    await expect(notebookCard).toContainText("1 sesión · último dominio 33 %");
    await expect(dueBadge).toHaveCount(0);
    await shot(page, "hub-no-due-badge");

    // Notebook view: the page with its latest session.
    await notebookCard.click();
    await expect(page).toHaveURL(new RegExp(`/active-recall/${notebookId}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: notebookTitle }),
    ).toBeVisible();
    await expect(
      page.getByText("1 sesión · 1 página con preguntas"),
    ).toBeVisible();
    const pageCard = page.getByRole("link", { name: new RegExp(pageTitle) });
    await expect(pageCard).toContainText(SHORT_DATE.format(new Date()));
    await expect(pageCard).toContainText("3 preguntas · 1 sesión");
    await expect(pageCard).toContainText("Ver resultados →");
    await expect(pageCard).not.toContainText("Repasar");
    await expect(pageCard).toContainText("33%");
    await expect(pageCard).toContainText("1✓ · 0~ · 2✗");
    await shot(page, "notebook");
    await shot(page, "notebook-v2");

    // The card opens the past session's results.
    await pageCard.click();
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

    // Every link out of the results resolves: "Todas las sesiones" back to
    // the notebook view, "Nueva sesión →" to the page's session.
    await page.getByRole("link", { name: /Todas las sesiones/ }).click();
    await expect(page).toHaveURL(new RegExp(`/active-recall/${notebookId}$`));
    await expect(page.getByText("Sesiones por página")).toBeVisible();
    await page.goBack();
    await expect(results).toBeVisible();
    await page.getByRole("button", { name: /Nueva sesión/ }).click();
    await expect(page).toHaveURL(
      new RegExp(`/active-recall/${notebookId}/${pageId}$`),
    );
    await expect(page.getByText("Pregunta 1 de")).toBeVisible();
  });
});
