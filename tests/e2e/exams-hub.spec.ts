import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { and, eq, gt } from "drizzle-orm";
import { studyItems } from "@/shared/db/schema";
import { createTestDb } from "../db/helpers/test-db";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// Phase 5 T9 exams hub on real data (documento-maestro §3.3, §7.5): a page
// with 10 fake AI questions shows up under its notebook in the hub opened
// from the sidebar; its card opens the exam; after failing it, the hub
// offers "Repetir examen" for that page and the notebook view marks it
// "Repetir pendiente".
//
// The fake provider's question N ("Pregunta N: …") has its correct option at
// index (N - 1) % 4, so the spec can choose right or wrong on purpose.

const SENTENCES = [
  "La mitocondria produce la mayor parte del ATP de la célula.",
  "La membrana interna forma pliegues llamados crestas mitocondriales.",
].join(" ");
const WRONG_QUESTIONS = new Set([1, 2, 3, 4]);

// Optional: a directory to drop the screenshots in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
}

// Creates a notebook with one page and 10 fake AI exam questions.
async function pageWithQuestions(
  page: Page,
  notebookTitle: string,
): Promise<{ notebookId: string; pageId: string }> {
  await createNotebookWithOpenPage(page, notebookTitle);
  const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
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
  // The count is chosen in the dialog (default 10).
  await page.getByTestId("confirm-exam-generation").click();
  await expect(panel.getByTestId("exam-generation-notice")).toHaveText(
    "Se generaron 10 preguntas.",
    { timeout: 30000 },
  );
  return { notebookId: notebookId as string, pageId: pageId as string };
}

// From the exam route's start screen: answers the questions in `wrong`
// wrong and the rest right, then finishes (the results route is open).
async function takeExam(page: Page, wrong: ReadonlySet<number>) {
  await page.getByTestId("start-exam-button").click();
  await expect(page.getByTestId("exam-session")).toBeVisible({
    timeout: 15000,
  });
  for (let n = 1; n <= 10; n += 1) {
    await expect(page.getByTestId("exam-answer-reveal")).toHaveCount(0);
    const stem = await page.getByTestId("exam-session").innerText();
    const number = Number(/Pregunta (\d+):/.exec(stem)?.[1]);
    expect(number).toBeGreaterThan(0);
    const correct = (number - 1) % 4;
    const choice = wrong.has(number) ? (correct + 1) % 4 : correct;
    await page
      .getByTestId("exam-options")
      .getByRole("button")
      .nth(choice)
      .click();
    await expect(page.getByTestId("exam-answer-reveal")).toBeVisible({
      timeout: 15000,
    });
    if (n < 10) await page.getByTestId("next-question-button").click();
  }
  await page.getByTestId("finish-exam-button").click();
  await expect(page).toHaveURL(/\/resultados\?sesion=/, { timeout: 60000 });
}

// Stands in for "the next day": the page's exam items scheduled after the
// exam (the wrong ones, q = 1, due a day later) become due now.
async function makeExamItemsDue(pageId: string) {
  const db = createTestDb();
  try {
    await db
      .update(studyItems)
      .set({ dueAt: new Date(Date.now() - 60_000) })
      .where(
        and(
          eq(studyItems.pageId, pageId),
          eq(studyItems.kind, "exam_question"),
          gt(studyItems.dueAt, new Date()),
          eq(studyItems.lastQuality, 1),
        ),
      );
  } finally {
    await db.$client.end();
  }
}

function sidebar(page: Page) {
  return page.getByRole("navigation", { name: "Barra lateral" });
}

