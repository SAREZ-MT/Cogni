import { randomUUID } from "node:crypto";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import {
  clickAndWaitForAction,
  createNotebookWithOpenPage,
} from "./helpers/notebooks";

// Phase 4 "Repasos de hoy" (documento-maestro §3.3, §3.5): the flashcards hub
// lists the pages with cards due now; "Repasar" opens that page's graded
// session, and once its cards are reviewed the page leaves the list.

// Optional: a directory to drop the screenshots in (visual check).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

test.describe("Repasos de hoy", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("lists a page with a due card, opens its session and drops it once reviewed", async ({
    page,
  }) => {
    // The e2e user is shared per worker, so other pages may be due too: the
    // row is found by this test's own notebook title.
    const notebookTitle = `Cuaderno hoy ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    await page.goto(`/flashcards/${notebookId}/${pageId}`);

    // A new card is due immediately (§6.1 defaults).
    await page.getByTestId("new-flashcard-button").click();
    const dialog = page.getByRole("dialog", { name: "Nueva tarjeta" });
    await dialog.getByLabel("Anverso").fill("¿Qué es la fotosíntesis?");
    await dialog.getByLabel("Reverso").fill("Luz en glucosa");
    await clickAndWaitForAction(
      page,
      dialog.getByRole("button", { name: "Guardar tarjeta" }),
      '"front"',
    );
    await expect(dialog).toBeHidden();

    await page.goto("/flashcards");
    const dueToday = page.getByTestId("due-today");
    await expect(
      dueToday.getByRole("heading", { name: "Repasos de hoy" }),
    ).toBeVisible();
    const row = dueToday
      .getByTestId("due-today-row")
      .filter({ hasText: notebookTitle });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("1 pendiente");
    await expect(
      page.getByRole("link", { name: new RegExp(`^${notebookTitle}`) }),
    ).toContainText("1 pendiente");
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
    await expect(page).toHaveURL(`/flashcards/${notebookId}/${pageId}`);
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

    // Graded "Bien": due tomorrow, so it leaves today's list.
    await page.goto("/flashcards");
    await expect(
      page.getByRole("link", { name: new RegExp(`^${notebookTitle}`) }),
    ).toContainText("al día");
    await expect(
      page.getByTestId("due-today-row").filter({ hasText: notebookTitle }),
    ).toHaveCount(0);
    if (SCREENSHOT_DIR) {
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/due-today-after-review.png`,
        fullPage: true,
      });
    }
  });
});
