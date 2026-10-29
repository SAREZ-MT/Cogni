import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// H7 — editor polish round 2 (odd/tasks/phase-8-design-flows.md): formulas,
// the "Texto" font menu and the page's undo/redo arrows.

async function selectBackwards(page: Page, characters: number) {
  for (let i = 0; i < characters; i += 1) {
    await page.keyboard.press("Shift+ArrowLeft");
  }
  await page.waitForTimeout(60);
}

async function openEditable(page: Page, notebook: string) {
  await createNotebookWithOpenPage(page, notebook);
  const editable = page
    .getByTestId("editor-mount")
    .locator('[contenteditable="true"]');
  await editable.click();
  // Playwright click-then-type race: wait for Chrome's selectionchange.
  await page.waitForTimeout(60);
  return editable;
}

test.describe("editor polish round 2", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("writes block math from the slash menu and inline math with $…$", async ({
    page,
  }) => {
    const editable = await openEditable(page, "Cuaderno fórmulas");

    await page.keyboard.type("/ecuacion");
    await page.getByRole("option", { name: /^Ecuación(?! en línea)/ }).click();
    const dialog = page.getByRole("dialog", { name: "Ecuación" });
    const input = dialog.getByRole("textbox", { name: "LaTeX" });
    await expect(input).toBeFocused();
    // A pasted formula keeps its delimiters; the preview renders it live.
    await input.fill("$$\\frac{1}{3}$$");
    await expect(
      dialog.getByTestId("math-preview").locator(".katex"),
    ).toBeVisible();
    await input.press("Enter");
    await expect(dialog).toBeHidden();
    const block = editable.locator("[data-type='block-math']");
    await expect(block).toHaveAttribute("data-latex", "\\frac{1}{3}");
    await expect(block.locator(".katex-display")).toBeVisible();

    // A click reopens it with its LaTeX.
    await block.click();
    await expect(
      page.getByRole("dialog", { name: "Ecuación" }).getByRole("textbox"),
    ).toHaveValue("\\frac{1}{3}");
    await page.keyboard.press("Escape");

    await editable.locator("> p").last().click();
    await page.waitForTimeout(60);
    await page.keyboard.type("energía $E=h\\nu$ fin");
    await expect(editable.locator("[data-type='inline-math']")).toHaveAttribute(
      "data-latex",
      "E=h\\nu",
    );
  });

  test("sets the font family and size of a selection from the Texto menu", async ({
    page,
  }) => {
    const editable = await openEditable(page, "Cuaderno fuentes");
    await page.keyboard.type("Texto con fuente");
    await selectBackwards(page, 6);

    await page.getByTestId("bubble-toolbar-text-style").click();
    await page.getByRole("menuitemradio", { name: "Bitter" }).click();
    const span = editable.locator("span[style*='font-family']");
    await expect(span).toHaveText("fuente");
    await expect(span).toHaveAttribute("style", /Bitter, serif/);

    // H8-2: the size has its own menu next to the font.
    await page.getByTestId("bubble-toolbar-font-size").click();
    await page.getByRole("menuitemradio", { name: /^Grande/ }).click();
    await expect(span).toHaveAttribute("style", /font-size: 22px/);
    // The self-hosted face, not the system fallback.
    const family = await span.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/Bitter/);
  });

  test("undoes and redoes from the page's history arrows", async ({ page }) => {
    const editable = await openEditable(page, "Cuaderno historial");
    const undo = page.getByRole("button", { name: "Deshacer cambio" });
    const redo = page.getByRole("button", { name: "Rehacer cambio" });
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();

    await page.keyboard.type("Hola");
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(editable).not.toContainText("Hola");
    await expect(redo).toBeEnabled();

    await redo.focus();
    await page.keyboard.press("Enter");
    await expect(editable).toContainText("Hola");
  });
});
