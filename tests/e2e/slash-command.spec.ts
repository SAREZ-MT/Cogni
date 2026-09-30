import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

// specs/editor/spec.md, "Menú de comandos `/`", Scenario "Inserción por
// comando" (e2e): typing "/cita" and pressing Enter inserts a blockquote
// and the "/cita" text disappears. tasks.md, 3b.11: this slice covers a
// block already available (blockquote); the "/tabla" variant is added in
// slice 5a once the table extension exists.

test.describe("slash command menu", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("typing /cita and pressing Enter inserts a blockquote and removes the command text", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(page, "Cuaderno slash");

    const editorMount = page.getByTestId("editor-mount");
    await expect(editorMount).toBeVisible();
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();
    await page.keyboard.type("/cita");

    const menu = page.getByTestId("command-menu");
    await expect(menu).toBeVisible();
    // S6a defect fix: labels are now sentence case ("Cita") and each item
    // also renders a description line containing the plain word "cita"
    // ("Resalta una cita o fragmento"), so a plain getByText("cita") match
    // both and violates Playwright's strict mode. The label is the cmdk
    // option's accessible name and starts with it.
    await expect(menu.getByRole("option", { name: /^Cita/ })).toBeVisible();

    await page.keyboard.press("Enter");

    await expect(menu).toHaveCount(0);
    await expect(editable.locator("blockquote")).toBeVisible();
    await expect(editable).not.toContainText("/cita");

    // Persistence: autosave debounces 800-1500ms, then reload and confirm
    // the blockquote survived a real save/reload round trip through the
    // saveContent/getCurrentContent Server Actions.
    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 5000,
    });
    await page.reload();
    await expect(
      page.getByTestId("editor-mount").locator("blockquote"),
    ).toBeVisible();
  });

  // specs/editor/spec.md, "Conjunto completo de bloques de §3.2", Scenario
  // "Tabla editable" (e2e), and "Menú de comandos `/`": "/tabla" + Enter
  // inserts a table now that the table extension exists (tasks.md, 5a.3).
  test("typing /tabla and pressing Enter inserts a table", async ({ page }) => {
    await createNotebookWithOpenPage(page, "Cuaderno tabla");

    const editorMount = page.getByTestId("editor-mount");
    await expect(editorMount).toBeVisible();
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();
    await page.keyboard.type("/tabla");

    const menu = page.getByTestId("command-menu");
    await expect(menu).toBeVisible();
    // S6a defect fix: same strict-mode collision as "/cita" above — the
    // description "Tabla editable de filas y columnas" also contains
    // "tabla".
    await expect(menu.getByRole("option", { name: /^Tabla/ })).toBeVisible();

    await page.keyboard.press("Enter");

    await expect(menu).toHaveCount(0);
    const table = editable.locator("table");
    await expect(table).toBeVisible();
    await expect(table.locator("td, th")).toHaveCount(4);
    await expect(editable).not.toContainText("/tabla");

    await expect(page.getByTestId("autosave-status")).toHaveText("guardado", {
      timeout: 5000,
    });
    await page.reload();
    await expect(
      page.getByTestId("editor-mount").locator("table"),
    ).toBeVisible();
  });

  // specs/editor/spec.md, "Paleta de resaltado de Cogni y callouts",
  // Scenario "Callout de advertencia": reachable from the "/" menu too.
  test("typing /advertencia and pressing Enter inserts a warning callout", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(page, "Cuaderno callout");

    const editorMount = page.getByTestId("editor-mount");
    await expect(editorMount).toBeVisible();
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();
    await page.keyboard.type("/advertencia");

    const menu = page.getByTestId("command-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText("callout de advertencia")).toBeVisible();

    await page.keyboard.press("Enter");

    await expect(menu).toHaveCount(0);
    const callout = editable.locator('[data-testid="callout"]');
    await expect(callout).toBeVisible();
    await expect(callout).toHaveAttribute("data-kind", "warning");
    await expect(editable).not.toContainText("/advertencia");
  });
});
