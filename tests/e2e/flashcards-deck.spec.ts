import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedFlashcards } from "./helpers/flashcards";
import {
  clickAndWaitForAction,
  createNotebookWithOpenPage,
} from "./helpers/notebooks";

// A page's deck (Phase 4, documento-maestro §3.3): cards are created by AI
// only (Phase 8 H13, user 2026-10-29), so the deck offers no "Nueva
// tarjeta" and its cards are seeded straight into the database; archiving
// refuses the deck's last card (a deck is never empty).

// Optional: a directory to drop the deck screenshot in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

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

test.describe("flashcard deck", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("offers no manual creation and never archives a deck's last card", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno mazo ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");

    // A page without cards has no deck yet: the deck route sends it back to
    // the page's techniques panel to generate one.
    await page.goto(`/flashcards/${notebookId}/${pageId}`);
    await expect(
      page.getByText("Esta página aún no tiene tarjetas"),
    ).toBeVisible();
    await expect(page.getByText("Nueva tarjeta")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Generar desde la página" }),
    ).toHaveAttribute("href", `/notebooks/${notebookId}/pages/${pageId}`);

    await seedFlashcards(pageId, [
      { front: "¿Qué produce la mitocondria?", back: "ATP" },
    ]);
    await page.reload();
    await expect(page.getByTestId("flip-card")).toHaveCount(1);
    await expect(page.getByText("1 tarjeta", { exact: true })).toBeVisible();
    await expect(page.getByText("Nueva tarjeta")).toHaveCount(0);

    // The only card cannot be archived: the deck would be empty.
    const refusal = await archiveCard(page, "¿Qué produce la mitocondria?");
    await expect(refusal.getByRole("alert")).toHaveText(
      "Un mazo siempre conserva al menos una tarjeta. Genera más desde la página antes de archivar esta.",
    );
    await refusal.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByTestId("flip-card")).toHaveCount(1);

    // With two cards, archiving one is allowed and it leaves the deck.
    await seedFlashcards(pageId, [
      { front: "¿Dónde ocurre el ciclo de Krebs?", back: "En la matriz" },
    ]);
    await page.reload();
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
