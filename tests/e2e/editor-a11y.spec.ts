import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";

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

test.describe("editor accessibility with reduced motion", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("the '/' menu opens, filters and closes cleanly", async ({ page }) => {
    await createNotebookWithOpenPage(page, "Cuaderno a11y");

    const editorMount = page.getByTestId("editor-mount");
    await expect(editorMount).toBeVisible();
    const editable = editorMount.locator('[contenteditable="true"]');
    await editable.click();
    await page.keyboard.type("/normal");

    const menu = page.getByTestId("command-menu");
    await expect(menu).toBeVisible();
    // The paragraph entry is labeled "Texto" in the template block set; its
    // description ("Texto normal") also contains the word, hence exact.
    await expect(menu.getByText("Texto", { exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });
});
