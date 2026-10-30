import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import { chooseOption } from "./helpers/select";
import { withStudyFiller } from "./helpers/study-text";

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
  await page.keyboard.type(withStudyFiller(FIRST));
  await waitForSaved(page);
}

// A new paragraph block after the existing text (a new line of plain text).
// The caret is put at the very end of the last paragraph through the DOM
// selection: a click lands mid-text and "ControlOrMeta+End" does not move it
// on macOS (Meta+End is no editing command there), so Enter used to split
// the first paragraph — editing it, which correctly made it new again.
async function addSecondParagraph(page: Page) {
  const last = editor(page).locator("p").last();
  await last.click();
  await last.evaluate((paragraph) => {
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  // ProseMirror reads the DOM selection on selectionchange.
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await page.keyboard.type(withStudyFiller(SECOND));
  // The first paragraph must stay as it was: an edit to it makes it new
  // again and it would be re-sent (correctly), breaking this spec's counts.
  await expect(editor(page).locator("p")).toHaveText([
    withStudyFiller(FIRST),
    withStudyFiller(SECOND),
  ]);
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
    // Four fake generations plus the edit page read.
    test.setTimeout(120_000);
    await createNotebookWithOpenPage(
      page,
      `Cuaderno incremental ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
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

    // A new paragraph: both generate again and add to what exists.
    await addSecondParagraph(page);
    await panel.getByTestId("generate-flashcards").click();
    await expect
      .poll(() => rowCount(cardsRow), { timeout: 30000 })
      .toBeGreaterThan(cards);
    await panel.getByTestId("generate-recall-questions").click();
    await expect
      .poll(() => rowCount(recallRow), { timeout: 30000 })
      .toBeGreaterThan(questions);
    await expect.poll(() => remainingToday(page)).toBe(start - 4);

    // The fake provider makes one card per sentence it is sent, from the
    // first one, up to the count the page's words allow (H14: the study
    // filler fills each paragraph, so a paragraph gives the full count). The
    // second generation was sent only the new paragraph: exactly one card
    // tells its first sentence, and the first paragraph's sentence is still
    // on one card only (re-sending the whole page would have repeated it
    // and never reached the second paragraph).
    const deckSize = await rowCount(cardsRow);
    await page.goto(`/flashcards/${notebookId}/${pageId}/editar`);
    const entries = page.getByTestId("item-editor-entry");
    await expect(entries).toHaveCount(deckSize);
    const backs = await entries
      .getByLabel("Reverso")
      .evaluateAll((fields) =>
        fields.map((field) => (field as HTMLTextAreaElement).value),
      );
    expect(backs.filter((back) => back === FIRST)).toHaveLength(1);
    expect(backs.filter((back) => back === SECOND)).toHaveLength(1);
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

    // The fake provider cycles over the sentences it is sent from the first
    // one, so each generation quotes its paragraph's own sentence once and
    // the study filler (H14) for the rest. The second generation was sent
    // only the new paragraph: one stem quotes each paragraph's sentence
    // (re-sending the whole page would have quoted the first one twice and
    // never the second).
    await page.goto(`/exams/${notebookId}/${pageId}/editar`);
    const rows = page.getByTestId("item-editor-entry");
    await expect(rows).toHaveCount(20);
    // The stems live in the edit page's fields (Phase 8 H18).
    const stems = await rows
      .getByLabel("Enunciado")
      .evaluateAll((fields) =>
        fields.map((field) => (field as HTMLTextAreaElement).value),
      );
    expect(
      stems.filter((stem) => stem.includes("«La mitocondria")),
    ).toHaveLength(1);
    expect(stems.filter((stem) => stem.includes("«El ribosoma"))).toHaveLength(
      1,
    );

    // "Crear examen" in AI mode says the same in the dialog.
    await page.goto("/exams");
    // The hub lists this page, so its grid's first tile opens the dialog
    // (Phase 8 H13: no header button).
    await page.getByTestId("create-exam-tile").click();
    const create = page.getByRole("dialog", { name: "Crear examen" });
    await chooseOption(create, "Cuaderno", notebookTitle);
    await chooseOption(create, "Página", "Sin título");
    await create.getByTestId("create-exam-submit").click();
    await expect(create.getByTestId("create-exam-notice")).toHaveText(
      NOTHING_NEW,
      { timeout: 30000 },
    );
    await expect(create).toBeVisible();
  });
});
