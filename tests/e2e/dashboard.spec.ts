import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import {
  msToUtcMidnight,
  seedDueItems,
  seedReviews,
} from "./helpers/study-items";

// Phase 7 T4 (documento-maestro §3.6): /dashboard reads the analytics
// module instead of sample data. A user who has studied sees their real
// numbers; a brand-new user sees one empty state; the sidebar's
// "Dashboard" entry is a plain link. Every scenario runs on its own fresh
// account (the worker user accumulates reviews across specs), in the
// profile's default UTC zone.

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;
// A run of this scenario fits well within two minutes.
const MIDNIGHT_MARGIN_MS = 120_000;

// The shell scrolls inside its content area, so a tall desktop viewport
// captures the whole dashboard.
async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.setViewportSize({ width: 1440, height: 2000 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

test.describe("Dashboard", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test("a brand-new user sees the empty state, reached from the sidebar", async ({
    page,
    freshUser,
  }) => {
    await signIn(page, freshUser);

    const link = page.getByRole("link", { name: "Dashboard", exact: true });
    await expect(link).toHaveAttribute("href", "/dashboard");
    await link.click();
    await expect(page).toHaveURL("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    const empty = page.getByTestId("dashboard-empty");
    await expect(
      empty.getByText("Aún no hay progreso que mostrar"),
    ).toBeVisible();
    await expect(
      empty.getByRole("link", { name: /Ir a mis cuadernos/ }),
    ).toHaveAttribute("href", "/notebooks");
    await expect(page.getByTestId("kpi-row")).toHaveCount(0);
    await expect(page.getByText("Vista previa")).toHaveCount(0);
    await shot(page, "t4-dashboard-empty");
  });

  test("a user who has studied sees their real streak, reviews and due items", async ({
    page,
    freshUser,
  }) => {
    await signIn(page, freshUser);
    await createNotebookWithOpenPage(
      page,
      `Cuaderno dashboard ${randomUUID().slice(0, 8)}`,
    );
    const [, , , , pageId] = new URL(page.url()).pathname.split("/");
    if (!pageId) throw new Error("page id missing from the editor URL");

    // Two reviews today and one yesterday (UTC days, on the database
    // clock): a 2-day streak, 3 reviews in the last 7 days, and one
    // flashcard due now. Close to UTC midnight the seeded "today" could
    // become "yesterday" before the page renders, so wait the day out.
    const untilMidnight = await msToUtcMidnight();
    if (untilMidnight < MIDNIGHT_MARGIN_MS) {
      test.slow();
      await page.waitForTimeout(untilMidnight + 5_000);
    }
    await seedReviews(pageId, [
      { sessionKind: "flashcards", quality: 5, daysAgo: 0 },
      { sessionKind: "flashcards", quality: 2, daysAgo: 0 },
      { sessionKind: "flashcards", quality: 4, daysAgo: 1 },
    ]);
    await seedDueItems(pageId, { flashcard: 1 });

    await page.goto("/");
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page).toHaveURL("/dashboard");

    await expect(page.getByTestId("dashboard-empty")).toHaveCount(0);
    const kpis = page.getByTestId("kpi-row");
    const streak = kpis
      .locator("[data-slot=card]")
      .filter({ hasText: "Racha de repasos" });
    await expect(streak.getByText("2 días")).toBeVisible();
    // Nothing was reviewed in the 7 days before last week: +2.
    await expect(streak.getByText("+2")).toBeVisible();
    const due = kpis
      .locator("[data-slot=card]")
      .filter({ hasText: "Ítems vencidos" });
    await expect(due.getByText("1", { exact: true })).toBeVisible();
    await expect(due.getByText("en 1 página")).toBeVisible();

    const activity = page.getByTestId("activity-chart");
    await expect(activity).toContainText(/Repasos completados\s*3/);
    const flashcards = page.getByRole("figure", {
      name: /^Actividad de Flashcards: 3 repasos completados en el período, racha de 2 días, 67% de acierto$/,
    });
    await expect(flashcards).toBeVisible();
    await shot(page, "t4-dashboard-data");
  });
});
