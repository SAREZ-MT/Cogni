import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// Phase 6 T5b (user decision 2026-10-06, NotebookLM Studio model): the
// "Técnicas de estudio" panel's cards only generate; each technique with
// content on the page gets one row under "Generado en esta página", and the
// row opens that technique's practice route. Runs against the fake AI
// provider (AI_PROVIDER_MODE=fake) and spends 3 of the 6 daily generations.

const SENTENCES = [
  "La mitocondria produce la mayor parte del ATP de la célula.",
  "La membrana interna forma pliegues llamados crestas mitocondriales.",
  "La matriz mitocondrial contiene enzimas del ciclo de Krebs.",
  "El ADN mitocondrial se hereda casi siempre por vía materna.",
].join(" ");

// Optional: a directory to drop the panel screenshots in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.waitForTimeout(300);
  await page.getByTestId("techniques-panel").screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
  });
}

test.describe("techniques panel generated list", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  // A test-scoped user: the fake AI daily limit (6 per owner, in server
  // memory) is not shared with the other AI-spending specs.
  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("generates each technique, lists its row and opens its practice route from it", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await createNotebookWithOpenPage(
      page,
      `Cuaderno técnicas ${randomUUID().slice(0, 8)}`,
    );
    const pageUrl = page.url();
    const [, , notebookId, , pageId] = new URL(pageUrl).pathname.split("/");

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
    await expect(panel.getByText("Técnicas de estudio")).toBeVisible();
    await expect(
      panel.getByText("Aún no generaste nada en esta página"),
    ).toBeVisible();
    await shot(page, "panel-empty");

    // Flashcards: generate → row → graded review of the page's deck.
    await panel.getByTestId("generate-flashcards").click();
    const deckRow = panel.getByTestId("generated-item-flashcards");
    await expect(deckRow).toContainText(/\d+ tarjetas?/, { timeout: 30000 });
    await shot(page, "panel-flashcards");
    await expect(deckRow).toHaveAttribute(
      "href",
      `/flashcards/${notebookId}/${pageId}?repasar=1`,
    );
    await deckRow.click();
    // The deck route starts the graded review at once and drops `?repasar`
    // from the URL, so a reload shows the deck.
    await expect(page.getByTestId("flashcard-player")).toBeVisible();
    await expect(page).toHaveURL(`/flashcards/${notebookId}/${pageId}`);

    // Recordación activa: generate → row → recall session.
    await page.goto(pageUrl);
    await panel.getByTestId("generate-recall-questions").click();
    const recallRow = panel.getByTestId("generated-item-active-recall");
    await expect(recallRow).toContainText("10 preguntas", { timeout: 30000 });
    await shot(page, "panel-recall");
    await recallRow.click();
    await expect(page).toHaveURL(`/active-recall/${notebookId}/${pageId}`);
    await expect(page.getByTestId("active-recall-session")).toBeVisible();

    // Examen: generate → row → the page's exam.
    await page.goto(pageUrl);
    await expect(deckRow).toBeVisible();
    await expect(recallRow).toBeVisible();
    await panel.getByTestId("generate-exam-questions").click();
    const examRow = panel.getByTestId("generated-item-exam");
    await expect(examRow).toContainText("10 preguntas", { timeout: 30000 });
    await expect(panel.getByTestId("generation-remaining")).toHaveText(
      "Te quedan 3 generaciones hoy",
    );
    await shot(page, "panel-all");
    await examRow.click();
    await expect(page).toHaveURL(`/exams/${notebookId}/${pageId}`);
    await expect(page.getByTestId("start-exam-button")).toBeVisible();
  });
});
