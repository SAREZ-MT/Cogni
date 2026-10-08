import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import postgres from "postgres";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// Phase 6 done criterion (documento-maestro §13 Fase 6, §8.5; SRS CU-09
// alternate flow): a full session works even if a provider fails mid-way,
// and every answer keeps its raw evaluation. With the fake provider
// (AI_PROVIDER_MODE=fake) an answer holding "[falla-ia-una-vez]" fails on
// every provider the first time and succeeds on "Reintentar". The fake
// scores an answer by the rubric's key concepts it mentions; a question
// built from a sentence has its first two word pairs as key concepts.

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

interface StoredAnswer {
  question_id: string;
  evaluation_status: string;
  ai_evaluation: Record<string, unknown> | null;
  ai_score: number | null;
  combined_quality: number | null;
  disagreed: boolean;
}

async function storedFor(pageId: string) {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  try {
    const sessions = await sql<{ id: string; evaluation_status: string }[]>`
      select id, evaluation_status from recall_sessions where page_id = ${pageId}
    `;
    const answers = await sql<StoredAnswer[]>`
      select a.question_id, a.evaluation_status, a.ai_evaluation, a.ai_score,
        a.combined_quality, a.disagreed
      from recall_answers a join recall_questions q on q.id = a.question_id
      where q.page_id = ${pageId}
      order by a.created_at, a.id
    `;
    const logs = await sql<{ item_id: string; source_id: string }[]>`
      select l.item_id, i.source_id from review_logs l
      join study_items i on i.id = l.item_id
      where l.session_kind = 'recall' and i.page_id = ${pageId}
    `;
    const questions = await sql<{ id: string }[]>`
      select id from recall_questions where page_id = ${pageId}
      order by created_at, id
    `;
    return {
      sessions,
      answers,
      loggedQuestionIds: logs.map((l) => l.source_id).sort(),
      questionIds: questions.map((q) => q.id),
    };
  } finally {
    await sql.end();
  }
}

async function typeAnswer(page: Page, text: string) {
  await page.getByTestId("answer-textarea").click();
  // Keys sent <15 ms after a click can precede Chrome's selectionchange.
  await page.waitForTimeout(60);
  await page.keyboard.type(text);
}

async function answer(page: Page, text: string, rating: number) {
  await typeAnswer(page, text);
  await page.getByRole("button", { name: /Calificar respuesta/ }).click();
  await page.getByTestId(`self-rate-${rating}`).click();
}

