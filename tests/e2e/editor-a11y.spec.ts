import type { Locator, Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";

// specs/editor/spec.md, "Apariencia y copy del editor", Scenario "Revisión
// de textos del editor": with `prefers-reduced-motion: reduce` emulated,
// the "/" menu MUST still open, show its filtered options, and close
// cleanly on Escape. The `reducedMotion` test option forces
// `prefers-reduced-motion: reduce` for every page in this file
// (playwright.dev, "TestOptions.reducedMotion"). This does not assert a
// per-item keyboard focus ring: `CommandMenu`'s own `data-selected` prop
// is overridden by `cmdk`'s internal (mouse-driven) selection state, so
// the DOM attribute never reflects this component's own ArrowUp/ArrowDown
// state — a pre-existing gap noted in this PR's apply-progress, out of
// this slice's scope to fix.
test.use({ reducedMotion: "reduce" });

async function clickAndWaitForAction(page: Page, locator: Locator) {
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() === "POST" && response.ok(),
    ),
    locator.click(),
  ]);
}

test.describe("editor accessibility with reduced motion", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("the '/' menu opens, filters and closes cleanly", async ({ page }) => {
    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await page.goto("/");

    await sidebar.getByRole("button", { name: "Crear cuaderno" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Título").fill("Cuaderno a11y");
    await clickAndWaitForAction(
      page,
      dialog.getByRole("button", { name: "Crear cuaderno" }),
    );
    await expect(sidebar.getByText("Cuaderno a11y")).toBeVisible();

    await clickAndWaitForAction(
      page,
      sidebar.getByRole("button", { name: "Crear página en Cuaderno a11y" }),
    );
    const pageLink = sidebar
      .getByRole("listitem")
      .filter({ hasText: "Cuaderno a11y" })
      .getByRole("link", { name: "Sin título" });
    await expect(pageLink).toBeVisible();
    await pageLink.click();

    const editorMount = page.getByTestId("editor-mount");
    await expect(editorMount).toBeVisible();
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();
    await page.keyboard.type("/normal");

    const menu = page.getByTestId("command-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText("párrafo")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });
});
