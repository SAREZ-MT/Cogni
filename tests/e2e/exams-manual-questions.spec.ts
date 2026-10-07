import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import {
  clickAndWaitForAction,
  createNotebookWithOpenPage,
} from "./helpers/notebooks";

// Phase 5 T4 manual exam questions (documento-maestro §3.3 "creadas
// manualmente"): Exámenes → "Crear examen" → "Crear mis preguntas" opens a
// page's questions screen on real data; a question is created, edited in place and
// retired after a confirmation, and every change survives a reload.

// Optional: a directory to drop the screenshots in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  // Let a dialog's open animation settle before capturing it.
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
}

test.describe("manual exam questions", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("creates, edits and retires a question of a page", async ({ page }) => {
    const notebookTitle = `Cuaderno examen ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");

    // Entry point: Exámenes → "Crear examen" → notebook + page → "Crear mis
    // preguntas" opens the page's questions screen (Phase 6 T5b).
    await page.goto("/exams");
    await page.getByTestId("create-exam-button").click();
    const create = page.getByRole("dialog", { name: "Crear examen" });
    await create
      .getByRole("combobox", { name: "Cuaderno" })
      .selectOption({ label: notebookTitle });
    await create
      .getByRole("combobox", { name: "Página" })
      .selectOption({ label: "Sin título" });
    await create.getByRole("radio", { name: /Crear mis preguntas/ }).click();
    await shot(page, "exams-create-modal-manual");
    await create.getByTestId("create-exam-submit").click();
    await expect(page).toHaveURL(`/exams/${notebookId}/${pageId}/preguntas`);
    await expect(
      page.getByText("Esta página aún no tiene preguntas"),
    ).toBeVisible();
    await expect(page.getByTestId("exam-questions-minimum")).toContainText(
      "Agrega 10 más",
    );

    // Create.
    await page.getByTestId("new-exam-question-button").click();
    const dialog = page.getByRole("dialog", { name: "Nueva pregunta" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Enunciado").fill("¿Qué produce la mitocondria?");
    for (const [letter, text] of [
      ["A", "ADN"],
      ["B", "ATP"],
      ["C", "Lípidos"],
      ["D", "Almidón"],
    ] as const) {
      await dialog.getByPlaceholder(`Opción ${letter}`).fill(text);
    }
    await dialog
      .getByRole("radio", { name: "Opción B es la correcta" })
      .check();
    await dialog.getByLabel("Concepto que evalúa").fill("Función mitocondrial");
    await shot(page, "new-question-dialog");
    await clickAndWaitForAction(
      page,
      dialog.getByRole("button", { name: "Guardar pregunta" }),
      '"concept"',
    );
    await expect(dialog).toBeHidden();
    const rows = page.getByTestId("exam-question-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("¿Qué produce la mitocondria?");
    await expect(rows.first()).toContainText("Concepto: Función mitocondrial");
    await expect(page.getByTestId("exam-questions-minimum")).toContainText(
      "Agrega 9 más",
    );
    await shot(page, "questions-list");

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
