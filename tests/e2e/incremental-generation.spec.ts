import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// Phase 6 T5c (user decision 2026-10-06): "Generar" only sends the page
// paragraphs a technique has not used yet. Unchanged page: no AI call, no
// generation spent, "No hay contenido nuevo para generar". A new paragraph:
// only it reaches the model. Runs against the fake AI provider
// (AI_PROVIDER_MODE=fake), whose exam stems quote the first words of each
// sentence it was sent, so the Preguntas screen shows what was sent.
// Needs migration 0013 (generation_fingerprints) on the target database.

const FIRST = "La mitocondria produce la mayor parte del ATP de la célula.";
const SECOND = "El ribosoma traduce el ARN mensajero en proteínas.";
const NOTHING_NEW = "No hay contenido nuevo para generar";

async function remainingToday(page: Page): Promise<number> {
  const text = await page.getByTestId("generation-remaining").innerText();
  const match = text.match(/(\d+)/);
  if (!match) throw new Error(`no counter in "${text}"`);
  return Number(match[1]);
}

async function rowCount(row: Locator): Promise<number> {
  const match = (await row.innerText()).match(/(\d+) (tarjeta|pregunta)/);
  return Number(match?.[1] ?? 0);
}

function editor(page: Page): Locator {
  return page.getByTestId("editor-mount").locator('[contenteditable="true"]');
}

async function waitForSaved(page: Page) {
  await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
    timeout: 15000,
  });
}

async function writeFirstParagraph(page: Page) {
  await editor(page).click();
  // Keys sent <15 ms after a click can precede Chrome's selectionchange.
  await page.waitForTimeout(100);
  await page.keyboard.type(FIRST);
  await waitForSaved(page);
}

// A new paragraph block after the existing text (a new line of plain text).
async function addSecondParagraph(page: Page) {
  await editor(page).click();
  await page.waitForTimeout(100);
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(SECOND);
  await waitForSaved(page);
}

test.describe("incremental generation", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  // A test-scoped user: the fake AI daily limit (6 per owner, in server
  // memory) is not shared with other specs.
  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("flashcards and active recall generate only from new paragraphs and say when nothing is new", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno incremental ${randomUUID().slice(0, 8)}`,
    );
    await writeFirstParagraph(page);
    const panel = page.getByTestId("techniques-panel");
    await expect(panel).toBeVisible();

    // First generation of each technique uses the whole page.
    const start = await remainingToday(page);
    await panel.getByTestId("generate-flashcards").click();
    const cardsRow = panel.getByTestId("generated-item-flashcards");
    await expect(cardsRow).toBeVisible({ timeout: 30000 });
    await panel.getByTestId("generate-recall-questions").click();
    const recallRow = panel.getByTestId("generated-item-active-recall");
    await expect(recallRow).toBeVisible({ timeout: 30000 });
    await expect.poll(() => remainingToday(page)).toBe(start - 2);
    const cards = await rowCount(cardsRow);
    const questions = await rowCount(recallRow);

    // Unchanged page: nothing is generated and no generation is spent.
    await panel.getByTestId("generate-flashcards").click();
    await expect(panel.getByTestId("generation-notice")).toHaveText(
      NOTHING_NEW,
      { timeout: 30000 },
    );
    await panel.getByTestId("generate-recall-questions").click();
    await expect(panel.getByTestId("recall-generation-notice")).toHaveText(
      NOTHING_NEW,
      { timeout: 30000 },
    );
    await expect(panel.getByTestId("generation-error")).toHaveCount(0);
    await expect(panel.getByTestId("recall-generation-error")).toHaveCount(0);
    expect(await remainingToday(page)).toBe(start - 2);
    expect(await rowCount(cardsRow)).toBe(cards);
    expect(await rowCount(recallRow)).toBe(questions);

    // A new paragraph: both generate again and add to what exists. The fake
    // provider makes one card per sentence it is sent, so exactly one new
    // card proves only the new one-sentence paragraph was sent.
    await addSecondParagraph(page);
    await panel.getByTestId("generate-flashcards").click();
    await expect
      .poll(() => rowCount(cardsRow), { timeout: 30000 })
      .toBe(cards + 1);
    await panel.getByTestId("generate-recall-questions").click();
    await expect
      .poll(() => rowCount(recallRow), { timeout: 30000 })
      .toBeGreaterThan(questions);
    await expect.poll(() => remainingToday(page)).toBe(start - 4);
  });

  test("exams send only the new paragraph, and Crear examen says when nothing is new", async ({
    page,
  }) => {
    const notebookTitle = `Cuaderno examen incremental ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await writeFirstParagraph(page);
    const panel = page.getByTestId("techniques-panel");

    async function generateExam() {
      await panel.getByTestId("generate-exam-questions").click();
      await page.getByTestId("confirm-exam-generation").click();
    }

    const start = await remainingToday(page);
    await generateExam();
    await expect(panel.getByTestId("exam-generation-notice")).toHaveText(
      "Se generaron 10 preguntas.",
      { timeout: 30000 },
    );

    await addSecondParagraph(page);
    await generateExam();
    await expect(panel.getByTestId("exam-generation-notice")).toHaveText(
      "Se generaron 10 preguntas.",
      { timeout: 30000 },
    );

    // Unchanged page: the panel says so and spends nothing.
    await generateExam();
    await expect(panel.getByTestId("exam-generation-notice")).toHaveText(
      NOTHING_NEW,
      { timeout: 30000 },
    );
    expect(await remainingToday(page)).toBe(start - 2);

    // The second generation was sent only the new paragraph: its ten stems
    // quote the second paragraph, the first ten the first one.
    await page.goto(`/exams/${notebookId}/${pageId}/preguntas`);
    const rows = page.getByTestId("exam-question-row");
    await expect(rows).toHaveCount(20);
    await expect(rows.filter({ hasText: "«La mitocondria" })).toHaveCount(10);
    await expect(rows.filter({ hasText: "«El ribosoma" })).toHaveCount(10);

    // "Crear examen" in AI mode says the same in the dialog.
    await page.goto("/exams");
    await page.getByTestId("create-exam-button").click();
    const create = page.getByRole("dialog", { name: "Crear examen" });
    await create
      .getByRole("combobox", { name: "Cuaderno" })
      .selectOption({ label: notebookTitle });
    await create
      .getByRole("combobox", { name: "Página" })
      .selectOption({ label: "Sin título" });
    await create.getByTestId("create-exam-submit").click();
    await expect(create.getByTestId("create-exam-notice")).toHaveText(
      NOTHING_NEW,
      { timeout: 30000 },
    );
    await expect(create).toBeVisible();
  });
});
