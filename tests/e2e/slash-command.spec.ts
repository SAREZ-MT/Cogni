import type { Locator, Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";

// specs/editor/spec.md, "Menú de comandos `/`", Scenario "Inserción por
// comando" (e2e): typing "/cita" and pressing Enter inserts a blockquote
// and the "/cita" text disappears. tasks.md, 3b.11: this slice covers a
// block already available (blockquote); the "/tabla" variant is added in
// slice 5a once the table extension exists.

async function clickAndWaitForAction(page: Page, locator: Locator) {
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    locator.click(),
  ]);
}

test.describe("slash command menu", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("typing /cita and pressing Enter inserts a blockquote and removes the command text", async ({
    page,
  }) => {
    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await page.goto("/");

    await sidebar.getByRole("button", { name: "Crear cuaderno" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Título").fill("Cuaderno slash");
    await clickAndWaitForAction(
      page,
      dialog.getByRole("button", { name: "Crear cuaderno" }),
    );
    await expect(sidebar.getByText("Cuaderno slash")).toBeVisible();

    await clickAndWaitForAction(
      page,
      sidebar.getByRole("button", { name: "Crear página en Cuaderno slash" }),
    );
    const pageLink = sidebar.getByRole("link", { name: "Sin título" });
    await expect(pageLink).toBeVisible();
    await pageLink.click();

    const editorMount = page.getByTestId("editor-mount");
    await expect(editorMount).toBeVisible();
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();
    await page.keyboard.type("/cita");

    const menu = page.getByTestId("command-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText("cita")).toBeVisible();

    await page.keyboard.press("Enter");

    await expect(menu).toHaveCount(0);
    await expect(editable.locator("blockquote")).toBeVisible();
    await expect(editable).not.toContainText("/cita");

    // Persistence: autosave debounces 800-1500ms, then reload and confirm
    // the blockquote survived a real save/reload round trip through the
    // saveContent/getCurrentContent Server Actions.
    await expect(editorMount.getByText("guardado")).toBeVisible({
      timeout: 5000,
    });
    await page.reload();
    await expect(
      page.getByTestId("editor-mount").locator("blockquote"),
    ).toBeVisible();
  });
});
