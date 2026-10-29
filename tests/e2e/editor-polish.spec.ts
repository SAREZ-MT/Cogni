import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// H6 — editor polish (odd/tasks/phase-8-design-flows.md).

test.describe("editor polish", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  // E1: a new page used to open with an AllSelection over its empty
  // paragraph, which floated the formatting toolbar over an untouched page.
  test("the formatting toolbar stays hidden on a new page until text is selected", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(page, "Cuaderno toolbar");

    const editorMount = page.getByTestId("editor-mount");
    await expect(editorMount).toBeVisible();
    const editable = editorMount.locator('[contenteditable="true"]');
    await expect(editable).toBeVisible();
    // The bad selection showed only after the editor's first transactions
    // settled; a bare "hidden" check right after mount passes too early.
    const toolbar = page.getByTestId("bubble-toolbar");
    await page.waitForTimeout(1000);
    await expect(toolbar).toBeHidden();

    await editable.click();
    // Playwright click-then-type race: keys sent within ~15 ms of a click
    // land before Chrome's selectionchange.
    await page.waitForTimeout(60);
    await page.keyboard.type("Texto de prueba");
    await expect(toolbar).toBeHidden();

    await page.keyboard.press("Shift+Home");
    await expect(toolbar).toBeVisible();
  });
});
