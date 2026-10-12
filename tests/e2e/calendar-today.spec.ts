import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import {
  clearStudyItems,
  dueCountForOwnerOf,
  seedDueItems,
} from "./helpers/study-items";

// Phase 7 T1 (documento-maestro §3.5): the calendar's "Hoy" tab lists the
// pages with study items due now, one technique-coloured chip per technique
// opening its session; Home's "Repasos pendientes hoy" reads the real total
// and links to the tab; the sidebar's "Calendario" entry opens it.

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

test.describe("Calendario — Hoy", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("a new user with nothing due sees the up-to-date empty state", async ({
    page,
    freshUser,
  }) => {
    await page.context().clearCookies();
    await signIn(page, freshUser);
    await page.goto("/calendario");

    await expect(
      page.getByRole("heading", { level: 1, name: "Calendario" }),
    ).toBeVisible();
    const tabs = page.getByRole("navigation", {
      name: "Vistas del calendario",
    });
    await expect(tabs.getByRole("link", { name: "Hoy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const card = page.getByTestId("calendar-card");
    await expect(card.getByRole("heading", { name: "Hoy" })).toBeVisible();
    await expect(card.getByText("Estás al día")).toBeVisible();
    await expect(page.getByTestId("today-row")).toHaveCount(0);
    await shot(page, "calendar-today-empty");
  });

  test("lists a due page with technique chips, counted on Home", async ({
    page,
  }) => {
    // The e2e user is shared per worker, so other pages may be due too: the
    // row is found by this test's own notebook title.
    const notebookTitle = `Cuaderno calendario ${randomUUID().slice(0, 8)}`;
    await createNotebookWithOpenPage(page, notebookTitle);
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    if (!pageId) throw new Error("page id missing from the editor URL");

    await seedDueItems(pageId, {
      flashcard: 2,
      recall_question: 1,
      exam_question: 3,
    });
    try {
      await page.goto("/calendario");
      const row = page
        .getByTestId("today-row")
        .filter({ hasText: notebookTitle });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("Sin título");

      const flashcards = row.getByRole("link", { name: /^Flashcards de / });
      await expect(flashcards).toHaveAttribute(
        "href",
        `/flashcards/${notebookId}/${pageId}?repasar=1`,
      );
      await expect(flashcards).toContainText("2");
      await expect(
        row.getByRole("link", { name: /^Recordación activa de / }),
      ).toHaveAttribute("href", `/active-recall/${notebookId}/${pageId}`);
      const exam = row.getByRole("link", { name: /^Examen de / });
      await expect(exam).toHaveAttribute(
        "href",
        `/exams/${notebookId}/${pageId}`,
      );
      await expect(exam).toContainText("3");
      await shot(page, "calendar-today-due");

      // Home: the real total across techniques, linking to the calendar.
      const expected = await dueCountForOwnerOf(pageId);
      expect(expected).toBeGreaterThanOrEqual(6);
      await page.goto("/");
      const stat = page.getByTestId("due-today-stat");
      await expect(stat).toContainText(`${expected} repasos`);
      await expect(stat).not.toContainText("pronto");
      await stat.getByRole("link", { name: "Ver calendario →" }).click();
      await expect(page).toHaveURL("/calendario");
      await expect(
        page.getByTestId("today-row").filter({ hasText: notebookTitle }),
      ).toHaveCount(1);
    } finally {
      await clearStudyItems(pageId);
    }
  });

  test("the sidebar's Calendario entry opens the calendar", async ({
    page,
  }) => {
    await page.goto("/");

    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    const entry = sidebar.getByRole("link", { name: "Calendario" });
    await expect(entry).toHaveAttribute("href", "/calendario");
    await expect(sidebar.getByText("Horarios")).toHaveCount(0);
    await entry.click();
    await expect(page).toHaveURL("/calendario");
    await expect(entry).toHaveAttribute("aria-current", "page");
  });
});
