import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedExamQuestions } from "./helpers/exam-questions";
import {
  clickAndWaitForAction,
  createNotebookWithOpenPage,
} from "./helpers/notebooks";

// A page's exam questions screen on real data (Phase 5 T4): questions are
// created by AI only (Phase 8 H13, user 2026-10-29), so the screen offers
// no "Nueva pregunta" and the question is seeded straight into the
// database; it is edited in place and retired after a confirmation, and
// every change survives a reload.

// Optional: a directory to drop the screenshots in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  // Let a dialog's open animation settle before capturing it.
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
}

test.describe("exam questions screen", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("offers no manual creation and edits and retires a seeded question", async ({
    page,
  }) => {
    const notebookTitle = `Cuaderno examen ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");

    // Opened by its URL: a page without questions has no AI exam yet.
    await page.goto(`/exams/${notebookId}/${pageId}/preguntas`);
    await expect(page).toHaveURL(`/exams/${notebookId}/${pageId}/preguntas`);
    await expect(
      page.getByText("Esta página aún no tiene preguntas"),
    ).toBeVisible();
    await expect(page.getByText("Nueva pregunta")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Generar desde la página" }),
    ).toHaveAttribute("href", `/notebooks/${notebookId}/pages/${pageId}`);
    await expect(page.getByTestId("exam-questions-minimum")).toContainText(
      "Genera 10 más",
    );

    await seedExamQuestions(pageId, [
      {
        stem: "¿Qué produce la mitocondria?",
        options: ["ADN", "ATP", "Lípidos", "Almidón"],
        correctIndex: 1,
        concept: "Función mitocondrial",
      },
    ]);
    await page.reload();
    const rows = page.getByTestId("exam-question-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("¿Qué produce la mitocondria?");
    await expect(rows.first()).toContainText("Concepto: Función mitocondrial");
    await expect(page.getByTestId("exam-questions-minimum")).toContainText(
      "Genera 9 más",
    );
    await expect(page.getByText("Nueva pregunta")).toHaveCount(0);
    await shot(page, "questions-list");

    // The hub and the notebook view now list the page: "Crear examen" is the
    // grid's first tile, never a header button (Phase 8 H13).
    for (const path of ["/exams", `/exams/${notebookId}`]) {
      await page.goto(path);
      await expect(page.getByTestId("create-exam-tile")).toBeVisible();
      await expect(page.getByTestId("create-exam-button")).toHaveCount(0);
    }
    await page.goto(`/exams/${notebookId}/${pageId}/preguntas`);

    // Edit in place.
    await rows.first().getByRole("button", { name: "Editar" }).click();
    const edit = page.getByRole("dialog", { name: "Editar pregunta" });
    await expect(edit.getByLabel("Enunciado")).toHaveValue(
      "¿Qué produce la mitocondria?",
    );
    await edit
      .getByLabel("Enunciado")
      .fill("¿Qué molécula energética produce la mitocondria?");
    await clickAndWaitForAction(
      page,
      edit.getByRole("button", { name: "Guardar cambios" }),
      "questionId",
    );
    await expect(edit).toBeHidden();
    await page.reload();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(
      "¿Qué molécula energética produce la mitocondria?",
    );

    // Retire, after confirming.
    await rows.first().getByRole("button", { name: "Retirar" }).click();
    const confirm = page.getByRole("dialog", {
      name: "¿Retirar esta pregunta?",
    });
    await expect(confirm).toBeVisible();
    await shot(page, "retire-confirmation");
    await clickAndWaitForAction(
      page,
      confirm.getByRole("button", { name: "Retirar", exact: true }),
      "questionId",
    );
    await expect(confirm).toBeHidden();
    await expect(rows).toHaveCount(0);
    await page.reload();
    await expect(rows).toHaveCount(0);
    await expect(
      page.getByText("Esta página aún no tiene preguntas"),
    ).toBeVisible();
  });
});
