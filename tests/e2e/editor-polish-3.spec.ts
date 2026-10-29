import type { Locator, Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// H8 — editor final polish (odd/tasks/phase-8-design-flows.md): code pasted
// into a code block keeps its structure, the two new callouts, and the
// toolbar's own size menu.

const CODE = [
  "def fotosintesis(luz, agua):",
  "    if luz > 0:",
  "        return 'glucosa'",
  "",
  "    return None",
].join("\n");

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

async function insertCodeBlock(page: Page, editable: Locator) {
  await page.keyboard.type("/codigo");
  await page.getByRole("option", { name: /^Bloque de código/ }).click();
  await expect(editable.locator("pre code")).toBeVisible();
}

// A real paste event: ProseMirror reads the event's clipboardData, exactly
// as it does for Cmd+V, without depending on the OS clipboard.
async function paste(editable: Locator, data: Record<string, string>) {
  await editable.evaluate((element, payload) => {
    const transfer = new DataTransfer();
    for (const [type, value] of Object.entries(payload)) {
      transfer.setData(type, value);
    }
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, data);
}

function divPerLine(code: string): string {
  return `<div style="white-space: pre;">${code
    .split("\n")
    .map((line) => `<div>${line.replace(/ /g, "&nbsp;") || "<br>"}</div>`)
    .join("")}</div>`;
}

test.describe("editor final polish", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("keeps the lines and indentation of code pasted into a code block", async ({
    page,
  }) => {
    const editable = await openEditable(page, "Cuaderno pegar código");
    await insertCodeBlock(page, editable);

    await paste(editable, {
      "text/plain": CODE,
      "text/html": divPerLine(CODE),
    });

    const code = editable.locator("pre code");
    await expect(code).toHaveCount(1);
    expect(await code.textContent()).toBe(CODE);
    // Nothing leaked out of the block as separate paragraphs.
    await expect(editable.getByText("return None")).toHaveCount(1);
    await expect(editable.locator("> p", { hasText: "glucosa" })).toHaveCount(
      0,
    );

    // It is saved as one block with the same text.
    await expect(page.getByTestId("autosave-status")).toHaveText(/guardado/i, {
      timeout: 15_000,
    });
    await page.reload();
    const reloaded = page
      .getByTestId("editor-mount")
      .locator('[contenteditable="true"] pre code');
    await expect(reloaded).toHaveCount(1);
    expect(await reloaded.textContent()).toBe(CODE);
  });

  test("keeps the lines of an HTML-only code paste", async ({ page }) => {
    const editable = await openEditable(page, "Cuaderno pegar html");
    await insertCodeBlock(page, editable);

    await paste(editable, { "text/html": divPerLine(CODE) });

    const code = editable.locator("pre code");
    await expect(code).toHaveCount(1);
    expect(await code.textContent()).toBe(CODE);
  });

  test("inserts the Importante and Consejo callouts from the slash menu", async ({
    page,
  }) => {
    const editable = await openEditable(page, "Cuaderno callouts");

    await page.keyboard.type("/importante");
    await page.getByRole("option", { name: /^Callout importante/ }).click();
    await page.keyboard.type("Repasa esto");
    const important = editable.locator(
      "[data-testid='callout'][data-kind='important']",
    );
    await expect(important.getByTestId("callout-label")).toHaveText(
      /Importante/,
    );

    await editable.locator("> p").last().click();
    await page.waitForTimeout(60);
    await page.keyboard.type("/consejo");
    await page.getByRole("option", { name: /^Callout de consejo/ }).click();
    await expect(
      editable
        .locator("[data-testid='callout'][data-kind='tip']")
        .getByTestId("callout-label"),
    ).toHaveText(/Consejo/);
  });

  test("sets the size of a selection from its own toolbar menu", async ({
    page,
  }) => {
    const editable = await openEditable(page, "Cuaderno tamaño");
    await page.keyboard.type("Texto grande");
    for (let i = 0; i < 6; i += 1) await page.keyboard.press("Shift+ArrowLeft");
    await page.waitForTimeout(60);

    const size = page.getByTestId("bubble-toolbar-font-size");
    await expect(size).toHaveText(/16/);
    await size.click();
    await page.getByRole("menuitemradio", { name: /^Grande/ }).click();
    await expect(editable.locator("span[style*='font-size']")).toHaveAttribute(
      "style",
      /font-size: 22px/,
    );
    await expect(size).toHaveText(/22/);
  });
});
