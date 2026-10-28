import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import { clearStudyItems, seedDueItems } from "./helpers/study-items";

// Phase 7 T1 (documento-maestro §3.5), Phase 8 H3-T4: the calendar's "Hoy"
// tab lists one row per page and technique with study items due today, each
// opening that technique's session; Home's "Repasos pendientes hoy" reads the real total
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
    await expect(
      page.getByTestId("calendar-period").getByRole("heading", { name: "Hoy" }),
    ).toBeVisible();
    // Illustrated empty state (Phase 8 H3): nothing was due, nothing is
    // scheduled yet, so the quiet link goes to the week.
    await expect(
      card.getByRole("heading", { name: "Hoy estás al día" }),
    ).toBeVisible();
    await expect(
      card.getByText(
        "No tienes repasos pendientes. Cogni te avisará cuando toque el próximo.",
      ),
    ).toBeVisible();
    await expect(
      card.locator('[data-slot="illustrated-empty-state"] img'),
    ).toHaveAttribute("alt", "");
    await expect(
      card.getByRole("link", { name: "Ver la semana" }),
    ).toHaveAttribute("href", "/calendario?view=semana");
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
      // One row per page × technique (Phase 8 H3-T4), each row one link
      // opening that technique's session.
      const rows = page
        .getByTestId("today-row")
        .filter({ hasText: notebookTitle });
      await expect(rows).toHaveCount(3);
      await expect(rows.first()).toContainText("Sin título");
      await expect(rows.first()).toContainText("Desde hoy");

      const flashcards = rows.filter({ hasText: "Flashcards" });
      await expect(flashcards).toHaveAccessibleName(/^Flashcards de /);
      await expect(flashcards).toHaveAttribute(
        "href",
        `/flashcards/${notebookId}/${pageId}?repasar=1`,
      );
      await expect(flashcards).toContainText("2 tarjetas");
      const recall = rows.filter({ hasText: "Recordación activa" });
      await expect(recall).toHaveAccessibleName(/^Recordación activa de /);
      await expect(recall).toHaveAttribute(
        "href",
        `/active-recall/${notebookId}/${pageId}`,
      );
      const exam = rows.filter({ hasText: "Examen" });
      await expect(exam).toHaveAccessibleName(/^Examen de /);
      await expect(exam).toHaveAttribute(
        "href",
        `/exams/${notebookId}/${pageId}`,
      );
      await expect(exam).toContainText("3 preguntas");
      await shot(page, "calendar-today-due");

      // Home (H2-T5f, H2-T5i): today's progress per technique in study
      // units (one page × technique), linking to each technique, and a
      // "Repasar" row in "Repasar hoy" that opens the scheduled
      // session directly. The e2e user is shared per worker and other
      // pages may become due at any moment, so the day's total (done +
      // still due) is checked against this test's one seeded page as a
      // lower bound.
      await page.goto("/inicio");
      const flashcardsCard = page.getByRole("link", {
        name: /^Flashcards: \d+ de \d+ repasos hechos hoy$/,
      });
      await expect(flashcardsCard).toHaveAttribute("href", "/flashcards");
      const total = (await flashcardsCard.getAttribute("aria-label"))?.match(
        /de (\d+) repasos/,
      )?.[1];
      expect(Number(total)).toBeGreaterThanOrEqual(1);
      const reviewFlashcards = page
        .getByRole("region", { name: /^Repasar hoy$/ })
        .locator(`a[href="/flashcards/${notebookId}/${pageId}?repasar=1"]`);
      await expect(reviewFlashcards).toHaveAttribute(
        "aria-label",
        /^Repasar Flashcards de /,
      );
      await reviewFlashcards.click();
      await expect(page).toHaveURL(
        `/flashcards/${notebookId}/${pageId}?repasar=1`,
      );
    } finally {
      await clearStudyItems(pageId);
    }
  });

  // Phase 8 H3-T4: Hoy browses forward day by day and returns to today.
  test("moves to the next day and back to Hoy", async ({ page }) => {
    await page.goto("/calendario");
    const period = page.getByTestId("calendar-period");
    const nav = period.getByRole("navigation", { name: "Navegar días" });
    await expect(period.getByRole("heading", { level: 2 })).toHaveText("Hoy");
    await expect(
      nav.locator('[aria-disabled="true"]', { hasText: "Día anterior" }),
    ).toHaveCount(1);
    const badgeDay = page.locator('[data-slot="date-badge"] [data-part="day"]');
    const today = await badgeDay.textContent();

    await nav.getByRole("link", { name: "Día siguiente" }).click();
    await expect(page).toHaveURL(/\/calendario\?date=\d{4}-\d{2}-\d{2}$/);
    await expect(period.getByRole("heading", { level: 2 })).not.toHaveText(
      "Hoy",
    );
    // A later day lists what is scheduled, never a "Repasar" session.
    await expect(page.getByTestId("today-row")).toHaveCount(0);
    await expect(
      page.getByTestId("calendar-card").getByText("Repasar"),
    ).toHaveCount(0);
    // The badge follows the shown day.
    await expect(badgeDay).not.toHaveText(today ?? "");

    // The Hoy tab returns to today (no date in the URL).
    await page
      .getByRole("navigation", { name: "Vistas del calendario" })
      .getByRole("link", { name: "Hoy" })
      .click();
    await expect(page).toHaveURL("/calendario");
    await expect(period.getByRole("heading", { level: 2 })).toHaveText("Hoy");
    await expect(badgeDay).toHaveText(today ?? "");
  });

  test("the sidebar's Calendario entry opens the calendar", async ({
    page,
  }) => {
    await page.goto("/inicio");

    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    const entry = sidebar.getByRole("link", { name: "Calendario" });
    await expect(entry).toHaveAttribute("href", "/calendario");
    await expect(sidebar.getByText("Horarios")).toHaveCount(0);
    await entry.click();
    await expect(page).toHaveURL("/calendario");
    await expect(entry).toHaveAttribute("aria-current", "page");
  });
});
