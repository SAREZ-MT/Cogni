import { randomUUID } from "node:crypto";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import { withStudyFiller } from "./helpers/study-text";

// Phase 8 V9: the browser back button restores the router's cached payload
// of a page, which predates the edits saved on that visit. Returning to a
// page must still show its latest saved content, and the techniques panel
// must count those words (H14's minimum keeps "Generar" enabled).

const SENTENCE = "La fotosíntesis convierte la luz en energía química.";

test.describe("page freshness after browser back", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, freshUser }) => {
    await signIn(page, freshUser);
  });

  test("going back to an edited page shows the saved text and its word count", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await createNotebookWithOpenPage(
      page,
      `Cuaderno volver ${randomUUID().slice(0, 8)}`,
    );
    const pageUrl = page.url();
    const editable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await editable.click();
    // Keys sent <15 ms after a click can precede Chrome's selectionchange.
    await page.waitForTimeout(100);
    await page.keyboard.type(withStudyFiller(SENTENCE));
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 15000,
    });

    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await sidebar.getByRole("link", { name: "Recordación activa" }).click();
    await expect(page).toHaveURL(/\/active-recall$/);
    await expect(
      page.getByText("Practica explicando con tus palabras"),
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(pageUrl);
    await expect(page.getByTestId("editor-mount")).toContainText(SENTENCE);
    const panel = page.getByTestId("techniques-panel");
    await expect(panel.getByTestId("generate-recall-questions")).toBeEnabled();
    await expect(panel.getByTestId("recall-generation-short")).toHaveCount(0);

    // A later edit on the restored page saves against the latest version
    // (no version conflict from the stale payload).
    await editable.click();
    await page.keyboard.press("End");
    await page.waitForTimeout(100);
    await page.keyboard.type(" Fin.");
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 15000,
    });
  });
});
