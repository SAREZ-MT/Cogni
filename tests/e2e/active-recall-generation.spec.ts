import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import postgres from "postgres";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import { withStudyFiller } from "./helpers/study-text";

// Phase 6 T4 AI recall questions (documento-maestro §3.3, §8.4
// generate_recall_questions): the student writes a page, presses "Técnicas
// → Active recall → Generar" and 10 open questions with their rubric are
// stored with one recall_question study item each, spending one generation
// of the daily limit. Runs against the fake AI provider
// (AI_PROVIDER_MODE=fake). The Active recall card shows in production since
// T5, so this spec runs with design previews off like every other one.

const SENTENCES = [
  "La mitocondria produce la mayor parte del ATP de la célula.",
  "La membrana interna forma pliegues llamados crestas mitocondriales.",
  "La matriz mitocondrial contiene enzimas del ciclo de Krebs.",
].join(" ");

// Optional: a directory to drop the screenshots in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.waitForTimeout(300);
  await page.getByTestId("techniques-panel").screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
  });
}

// Reads what the generation stored, straight from cogni-dev.
async function storedFor(pageId: string) {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  try {
    const questions = await sql<{ id: string; generation_id: string | null }[]>`
      select id, generation_id from recall_questions where page_id = ${pageId}
    `;
    const items = await sql<{ source_id: string }[]>`
      select source_id from study_items
      where page_id = ${pageId} and kind = 'recall_question'
    `;
    return { questions, items };
  } finally {
    await sql.end();
  }
}

test.describe("active recall questions generation", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");
  test.skip(!process.env.DATABASE_URL, "needs DATABASE_URL (cogni-dev)");

  // A test-scoped user: the fake AI daily limit (6 per owner, in server
  // memory) would otherwise be shared with every AI-spending spec in the
  // worker and run out depending on spec order.
  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("generates 10 AI recall questions for a page and stores them with their study items", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno recordación IA ${randomUUID().slice(0, 8)}`,
    );
    const [, , , , pageId] = new URL(page.url()).pathname.split("/");

    // Generation reads the persisted page text: wait for the autosave.
    const editable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await editable.click();
    // Keys sent <15 ms after a click can precede Chrome's selectionchange.
    await page.waitForTimeout(100);
    await page.keyboard.type(withStudyFiller(SENTENCES));
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 15000,
    });

    const panel = page.getByTestId("techniques-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("generation-remaining")).toHaveText(
      "Te quedan 6 generaciones hoy",
    );
    await shot(page, "panel-before");

    await panel.getByTestId("generate-recall-questions").click();
    await expect(panel.getByTestId("recall-generation-notice")).toHaveText(
      "Se generaron 10 preguntas.",
      { timeout: 30000 },
    );
    await expect(panel.getByTestId("recall-generation-error")).toHaveCount(0);
    await expect(panel.getByTestId("generate-recall-questions")).toHaveText(
      "Generar",
    );
    // One generation of the shared daily limit was spent.
    await expect(panel.getByTestId("generation-remaining")).toHaveText(
      "Te quedan 5 generaciones hoy",
    );
    await shot(page, "panel-after");

    const { questions, items } = await storedFor(pageId as string);
    expect(questions).toHaveLength(10);
    expect(questions.every((q) => q.generation_id !== null)).toBe(true);
    expect(items.map((i) => i.source_id).sort()).toEqual(
      questions.map((q) => q.id).sort(),
    );
  });
});
