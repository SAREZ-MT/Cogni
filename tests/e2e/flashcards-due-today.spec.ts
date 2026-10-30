import { randomUUID } from "node:crypto";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedFlashcards } from "./helpers/flashcards";
import {
  clickAndWaitForAction,
  createNotebookWithOpenPage,
} from "./helpers/notebooks";

// Phase 4 "Repasos de hoy" (documento-maestro §3.3, §3.5): the flashcards hub
// lists the pages with cards due now; "Repasar" opens that page's graded
// session, and once its cards are reviewed the page leaves the list.

// Optional: a directory to drop the screenshots in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

test.describe("Flashcards due today (PARA HOY)", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("lists a deck with a due card under PARA HOY, reviews it and moves it to AL DÍA", async ({
    page,
  }) => {
    // The e2e user is shared per worker, so other pages may be due too: the
    // row is found by this test's own notebook title.
    const notebookTitle = `Cuaderno hoy ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await page.goto(`/flashcards/${notebookId}/${pageId}`);

    // A new card is due immediately (§6.1 defaults).
    // Cards are created by AI only (Phase 8 H13): seed one straight in.
    await seedFlashcards(pageId, [
      { front: "¿Qué es la fotosíntesis?", back: "Luz en glucosa" },
    ]);

    // Phase 8 H17: the flat hub, filtered to this test's notebook (the
    // user is shared per worker), lists the deck under PARA HOY.
    await page.goto(`/flashcards?cuaderno=${notebookId}`);
    const dueGroup = page.getByRole("region", { name: /^Para hoy/ });
    const row = dueGroup
      .getByRole("article")
      .filter({ hasText: notebookTitle });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("1 para hoy");
    if (SCREENSHOT_DIR) {
      await page.waitForTimeout(600);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/due-today-hub.png`,
        fullPage: true,
      });
    }

    await row.getByRole("link", { name: /Repasar/ }).click();
    const player = page.getByTestId("flashcard-player");
    await expect(player).toBeVisible();
    // "Repasar" opens the review at once from the hub; the URL keeps the
    // hub marker and filter once `?repasar=1` is dropped.
    await expect(page).toHaveURL(
      `/flashcards/${notebookId}/${pageId}?desde=hub&cuaderno=${notebookId}`,
    );
    await expect(player.getByText("Tarjeta 1 de 1")).toBeVisible();
    await expect(player.getByText("¿Qué es la fotosíntesis?")).toBeVisible();

    await player.getByRole("button", { name: "Mostrar respuesta" }).click();
    await clickAndWaitForAction(
      page,
      player.getByTestId("rate-good"),
      '"good"',
    );
    const summary = page.getByRole("dialog", { name: "¡Sesión completada!" });
    await expect(summary).toBeVisible();
    await summary.getByRole("button", { name: "Volver al mazo" }).click();
    await expect(page.getByTestId("flashcard-player")).toHaveCount(0);

    // Graded "Bien": due tomorrow, so it moves to AL DÍA.
    await page.goto(`/flashcards?cuaderno=${notebookId}`);
    await expect(page.getByRole("region", { name: /^Para hoy/ })).toHaveCount(
      0,
    );
    const upToDate = page
      .getByRole("region", { name: /^Al día/ })
      .getByRole("article")
      .filter({ hasText: notebookTitle });
    await expect(upToDate).toContainText("Al día");
    await expect(upToDate).toContainText("repaso mañana");
    if (SCREENSHOT_DIR) {
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/due-today-after-review.png`,
        fullPage: true,
      });
    }
  });
});
