import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

async function selectBackwards(page: Page, characters: number) {
  for (let i = 0; i < characters; i += 1) {
    await page.keyboard.press("Shift+ArrowLeft");
  }
  // Chrome's selectionchange (which ProseMirror reads the selection from)
  // lands after the keys; the next key must not race it.
  await page.waitForTimeout(60);
}

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

    await selectBackwards(page, 6);
    await expect(toolbar).toBeVisible();
  });

  // E5: Notion's markdown shortcuts — `>` + space opens a toggle and `"` +
  // space a quote.
  test("'> ' opens a toggle and '\" ' opens a quote", async ({ page }) => {
    await createNotebookWithOpenPage(page, "Cuaderno atajos");

    const editable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await editable.click();
    await page.waitForTimeout(60);
    await page.keyboard.type("> Mi desplegable");
    await expect(editable.locator("[data-type='details']")).toBeVisible();
    await expect(editable.locator("summary")).toHaveText("Mi desplegable");
    await expect(editable.locator("blockquote")).toHaveCount(0);

    // Leave the toggle: click the trailing empty paragraph at the end.
    await editable.locator("> p").last().click();
    await page.waitForTimeout(60);
    await page.keyboard.type('" Una cita');
    await expect(editable.locator("blockquote")).toHaveText("Una cita");
  });

  // E6: the toolbar highlighter applies the last colour in one click, the
  // swatch row picks another, and Mod+Shift+H reuses it from the keyboard.
  test("highlights a selection in one click and with Mod+Shift+H", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(page, "Cuaderno resaltado");

    const editable = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"]');
    await editable.click();
    await page.waitForTimeout(60);
    await page.keyboard.type("Idea clave");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Otra idea");
    // Home/End do not move the caret on macOS: select with arrows instead.
    await selectBackwards(page, "Otra idea".length);

    await page.getByRole("button", { name: "Resaltar en amarillo" }).click();
    await expect(editable.locator("mark[data-color='yellow']")).toHaveText(
      "Otra idea",
    );

    await page
      .getByRole("button", { name: "Más colores de resaltado" })
      .click();
    await page.getByRole("button", { name: "Resaltar en azul" }).click();
    await expect(editable.locator("mark[data-color='blue']")).toHaveText(
      "Otra idea",
    );

    // Collapse to the start of "Otra idea", step back to the end of "Idea
    // clave" and select it.
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(60);
    await selectBackwards(page, "Idea clave".length);
    await page.keyboard.press("ControlOrMeta+Shift+H");
    await expect(editable.locator("mark[data-color='blue']")).toHaveCount(2);
  });
});
