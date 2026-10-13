import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { createNotebookWithOpenPage } from "./helpers/notebooks";
import { setProfileTimeZone } from "./helpers/profiles";
import { clearStudyItems, seedItemsDueAt } from "./helpers/study-items";

// Phase 7 T2 (documento-maestro §3.5): the calendar's "Mes" and "Semana"
// tabs show, per day in the profile time zone, one technique-coloured chip
// per page and technique with items whose next due date falls that day.
// Every test uses a fresh user with a fixed zone (Bogotá, UTC-5 all year),
// so the seeded days and the empty grid are this test's own.

const ZONE = "America/Bogota";
const ZONE_OFFSET_HOURS = 5;
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

// Viewport shots: the shell scrolls inside its content area, so a full-page
// capture would not show more of the grid.
async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
}

// Today in the zone as "YYYY-MM-DD" (numeric parts only, ICU-independent).
function todayIn(timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(day: string, days: number): string {
  const ms = Date.parse(`${day}T00:00:00.000Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

// Noon of the day in Bogotá.
function noonInZone(day: string): Date {
  return new Date(
    Date.parse(`${day}T12:00:00.000Z`) + ZONE_OFFSET_HOURS * 3_600_000,
  );
}

function dayCell(page: Page, day: string) {
  return page.locator(`[data-slot="calendar-day"][data-day="${day}"]`);
}

test.describe("Calendario — Mes y Semana", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, freshUser }) => {
    // Tall enough for a six-week month without scrolling the shell.
    await page.setViewportSize({ width: 1280, height: 1400 });
    await signIn(page, freshUser);
    await setProfileTimeZone(freshUser.id, ZONE);
  });

  test("an empty month still renders its grid, with today marked", async ({
    page,
  }) => {
    await page.goto("/calendario?view=mes");

    const tabs = page.getByRole("navigation", {
      name: "Vistas del calendario",
    });
    await expect(tabs.getByRole("link", { name: "Mes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const card = page.getByTestId("calendar-card");
    const cells = card.locator('[data-slot="calendar-day"]');
    expect(await cells.count()).toBeGreaterThanOrEqual(28);
    expect((await cells.count()) % 7).toBe(0);
    await expect(dayCell(page, todayIn(ZONE))).toHaveAttribute(
      "data-today",
      "true",
    );
    await expect(card.locator('[data-slot="technique-chip"]')).toHaveCount(0);
    await expect(card.getByRole("button")).toHaveCount(0);
    await shot(page, "calendar-month-empty");
  });

  test("prev / next move by month and Hoy returns to the current one", async ({
    page,
  }) => {
    await page.goto("/calendario?view=mes");
    const card = page.getByTestId("calendar-card");
    const title = card.getByRole("heading", { level: 2 });
    const current = await title.textContent();
    const nav = card.getByRole("navigation", { name: "Navegar meses" });

    await nav.getByRole("link", { name: "Mes siguiente" }).click();
    await expect(page).toHaveURL(/\/calendario\?view=mes&date=\d{4}-\d{2}-01$/);
    await expect(title).not.toHaveText(current ?? "");
    await expect(
      card.locator('[data-slot="calendar-day"][data-today]'),
    ).toHaveCount(0);

    await nav.getByRole("link", { name: "Mes anterior" }).click();
    await expect(title).toHaveText(current ?? "");
    await nav.getByRole("link", { name: "Mes anterior" }).click();
    await expect(title).not.toHaveText(current ?? "");

    await nav.getByRole("link", { name: "Hoy" }).click();
    await expect(page).toHaveURL("/calendario?view=mes");
    await expect(title).toHaveText(current ?? "");
    await expect(dayCell(page, todayIn(ZONE))).toHaveAttribute(
      "data-today",
      "true",
    );
  });

  test("shows seeded items on their day in Mes and Semana", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno mes ${randomUUID().slice(0, 8)}`,
    );
    const [, , notebookId, , pageId] = new URL(page.url()).pathname.split("/");
    if (!pageId) throw new Error("page id missing from the editor URL");

    const target = addDays(todayIn(ZONE), 2);
    await seedItemsDueAt(
      pageId,
      { flashcard: 2, exam_question: 1 },
      noonInZone(target),
    );
    try {
      await page.goto(`/calendario?view=mes&date=${target}`);
      const cell = dayCell(page, target);
      const flashcards = cell.getByRole("link", {
        name: "Flashcards de Sin título: 2 ítems",
      });
      await expect(flashcards).toHaveAttribute("data-tone", "yellow");
      await expect(flashcards).toHaveClass(/bg-pastel-yellow/);
      await expect(flashcards).toHaveAttribute(
        "href",
        `/notebooks/${notebookId}/pages/${pageId}`,
      );
      const exam = cell.getByRole("link", {
        name: "Examen de Sin título: 1 ítem",
      });
      await expect(exam).toHaveAttribute("data-tone", "rose");
      await expect(exam).toHaveClass(/bg-pastel-pink/);
      // Only the next due date shows: the neighbouring days stay empty.
      await expect(
        dayCell(page, addDays(target, 1)).locator(
          '[data-slot="technique-chip"]',
        ),
      ).toHaveCount(0);
      await shot(page, "calendar-month-events");

      await page.goto(`/calendario?view=semana&date=${target}`);
      const card = page.getByTestId("calendar-card");
      await expect(card.locator('[data-slot="calendar-day"]')).toHaveCount(7);
      const weekCell = dayCell(page, target);
      await expect(
        weekCell.getByRole("link", {
          name: "Flashcards de Sin título: 2 ítems",
        }),
      ).toBeVisible();
      await expect(
        weekCell.getByRole("link", { name: "Examen de Sin título: 1 ítem" }),
      ).toBeVisible();
      await shot(page, "calendar-week-events");

      // A narrow grid (sidebar open on a small laptop): chips become dots.
      await page.setViewportSize({ width: 900, height: 900 });
      await page.goto(`/calendario?view=mes&date=${target}`);
      await expect(
        dayCell(page, target).locator('[data-collapse="dot-when-narrow"]'),
      ).toHaveCount(2);
      await shot(page, "calendar-month-narrow");

      // Phone width: no horizontal page scroll.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/calendario?view=mes&date=${target}`);
      await expect(dayCell(page, target)).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await shot(page, "calendar-month-phone");
    } finally {
      await clearStudyItems(pageId);
    }
  });
});
