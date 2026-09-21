import type { Locator, Page } from "@playwright/test";
import {
  createVerifiedUser,
  deleteUserByEmail,
  expect,
  hasSupabaseEnv,
  signIn,
  type TestUser,
  test,
} from "./fixtures/auth";

// Task 2.12 skeleton: create notebook -> create page -> rename -> icon/color
// -> archive -> disappears from sidebar -> route not found. Extended in
// PR4 (specs/notebooks/spec.md, §13 acceptance flow) once the editor is
// wired for real content.

// Server Actions POST to the current pathname; `page.waitForLoadState
// ("networkidle")` is unreliable here (background beacons/tunnels keep the
// network "non-idle" or resolve the wait before the action's own response
// arrives). Waiting for the exact POST response guarantees the mutation
// actually settled — with its real, server-assigned id — before the next
// step reads DOM state that depends on it (specs/notebooks/spec.md,
// "Guardado de contenido con comparar-e-intercambiar" applies the same
// atomic-write discipline the UI must not race ahead of).
async function clickAndWaitForAction(page: Page, locator: Locator) {
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    locator.click(),
  ]);
}

test.describe("notebooks acceptance", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("create, rename, recolor, add a page and archive a notebook from the sidebar", async ({
    page,
  }) => {
    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await page.goto("/");

    // Crear cuaderno
    await sidebar.getByRole("button", { name: "Crear cuaderno" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Título").fill("Cuaderno e2e");
    await clickAndWaitForAction(
      page,
      dialog.getByRole("button", { name: "Crear cuaderno" }),
    );
    const notebookRow = sidebar.getByText("Cuaderno e2e");
    await expect(notebookRow).toBeVisible();

    // Renombrar (Scenario "Renombrar y cambiar ícono desde el sidebar")
    await notebookRow.dblclick();
    const renameInput = sidebar.locator("input").first();
    await renameInput.fill("Cuaderno renombrado");
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST",
      ),
      renameInput.press("Enter"),
    ]);
    await expect(sidebar.getByText("Cuaderno renombrado")).toBeVisible();
    await page.reload();
    await expect(sidebar.getByText("Cuaderno renombrado")).toBeVisible();

    // Cambiar color
    await sidebar
      .getByRole("button", {
        name: "Cambiar apariencia de Cuaderno renombrado",
      })
      .click();
    await clickAndWaitForAction(
      page,
      page.getByRole("button", { name: "Color purple" }),
    );
    await page.reload();
    await expect(
      sidebar.getByRole("button", {
        name: "Cambiar apariencia de Cuaderno renombrado",
      }),
    ).toBeVisible();

    // Crear y abrir una página (Scenario "Crear y abrir una página")
    await clickAndWaitForAction(
      page,
      sidebar.getByRole("button", {
        name: "Crear página en Cuaderno renombrado",
      }),
    );
    const pageLink = sidebar.getByRole("link", { name: "Sin título" });
    await expect(pageLink).toBeVisible();
    await pageLink.click();
    await expect(page.getByTestId("editor-mount")).toBeVisible();

    // Archivar (Scenario "Archivar desde el sidebar")
    await page.goto("/");
    await sidebar
      .getByRole("button", { name: "Archivar cuaderno Cuaderno renombrado" })
      .click();
    await clickAndWaitForAction(
      page,
      page.getByRole("button", { name: "Archivar" }),
    );
    await expect(sidebar.getByText("Cuaderno renombrado")).toHaveCount(0);
  });

  test("a foreign page route renders not-found (Scenario 'Ruta de página ajena')", async ({
    page,
    browser,
    verifiedUser,
  }) => {
    // Owner A creates a notebook and a page.
    await page.goto("/");
    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await sidebar.getByRole("button", { name: "Crear cuaderno" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Título").fill("Privado de A");
    await clickAndWaitForAction(
      page,
      dialog.getByRole("button", { name: "Crear cuaderno" }),
    );
    await expect(sidebar.getByText("Privado de A")).toBeVisible();

    await clickAndWaitForAction(
      page,
      sidebar.getByRole("button", { name: "Crear página en Privado de A" }),
    );
    const pageLink = sidebar.getByRole("link", { name: "Sin título" });
    await expect(pageLink).toBeVisible();
    await pageLink.click();
    await expect(page.getByTestId("editor-mount")).toBeVisible();
    const foreignUrl = page.url();

    // Owner B (a second verified user, own browser context) opens the same URL.
    let ownerB: TestUser | undefined;
    try {
      ownerB = await createVerifiedUser();
      const context = await browser.newContext();
      const otherPage = await context.newPage();
      await signIn(otherPage, ownerB);
      const response = await otherPage.goto(foreignUrl);
      expect(response?.status()).toBe(404);
      await expect(otherPage.getByTestId("editor-mount")).toHaveCount(0);
      await context.close();
    } finally {
      if (ownerB) await deleteUserByEmail(ownerB.email);
    }
    void verifiedUser;
  });
});
