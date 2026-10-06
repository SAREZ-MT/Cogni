import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// Phase 5 T8 (documento-maestro §3.3; user decisions 2026-10-05): a
// finished exam shows AI feedback that explains the failed questions with
// the page's content (fake AI provider, AI_PROVIDER_MODE=fake: its exam
// feedback lists "Repasa <concepto> en la página" per failed question). A
// failed result's "Repasar contenido" opens the notebook page, which lists
// the failed concepts with a "Repetir examen" action. After passing the
// retake (new feedback), a later pass shows the stored feedback of that
// pass again, labelled, without a new AI call.

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
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
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

async function answerSession(page: Page, wrong: (stem: string) => boolean) {
  for (let n = 1; n <= 10; n += 1) {
    await expect(page.getByTestId("exam-answer-reveal")).toHaveCount(0);
    const stem = await currentStem(page);
    if (wrong(stem)) await answerWrong(page);
    else await answerRight(page);
    await expect(page.getByTestId("exam-answer-reveal")).toBeVisible({
      timeout: 15000,
    });
    if (n < 10) await page.getByTestId("next-question-button").click();
  }
}

async function finish(page: Page, examHref: string) {
  await page.getByTestId("finish-exam-button").click();
  await expect(page).toHaveURL(new RegExp(`${examHref}/resultados\\?sesion=`), {
    timeout: 60000,
  });
}

function feedbackPanel(page: Page) {
  return page.getByRole("region", { name: "Retroalimentación con IA" });
}

test.describe("exam feedback and review before retaking", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  // A test-scoped user: AI-spending specs get their own fake daily limit.
  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("explains a failed exam, sends the student to review the page, and reuses the last pass's feedback", async ({
    page,
  }) => {
    test.setTimeout(360_000);
    await createNotebookWithOpenPage(
      page,
      `Cuaderno retroalimentación ${randomUUID().slice(0, 8)}`,
    );
    const pageUrl = new URL(page.url()).pathname;
    const [, , notebookId, , pageId] = pageUrl.split("/");
    const examHref = `/exams/${notebookId}/${pageId}`;

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
    await panel.getByTestId("generate-exam-questions").click();
    await expect(panel.getByTestId("exam-generation-notice")).toHaveText(
      "Se generaron 10 preguntas.",
      { timeout: 30000 },
    );
    // No retake pending yet: no review notice on the page.
    await expect(page.getByTestId("exam-review-notice")).toHaveCount(0);

    // 1. Fail the exam (questions 1-4 wrong): the results explain it.
    await panel.getByTestId("generated-item-exam").click();
    await expect(page).toHaveURL(examHref);
    await page.getByTestId("start-exam-button").click();
    await expect(page.getByTestId("exam-session")).toBeVisible({
      timeout: 15000,
    });
    await answerSession(page, (stem) =>
      WRONG_QUESTIONS.has(Number(/Pregunta (\d+):/.exec(stem)?.[1])),
    );
    await finish(page, examHref);
    await expect(page.getByTestId("exam-failed")).toBeVisible();
    const concepts = (
      await page.getByTestId("exam-failed-concepts").innerText()
    )
      .split("\n")
      .map((text) => text.trim())
      .filter(
        (text) =>
          text.length > 0 && text.toLowerCase() !== "conceptos a reforzar",
      );
    // The fake may give two failed questions one concept.
    expect(concepts.length).toBeGreaterThan(0);

    const feedback = feedbackPanel(page);
    await expect(feedback).toContainText("Resumen del examen de ejemplo", {
      timeout: 30000,
    });
    await expect(feedback).toHaveAttribute("aria-busy", "false");
    const errors = feedback.getByRole("list", {
      name: "Tus errores, explicados",
    });
    for (const concept of concepts) {
      await expect(errors).toContainText(`Repasa ${concept} en la página`);
    }
    await expect(page.getByTestId("exam-feedback-reused")).toHaveCount(0);
    await shot(page, "results-feedback-fail");

    // 2. "Repasar contenido" opens the page with the failed concepts.
    await page.getByRole("link", { name: "Repasar contenido" }).click();
    await expect(page).toHaveURL(`${pageUrl}?repaso=examen`);
    const notice = page.getByTestId("exam-review-notice");
    await expect(notice).toBeVisible({ timeout: 15000 });
    const listed = notice.getByRole("list", { name: "Conceptos fallados" });
    for (const concept of concepts) {
      await expect(listed).toContainText(concept);
    }
    await shot(page, "page-review-notice");

    // Derived from the data, not the query: the plain page shows it too.
    await page.goto(pageUrl);
    await expect(page.getByTestId("exam-review-notice")).toBeVisible({
      timeout: 15000,
    });

    // 3. "Repetir examen" reaches the retake start.
    await page.getByTestId("review-notice-retake-link").click();
    await expect(page).toHaveURL(examHref);
    await expect(page.getByTestId("exam-retake")).toContainText(
      "4 conceptos que fallaste",
    );
    await expect(page.getByTestId("start-exam-button")).toHaveCount(0);

    // 4. Pass the retake: the first pass gets new feedback.
    await page.getByTestId("retake-exam-button").click();
    await expect(page.getByTestId("exam-retake-label")).toBeVisible({
      timeout: 60000,
    });
    await answerSession(page, () => false);
    await finish(page, examHref);
    await expect(page.getByTestId("exam-passed")).toBeVisible();
    await expect(feedbackPanel(page)).toContainText(
      "Resumen del examen de ejemplo",
      { timeout: 30000 },
    );
    await expect(page.getByTestId("exam-feedback-reused")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Repasar contenido" }),
    ).toHaveCount(0);

    // The page has no pending retake any more: no notice.
    await page.goto(pageUrl);
    await expect(page.getByTestId("editor-mount")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("exam-review-notice")).toHaveCount(0);

    // 5. A later pass shows the last pass's feedback again, labelled.
    await page.goto(examHref);
    await page.getByTestId("start-exam-button").click();
    await expect(page.getByTestId("exam-session")).toBeVisible({
      timeout: 15000,
    });
    await answerSession(page, () => false);
    await finish(page, examHref);
    await expect(page.getByTestId("exam-passed")).toBeVisible();
    await expect(page.getByTestId("exam-feedback-reused")).toHaveText(
      "Retroalimentación de tu último examen aprobado",
      { timeout: 30000 },
    );
    await expect(feedbackPanel(page)).toContainText(
      "Resumen del examen de ejemplo",
    );
    await shot(page, "results-feedback-reused");
  });
});
