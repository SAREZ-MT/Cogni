import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// Phase 5 T5 AI exam questions (documento-maestro §3.3 "generadas por IA"):
// the student writes a page, presses "Técnicas → Examen → Generar" with the
// default 10 questions and the page's "Preguntas" lists 10 AI questions, so
// the "needs 10 questions" note is gone. Runs against the fake AI provider
// (AI_PROVIDER_MODE=fake): deterministic questions derived from the text.

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
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
}

test.describe("exam questions generation", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  // A test-scoped user: the fake AI daily limit (6 per owner, in server
  // memory) would otherwise be shared with every AI-spending spec in the
  // worker and run out depending on spec order.
  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("generates 10 AI questions for a page and lists them in Preguntas", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno examen IA ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");

    // Generation reads the persisted page text: wait for the autosave.
    const editable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await editable.click();
    // Keys sent <15 ms after a click can precede Chrome's selectionchange.
    await page.waitForTimeout(100);
    await page.keyboard.type(SENTENCES);
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 15000,
    });

    const panel = page.getByTestId("techniques-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("exam-count-value")).toHaveText("10");
    await shot(page, "panel-before");

    await panel.getByTestId("generate-exam-questions").click();
    await expect(panel.getByTestId("exam-generation-notice")).toHaveText(
      "Se generaron 10 preguntas.",
      { timeout: 30000 },
    );
    await expect(panel.getByTestId("exam-generation-error")).toHaveCount(0);
    await expect(panel.getByTestId("generate-exam-questions")).toHaveText(
      "Generar",
    );
    await shot(page, "panel-after");

    await panel.getByTestId("exam-questions-link").click();
    await expect(page).toHaveURL(`/exams/${notebookId}/${pageId}/preguntas`);
    const rows = page.getByTestId("exam-question-row");
    await expect(rows).toHaveCount(10);
    await expect(rows.first()).toContainText("IA");
    // Listed in generation order.
    await expect(rows.first()).toContainText(
      "Pregunta 1: ¿qué afirma el texto sobre «La mitocondria produce la»?",
    );
    await expect(page.getByTestId("exam-questions-minimum")).toHaveCount(0);
    await shot(page, "preguntas");
  });
});