test.describe("active recall evaluation", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");
  test.skip(!process.env.DATABASE_URL, "needs DATABASE_URL (cogni-dev)");

  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("evaluates a session with a provider failing mid-way and retries the failed answer", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await createNotebookWithOpenPage(
      page,
      `Cuaderno evaluación recordación ${randomUUID().slice(0, 8)}`,
    );
    const [, , , , pageId] = new URL(page.url()).pathname.split("/");
    const editable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await editable.click();
    await page.waitForTimeout(100);
    await page.keyboard.type(SENTENCES);
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 15000,
    });
    const panel = page.getByTestId("techniques-panel");
    await panel.getByTestId("generate-recall-questions").click();
    await expect(panel.getByTestId("recall-generation-notice")).toHaveText(
      "Se generaron 10 preguntas.",
      { timeout: 30000 },
    );
    await panel.getByTestId("generated-item-active-recall").click();
    await expect(page.getByText("Pregunta 1 de 10")).toBeVisible();

    // Q1 (key concepts "La mitocondria", "produce la"): both mentioned →
    // AI 5; self 1 → combined round(3 + 0.4) = 3, underconfident.
    await answer(page, "La mitocondria produce la mayor parte del ATP.", 1);
    // Q2 skipped → AI 0 without the model, combined 0.
    await expect(page.getByText("Pregunta 2 de 10")).toBeVisible();
    await page.getByRole("button", { name: "Saltar" }).click();
    // Q3: every provider fails the first time (unique text: the fake
    // remembers prompts per server process). After the retry: AI 0, self 5
    // → combined 2, overconfident.
    await expect(page.getByText("Pregunta 3 de 10")).toBeVisible();
    await answer(page, `No lo sé ${randomUUID()} [falla-ia-una-vez]`, 5);
    await expect(page.getByText("Pregunta 4 de 10")).toBeVisible();
    await page.getByRole("button", { name: /Terminar/ }).click();

    const results = page.getByTestId("active-recall-results");
    await expect(results).toBeVisible();
    await shot(page, "results-initial");
    const banner = page.getByTestId("evaluation-status");
    await expect(banner).toHaveAttribute("data-tone", "error", {
      timeout: 30000,
    });
    await expect(banner).toContainText("No pudimos evaluar algunas respuestas");
    await shot(page, "results-partial");

    const items = page.getByTestId("question-feedback-item");
    await expect(items.nth(0)).toContainText("IA 5 / 5");
    await expect(items.nth(0)).toContainText(
      "Mencionaste los 2 conceptos clave de la rúbrica.",
    );
    await expect(items.nth(1)).toContainText("IA 0 / 5");
    await expect(items.nth(1)).toContainText("Pregunta sin responder.");
    // The failed answer keeps waiting for its evaluation.
    await expect(items.nth(2)).toContainText("IA — / 5");
    await expect(items.nth(2)).toContainText(
      "Disponible cuando termine la evaluación",
    );
    // (3 + 0) / 2 = 1,5
    await expect(page.getByTestId("combined-quality")).toContainText("1,5 / 5");
    await expect(page.getByTestId("calibration-over")).toHaveText(
      "0 respuestas",
    );
    await expect(page.getByTestId("calibration-under")).toHaveText(
      "1 respuesta",
    );

    // Every answer keeps its raw evaluation; SM-2 only for done answers.
    const partial = await storedFor(pageId as string);
    const [q1, q2, q3] = partial.questionIds;
    expect(partial.sessions.map((s) => s.evaluation_status)).toEqual([
      "partial",
    ]);
    expect(
      partial.answers.map((a) => [a.evaluation_status, a.ai_score]),
    ).toEqual([
      ["done", 5],
      ["done", 0],
      ["failed", null],
    ]);
    expect(partial.answers[0]?.ai_evaluation).toMatchObject({
      score: 5,
      justification: "Mencionaste los 2 conceptos clave de la rúbrica.",
    });
    expect(partial.answers[1]?.ai_evaluation).toEqual({
      source: "skipped",
      score: 0,
      justification: "Pregunta sin responder.",
    });
    expect(partial.answers[2]?.ai_evaluation).toMatchObject({
      source: "failed",
      code: "AI_GENERATION_FAILED",
    });
    expect(partial.loggedQuestionIds).toEqual([q1, q2].sort());

    // "Reintentar" evaluates the failed answer.
    await banner.getByRole("button", { name: "Reintentar" }).click();
    await expect(banner).toHaveAttribute("data-tone", "success", {
      timeout: 30000,
    });
    await expect(banner).toContainText("Evaluación completa");
    await expect(items.nth(2)).toContainText("IA 0 / 5");
    // (3 + 0 + 2) / 3 = 1,7
    await expect(page.getByTestId("combined-quality")).toContainText("1,7 / 5");
    await expect(page.getByTestId("calibration-over")).toHaveText(
      "1 respuesta",
    );
    await shot(page, "results-done");
    await items.nth(0).scrollIntoViewIfNeeded();
    await shot(page, "results-feedback");

    // "No estoy de acuerdo" is recorded and never changes the score; the
    // same button turns into a disabled "Marcado como desacuerdo".
    await items
      .nth(0)
      .getByRole("button", { name: "No estoy de acuerdo" })
      .click();
    const marked = items
      .nth(0)
      .getByRole("button", { name: "Marcado como desacuerdo" });
    await expect(marked).toBeVisible();
    await expect(marked).toBeDisabled();
    await expect(
      items.nth(1).getByRole("button", { name: "No estoy de acuerdo" }),
    ).toBeEnabled();
    await items.nth(0).scrollIntoViewIfNeeded();
    await shot(page, "results-disagreed");
    await expect
      .poll(
        async () =>
          (await storedFor(pageId as string)).answers[0]?.disagreed ?? false,
        { timeout: 15000 },
      )
      .toBe(true);

    const done = await storedFor(pageId as string);
    expect(done.sessions.map((s) => s.evaluation_status)).toEqual(["done"]);
    expect(
      done.answers.map((a) => [
        a.evaluation_status,
        a.ai_score,
        a.combined_quality,
      ]),
    ).toEqual([
      ["done", 5, 3],
      ["done", 0, 0],
      ["done", 0, 2],
    ]);
    expect(done.answers[2]?.ai_evaluation).toMatchObject({ score: 0 });
    expect(done.loggedQuestionIds).toEqual([q1, q2, q3].sort());
  });
});
