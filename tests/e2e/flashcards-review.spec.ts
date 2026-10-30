import { randomUUID } from "node:crypto";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { seedFlashcards } from "./helpers/flashcards";
import {
  clickAndWaitForAction,
  createNotebookWithOpenPage,
} from "./helpers/notebooks";

// Phase 4 review session (documento-maestro §3.3, §7.2): "Repasar" on a page
// deck plays its due cards, each answer is graded with the four SM-2
// buttons and persisted, and a graded card is no longer due.

// Optional: a directory to drop the player screenshots in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

test.describe("flashcard review session", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("reviews a due card with Bien and leaves the deck up to date", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno repaso ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await page.goto(`/flashcards/${notebookId}/${pageId}`);

    // A new card is due immediately (§6.1 defaults).
    // Cards are created by AI only (Phase 8 H13): seed one straight in.
    await seedFlashcards(pageId, [
      { front: "¿Qué produce la mitocondria?", back: "ATP" },
    ]);
    await page.reload();
    await expect(page.getByTestId("flip-card")).toHaveCount(1);

    await clickAndWaitForAction(
      page,
      page.getByTestId("start-review-button"),
      "pageId",
    );
    const player = page.getByTestId("flashcard-player");
    await expect(player).toBeVisible();
    await expect(player.getByText("Tarjeta 1 de 1")).toBeVisible();
    await expect(
      player.getByText("¿Qué produce la mitocondria?"),
    ).toBeVisible();

    await player.getByRole("button", { name: "Mostrar respuesta" }).click();
    // First review of a new card: every button schedules 1 day (§7.1).
    await expect(player.getByTestId("rate-good")).toContainText("1 día");
    if (SCREENSHOT_DIR) {
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/review-player.png` });
    }
    await clickAndWaitForAction(
      page,
      player.getByTestId("rate-good"),
      '"good"',
    );

    const summary = page.getByRole("dialog", { name: "¡Sesión completada!" });
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("1 tarjeta revisada");
    await expect(summary).toContainText("Nivel de dominio de la página");
    // §7.3: one item, 0.6 · 1/21 + 0.4 · 1 ≈ 0.43 → Consolidando.
    await expect(summary).toContainText("Consolidando");
    if (SCREENSHOT_DIR) {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/review-summary.png` });
    }

    await summary.getByRole("button", { name: "Volver al mazo" }).click();
    await expect(page.getByTestId("flashcard-player")).toHaveCount(0);
    await expect(page.getByTestId("flip-card")).toHaveCount(1);

    // The graded card is due tomorrow: nothing left to review today, even
    // after a reload (persisted, not local).
    await page.reload();
    await clickAndWaitForAction(
      page,
      page.getByTestId("start-review-button"),
      "pageId",
    );
    await expect(page.getByText("Estás al día")).toBeVisible();
    await expect(page.getByTestId("flashcard-player")).toHaveCount(0);
  });
});
