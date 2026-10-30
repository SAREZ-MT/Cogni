import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import { withStudyFiller } from "./helpers/study-text";

// Phase 5 T7 retake (documento-maestro §7.5, user decision 2026-10-05): a
// failed exam's "Repetir examen" generates one reformulated question per
// failed concept with the fake AI provider (AI_PROVIDER_MODE=fake): the
// retake starts with them — same concepts, never the failed wordings —
// followed by the rest of the page, and finishing it with every answer
// right passes and clears the page.
//
// The fake exam question N ("Pregunta N: … «short»?") has its correct
// option at index (N - 1) % 4; its wrong options and the fake variants'
// wrong options are fixed texts, so the spec picks right answers by text.

const SENTENCES = [
  "La mitocondria produce la mayor parte del ATP de la célula.",
  "La membrana interna forma pliegues llamados crestas mitocondriales.",
  "La matriz mitocondrial contiene enzimas del ciclo de Krebs.",
].join(" ");
const WRONG_QUESTIONS = new Set([1, 2, 3, 4]);
const WRONG_OPTION =
  /no menciona|no aparece en el texto|pertenece a otra materia|Ninguna de las otras opciones/;

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
}

async function currentStem(page: Page): Promise<string> {
  const text = await page.getByTestId("exam-session").innerText();
  const stem =
    /(Pregunta \d+: [^\n]*\?|Variante \d+ sobre «[^»]*»: [^\n]*\?)/.exec(
      text,
    )?.[1];
  expect(stem, "the current question's stem").toBeTruthy();
  return stem as string;
}

// Picks a right answer by its text (the fake's wrong options are fixed).
async function answerRight(page: Page) {
  const options = page.getByTestId("exam-options").getByRole("button");
  const count = await options.count();
  for (let i = 0; i < count; i += 1) {
    const text = await options.nth(i).innerText();
    if (!WRONG_OPTION.test(text)) {
      await options.nth(i).click();
      return;
    }
  }
  throw new Error("no right option found");
}

async function answerWrong(page: Page) {
  await page
    .getByTestId("exam-options")
    .getByRole("button")
    .filter({ hasText: WRONG_OPTION })
    .first()
    .click();
}

// Answers the open session's questions one by one: `wrong(stem)` decides
// which are answered wrong. Returns the stems in the order shown.
async function answerSession(
  page: Page,
  wrong: (stem: string) => boolean,
): Promise<string[]> {
  const stems: string[] = [];
  for (let n = 1; n <= 10; n += 1) {
    await expect(page.getByTestId("exam-answer-reveal")).toHaveCount(0);
    const stem = await currentStem(page);
    stems.push(stem);
    if (wrong(stem)) await answerWrong(page);
    else await answerRight(page);
    await expect(page.getByTestId("exam-answer-reveal")).toBeVisible({
      timeout: 15000,
    });
    if (n < 10) await page.getByTestId("next-question-button").click();
  }
  return stems;
}

test.describe("exam retake", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  // A test-scoped user: the fake AI daily limit (6 per owner, in server
  // memory) would otherwise be shared with every AI-spending spec in the
  // worker and run out depending on spec order.
  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("retakes a failed exam with reformulated questions about the failed concepts and passes it", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await createNotebookWithOpenPage(
      page,
      `Cuaderno repetición ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    const examHref = `/exams/${notebookId}/${pageId}`;

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
    await panel.getByTestId("generate-exam-questions").click();
    // The count is chosen in the dialog (default 10).
    await page.getByTestId("confirm-exam-generation").click();
    await expect(panel.getByTestId("exam-generation-notice")).toHaveText(
      "Se generaron 10 preguntas.",
      { timeout: 30000 },
    );

    // 1. Fail the exam: questions 1-4 wrong.
    await panel.getByTestId("generated-item-exam").click();
    await expect(page).toHaveURL(examHref);
    await page.getByTestId("start-exam-button").click();
    await expect(page.getByTestId("exam-session")).toBeVisible({
      timeout: 15000,
    });
    const firstStems = await answerSession(page, (stem) =>
      WRONG_QUESTIONS.has(Number(/Pregunta (\d+):/.exec(stem)?.[1])),
    );
    const failedStems = firstStems.filter((stem) =>
      WRONG_QUESTIONS.has(Number(/Pregunta (\d+):/.exec(stem)?.[1])),
    );
    expect(failedStems).toHaveLength(4);
    await page.getByTestId("finish-exam-button").click();
    await expect(page).toHaveURL(
      new RegExp(`${examHref}/resultados\\?sesion=`),
      { timeout: 60000 },
    );
    await expect(page.getByTestId("exam-failed")).toBeVisible();
    const failedConcepts = (
      await page.getByTestId("exam-failed-concepts").innerText()
    )
      .split("\n")
      .map((text) => text.trim())
      .filter(
        (text) =>
          text.length > 0 && text.toLowerCase() !== "conceptos a reforzar",
      );
    expect(failedConcepts.length).toBeGreaterThan(0);
    await shot(page, "results-fail-retake-enabled");

    // 2. "Repetir examen" → the retake start (N from 10), the normal
    // exam blocked.
    await page.getByTestId("retake-exam-link").click();
    await expect(page).toHaveURL(examHref);
    await expect(page.getByTestId("exam-retake")).toContainText(
      "4 conceptos que fallaste",
    );
    await expect(page.getByTestId("start-exam-button")).toHaveCount(0);
    await expect(page.getByTestId("retake-count-value")).toHaveText("10");
    await shot(page, "retake-start");
    await page.getByTestId("retake-exam-button").click();
    await expect(page.getByTestId("exam-retake-label")).toBeVisible({
      timeout: 60000,
    });
    await shot(page, "retake-player");

    // 3. The first 4 questions are new wordings of the failed concepts;
    // answer everything right.
    const retakeStems = await answerSession(page, () => false);
    const reformulated = retakeStems.slice(0, 4);
    for (const stem of reformulated) {
      expect(stem).toMatch(/^Variante \d+ sobre «/);
      expect(failedStems).not.toContain(stem);
      const concept = /«([^»]*)»/.exec(stem)?.[1] ?? "";
      expect(failedConcepts).toContain(concept);
    }
    for (const stem of retakeStems.slice(4)) {
      expect(stem).toMatch(/^Pregunta \d+:/);
      expect(failedStems).not.toContain(stem);
    }
    await shot(page, "retake-question-answered");

    // 4. Finish the retake: it passes and the page is clear again.
    await page.getByTestId("finish-exam-button").click();
    await expect(page).toHaveURL(
      new RegExp(`${examHref}/resultados\\?sesion=`),
      { timeout: 60000 },
    );
    await expect(page.getByTestId("exam-passed")).toBeVisible();
    await expect(page.getByTestId("exam-results")).toContainText("100%");
    await shot(page, "retake-results-pass");
    await page.goto(examHref);
    await expect(page.getByTestId("start-exam-button")).toBeVisible();
  });
});