test.describe("exams hub", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  // A test-scoped user: the hub must list only this test's notebook, and
  // the fake AI daily limit is per owner.
  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("opens a page's exam from the hub and offers its retake after failing", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const notebookTitle = `Cuaderno hub ${randomUUID().slice(0, 8)}`;

    // The empty hub first.
    await sidebar(page).getByRole("link", { name: "Exámenes" }).click();
    await expect(page).toHaveURL("/exams");
    await expect(page.getByText("Aún no tienes exámenes")).toBeVisible();
    await shot(page, "after-hub-empty");

    // A page with 10 generated questions.
    const { notebookId, pageId } = await pageWithQuestions(page, notebookTitle);

    // Sidebar → hub → notebook → page card → exam.
    await sidebar(page).getByRole("link", { name: "Exámenes" }).click();
    await expect(page).toHaveURL("/exams");
    await expect(
      sidebar(page).getByRole("link", { name: "Exámenes" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("0 exámenes · 1 cuaderno")).toBeVisible();
    await expect(page.getByText("0 exámenes · sin intentar")).toBeVisible();
    await shot(page, "after-hub-untried");
    await page.getByRole("link", { name: new RegExp(notebookTitle) }).click();
    await expect(page).toHaveURL(`/exams/${notebookId}`);
    await expect(
      page.getByText("0 exámenes · 1 página con preguntas"),
    ).toBeVisible();
    await expect(page.getByText("10 preguntas · 0 intentos")).toBeVisible();
    await expect(page.getByText("Sin intentar")).toBeVisible();
    await shot(page, "after-notebook-untried");
    await expect(page.getByText("Presentar examen →")).toBeVisible();
    // The whole card is the page title's (stretched) link.
    await page.getByRole("link", { name: "Sin título" }).click();
    await expect(page).toHaveURL(`/exams/${notebookId}/${pageId}`);

    // Fail it: 4 of 10 wrong.
    await takeExam(page, WRONG_QUESTIONS);

    // The hub now offers the retake of that page.
    await sidebar(page).getByRole("link", { name: "Exámenes" }).click();
    await expect(page).toHaveURL("/exams");
    await expect(
      page.getByText("Tienes 1 página pendiente de repetir examen"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Repetir examen" }),
    ).toHaveAttribute("href", `/exams/${notebookId}/${pageId}?retake=1`);
    await expect(page.getByText("1 examen presentado")).toBeVisible();
    await expect(page.getByText("1 pendiente de repetir")).toBeVisible();
    await expect(page.getByText("1 examen · última nota 60 %")).toBeVisible();
    await expect(page.getByText("Vista previa")).toHaveCount(0);
    await expect(
      page.getByText(
        "Fallaste el último examen de Sin título; las preguntas falladas vencen mañana.",
      ),
    ).toBeVisible();
    await shot(page, "after-hub-v2");

    await page.getByRole("link", { name: new RegExp(notebookTitle) }).click();
    await expect(page.getByText("Repetir pendiente")).toBeVisible();
    await expect(page.getByText("60 %")).toBeVisible();
    await expect(page.getByText("Repetir examen →")).toBeVisible();
    await expect(page.getByText("Vista previa")).toHaveCount(0);
    await shot(page, "after-notebook-v2");

    await page.getByRole("link", { name: "Sin título" }).click();
    await expect(page).toHaveURL(`/exams/${notebookId}/${pageId}?retake=1`);
    await expect(page.getByTestId("exam-retake")).toBeVisible();

    // The next day the failed questions are due: the banner says so.
    await makeExamItemsDue(pageId);
    await page.goto("/exams");
    await expect(
      page.getByText(
        "Fallaste el último examen de Sin título; las preguntas falladas ya están para repasar.",
      ),
    ).toBeVisible();
  });

  test("marks a passed page with exam questions due today", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const notebookTitle = `Cuaderno vence ${randomUUID().slice(0, 8)}`;
    const { notebookId, pageId } = await pageWithQuestions(page, notebookTitle);
    await page.goto(`/exams/${notebookId}/${pageId}`);
    // Pass it with 1 wrong (90 %): that question is due the next day.
    await takeExam(page, new Set([1]));
    await makeExamItemsDue(pageId);

    await sidebar(page).getByRole("link", { name: "Exámenes" }).click();
    await expect(page.getByText("1 aprobado")).toBeVisible();
    await page.getByRole("link", { name: new RegExp(notebookTitle) }).click();
    await expect(page).toHaveURL(`/exams/${notebookId}`);
    await expect(page.getByText("Vence hoy")).toBeVisible();
    await expect(page.getByText("Rendir examen →")).toBeVisible();
    await shot(page, "after-hub-due");
    await page.getByRole("link", { name: "Sin título" }).click();
    await expect(page).toHaveURL(`/exams/${notebookId}/${pageId}`);
    await expect(page.getByTestId("start-exam-button")).toBeVisible();
  });
});
