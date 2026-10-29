import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import { chooseOption } from "./helpers/select";
import { withStudyFiller } from "./helpers/study-text";

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
    await page.keyboard.type(withStudyFiller(SENTENCES));
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 15000,
    });

    await page.goto("/exams");
    await expect(page.getByText("Pon a prueba lo que sabes")).toBeVisible();
    await expect(
      page.getByText(
        "Elige una página y la IA crea un examen de opción múltiple desde su texto.",
      ),
    ).toBeVisible();
    // No "Nuevo examen" quick start, and since H13 no header button: the
    // empty state's CTA opens "Crear examen".
    await expect(page.getByText("Nuevo examen")).toHaveCount(0);
    await expect(page.getByTestId("create-exam-button")).toHaveCount(0);
    await shot(page, "exams-hub-empty-v2");
    await page.getByTestId("create-exam-cta").click();

    const create = page.getByRole("dialog", { name: "Crear examen" });
    await chooseOption(create, "Cuaderno", notebookTitle);
    await expect(create.getByTestId("create-exam-submit")).toBeDisabled();
    await chooseOption(create, "Página", "Sin título");
    // AI only (Phase 8 H12): no manual path in the dialog.
    await expect(create.getByRole("radio")).toHaveCount(0);
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
