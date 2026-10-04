import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import {
  clickAndWaitForAction,
  createNotebookWithOpenPage,
} from "./helpers/notebooks";

// Phase 4 manual flashcards (documento-maestro §3.3 "creadas manualmente"):
// "Nueva tarjeta" lives on the page's deck, the first card starts the deck,
// and archiving refuses the deck's last card (a deck is never empty).

// Optional: a directory to drop the dialog screenshot in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function addCard(page: Page, front: string, back: string) {
  await page.getByTestId("new-flashcard-button").click();
  const dialog = page.getByRole("dialog", { name: "Nueva tarjeta" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Anverso").fill(front);
  await dialog.getByLabel("Reverso").fill(back);
  if (SCREENSHOT_DIR) {
    // Let the dialog's open animation settle before capturing it.
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/new-flashcard-dialog.png`,
    });
  }
  await clickAndWaitForAction(
    page,
    dialog.getByRole("button", { name: "Guardar tarjeta" }),
    '"front"',
  );
  await expect(dialog).toBeHidden();
}

async function archiveCard(page: Page, front: string) {
  await page
    .getByTestId("review-card")
    .filter({ hasText: front })
    .getByRole("button", { name: "Archivar tarjeta" })
    .click();
  const dialog = page.getByRole("dialog", { name: "¿Archivar esta tarjeta?" });
  await expect(dialog).toBeVisible();
  await clickAndWaitForAction(
    page,
    dialog.getByRole("button", { name: "Archivar", exact: true }),
    "flashcardId",
  );
  return dialog;
}

test.describe("manual flashcards", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("creates cards on a page deck and never archives its last card", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno manual ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");

    // A page without cards has no deck yet: the deck route offers the first.
    await page.goto(`/flashcards/${notebookId}/${pageId}`);
    await expect(
      page.getByText("Esta página aún no tiene tarjetas"),
    ).toBeVisible();

    await addCard(page, "¿Qué produce la mitocondria?", "ATP");
    await expect(page.getByTestId("flip-card")).toHaveCount(1);
    await expect(page.getByText("¿Qué produce la mitocondria?")).toBeVisible();
    await expect(page.getByText("1 tarjeta", { exact: true })).toBeVisible();

    // The only card cannot be archived: the deck would be empty.
    const refusal = await archiveCard(page, "¿Qué produce la mitocondria?");
    await expect(refusal.getByRole("alert")).toHaveText(
      "Un mazo siempre conserva al menos una tarjeta. Agrega otra antes de archivar esta.",
    );
    await refusal.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByTestId("flip-card")).toHaveCount(1);

    // With two cards, archiving one is allowed and it leaves the deck.
    await addCard(page, "¿Dónde ocurre el ciclo de Krebs?", "En la matriz");
    await expect(page.getByTestId("flip-card")).toHaveCount(2);
    if (SCREENSHOT_DIR) {
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/deck-page.png`,
        fullPage: true,
      });
    }
    const archived = await archiveCard(page, "¿Qué produce la mitocondria?");
    await expect(archived).toBeHidden();
    await expect(page.getByTestId("flip-card")).toHaveCount(1);
    await expect(page.getByText("¿Qué produce la mitocondria?")).toHaveCount(0);

    // The archived card stays gone after a reload (persisted, not local).
    await page.reload();
    await expect(page.getByTestId("flip-card")).toHaveCount(1);
    await expect(
      page.getByText("¿Dónde ocurre el ciclo de Krebs?"),
    ).toBeVisible();
  });
});
