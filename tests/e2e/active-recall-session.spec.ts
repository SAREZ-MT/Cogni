import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import postgres from "postgres";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// Phase 6 T5 active recall session on real data (documento-maestro §3.3,
// §8.5; RF-AR-02/03): after "Técnicas → Active recall → Generar" (fake AI
// provider, AI_PROVIDER_MODE=fake), the session route plays the page's
// questions; each answer is saved as it is given ("Calificar respuesta" +
// self-rating, or "Saltar"), and "Terminar" closes the session with the
// answered questions only. The results keep showing "Evaluando…" (the AI
// evaluation is T6). Runs with design previews off.

const SENTENCES = [
  "La mitocondria produce la mayor parte del ATP de la célula.",
  "La membrana interna forma pliegues llamados crestas mitocondriales.",
  "La matriz mitocondrial contiene enzimas del ciclo de Krebs.",
].join(" ");

// Optional: a directory to drop the screenshots in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string, fullPage = false) {
  if (!SCREENSHOT_DIR) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage });
}

interface StoredSession {
  id: string;
  finished_at: Date | null;
  evaluation_status: string;
}

interface StoredAnswer {
  question_id: string;
  answer_text: string;
  self_rating: number;
  evaluation_status: string;
}

// Reads the page's sessions and their answers straight from cogni-dev.
async function storedFor(pageId: string) {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  try {
    const sessions = await sql<StoredSession[]>`
      select id, finished_at, evaluation_status from recall_sessions
      where page_id = ${pageId}
    `;
    const answers = await sql<StoredAnswer[]>`
      select a.question_id, a.answer_text, a.self_rating, a.evaluation_status
      from recall_answers a join recall_questions q on q.id = a.question_id
      where q.page_id = ${pageId}
      order by a.created_at, a.id
    `;
    // A session of new questions shows them oldest first.
    const questions = await sql<{ id: string }[]>`
      select id from recall_questions where page_id = ${pageId}
      order by created_at, id
    `;
    return { sessions, answers, questionIds: questions.map((q) => q.id) };
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

test.describe("active recall session", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");
  test.skip(!process.env.DATABASE_URL, "needs DATABASE_URL (cogni-dev)");

  // A test-scoped user: the fake AI daily limit is per owner in server
  // memory, shared otherwise with every AI-spending spec in the worker.
  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("answers, skips and ends a session early, saving only the answered questions", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno sesión recordación ${randomUUID().slice(0, 8)}`,
    );
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
    const panel = page.getByTestId("techniques-panel");
    await panel.getByTestId("generate-recall-questions").click();
    await expect(panel.getByTestId("recall-generation-notice")).toHaveText(
      "Se generaron 10 preguntas.",
      { timeout: 30000 },
    );

    await page.goto(`/active-recall/${notebookId}/${pageId}`);
    await expect(page.getByTestId("active-recall-session")).toBeVisible();
    await expect(page.getByText("Pregunta 1 de 10")).toBeVisible();
    // Opening the route writes nothing.
    expect((await storedFor(pageId as string)).sessions).toEqual([]);
    await shot(page, "player-answer");

    await typeAnswer(page, "Produce ATP en las crestas.");
    await page.getByRole("button", { name: /Calificar respuesta/ }).click();
    await expect(page.getByText("Tu respuesta")).toBeVisible();
    await shot(page, "player-review");
    await page.getByTestId("self-rate-4").click();

    await expect(page.getByText("Pregunta 2 de 10")).toBeVisible();
    await page.getByRole("button", { name: "Saltar" }).click();

    await expect(page.getByText("Pregunta 3 de 10")).toBeVisible();
    await typeAnswer(page, "El ciclo de Krebs ocurre en la matriz.");
    await page.getByRole("button", { name: /Calificar respuesta/ }).click();
    await page.getByTestId("self-rate-2").click();
    await expect(page.getByText("Pregunta 4 de 10")).toBeVisible();

    await page.getByRole("button", { name: /Terminar/ }).click();
    const results = page.getByTestId("active-recall-results");
    await expect(results).toBeVisible();
    await expect(results).toContainText("3 preguntas respondidas");
    await expect(page.getByTestId("evaluation-status")).toContainText(
      "Evaluando tus respuestas…",
    );
    await shot(page, "results", true);

    // The saves and the finish run in the background: wait for the finish.
    await expect
      .poll(
        async () =>
          (await storedFor(pageId as string)).sessions[0]?.finished_at ?? null,
        { timeout: 20000 },
      )
      .not.toBeNull();
    const { sessions, answers, questionIds } = await storedFor(
      pageId as string,
    );
    const [first, second, third] = questionIds;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.evaluation_status).toBe("pending");
    // Unanswered questions (4–10) are not recorded.
    expect(
      answers.map((a) => [
        a.question_id,
        a.answer_text,
        a.self_rating,
        a.evaluation_status,
      ]),
    ).toEqual([
      [first, "Produce ATP en las crestas.", 4, "pending"],
      [second, "(sin respuesta)", 0, "pending"],
      [third, "El ciclo de Krebs ocurre en la matriz.", 2, "pending"],
    ]);
  });
});
