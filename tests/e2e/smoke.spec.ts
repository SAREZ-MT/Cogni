import { expect, test } from "@playwright/test";

// Minimal smoke test for PR1: proves the Playwright + webServer wiring
// boots a real production build and serves the app. Phase 2 replaces
// this with the shell empty-state e2e spec (task 2.6).
test("home page responds and renders content", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText(/to get started, edit the/i)).toBeVisible();
});
