import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// Phase 6 T5b "Crear examen" (user decision 2026-10-07): from the exams
// hub the student picks a notebook and a page, generates the exam with AI
// (fake provider, AI_PROVIDER_MODE=fake) and lands on the notebook's exams,
// where the page now shows; the hub lists the notebook as for any page
// with exam questions.

const SENTENCES = [
  "La mitocondria produce la mayor parte del ATP de la célula.",
  "La membrana interna forma pliegues llamados crestas mitocondriales.",
  "La matriz mitocondrial contiene enzimas del ciclo de Krebs.",
].join(" ");

// Optional: a directory to drop the screenshots in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
}

test.describe("Crear examen", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  // A test-scoped user: the fake AI daily limit is per owner.
  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("generates an AI exam for a chosen page from the hub and lists it", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const notebookTitle = `Cuaderno crear examen ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId] = new URL(page.url()).pathname.split("/");

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

    await page.goto("/exams");
    await expect(page.getByText("Aún no tienes exámenes")).toBeVisible();
    await expect(
      page.getByText(
        "Usa «Crear examen» para elegir una página y generar o escribir sus preguntas.",
      ),
    ).toBeVisible();
    // Only "Crear examen" in the header: the "Nuevo examen" quick start is gone.
    await expect(page.getByText("Nuevo examen")).toHaveCount(0);
    await shot(page, "exams-hub-empty-v2");
    await page.getByTestId("create-exam-button").click();

    const create = page.getByRole("dialog", { name: "Crear examen" });
    await create
      .getByRole("combobox", { name: "Cuaderno" })
      .selectOption({ label: notebookTitle });
    await expect(create.getByTestId("create-exam-submit")).toBeDisabled();
    await create
      .getByRole("combobox", { name: "Página" })
      .selectOption({ label: "Sin título" });
    await expect(
      create.getByRole("radio", { name: /Generar con IA/ }),
    ).toBeChecked();
    await expect(create.getByTestId("exam-count-value")).toHaveText("10");
    await shot(page, "exams-create-modal");
    await create.getByTestId("create-exam-submit").click();

    await expect(page).toHaveURL(`/exams/${notebookId}`, { timeout: 30000 });
    await expect(page.getByRole("link", { name: "Sin título" })).toBeVisible();
    await expect(page.getByText("10 preguntas · 0 intentos")).toBeVisible();

    await page.goto("/exams");
    await expect(
      page.getByRole("link", { name: new RegExp(notebookTitle) }),
    ).toBeVisible();
    await expect(page.getByText("Nuevo examen")).toHaveCount(0);
    await shot(page, "exams-hub-with-exams");
  });
});
