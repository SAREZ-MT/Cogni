import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
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

// How a month chip actually renders: its box and whether its label is the
// visually hidden screen-reader text (sr-only = absolutely positioned and
// clipped to 1 px) or laid out as visible text.
async function chipRendering(chip: Locator) {
  const box = await chip.boundingBox();
  const labelPosition = await chip
    .locator('[data-part="label"]')
    .evaluate((label) => getComputedStyle(label).position);
  return {
    width: box?.width ?? 0,
    height: box?.height ?? 0,
    labelHidden: labelPosition === "absolute",
  };
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

  // Phase 8 H3 (user reviews 2026-10-19): Semana's metric card sits beside
  // the title and tabs without moving them; every view renders the title,
  // the tabs, the date badge, the start of the period block and the calendar
  // card at the same place (the arrows follow the period text).
  test("keeps the page header and the card at the same place in every view", async ({
    page,
  }) => {
    const positions: number[][] = [];
    for (const view of ["hoy", "semana", "mes"]) {
      await page.goto(`/calendario?view=${view}`);
      const tabs = page.getByRole("navigation", {
        name: "Vistas del calendario",
      });
      await expect(tabs).toBeVisible();
      const title = page.getByRole("heading", { level: 1, name: "Calendario" });
      const card = page.getByTestId("calendar-card");
      const badge = page.locator('[data-slot="date-badge"]');
      const period = page.getByTestId("calendar-period");
      const box = async (locator: typeof card) => {
        const rect = await locator.boundingBox();
        return [rect?.x ?? -1, rect?.y ?? -1];
      };
      positions.push([
        ...(await box(title)),
        ...(await box(tabs)),
        ...(await box(badge)),
        (await period.boundingBox())?.x ?? -1,
        ...(await box(card)),
      ]);
      // The period line and its arrows centre on the tabs row (±2px).
      const centre = async (locator: typeof card) => {
        const rect = await locator.boundingBox();
        return (rect?.y ?? 0) + (rect?.height ?? 0) / 2;
      };
      const tabsCentre = await centre(tabs);
      expect(
        Math.abs(
          (await centre(period.locator('[data-part="line"]'))) - tabsCentre,
        ),
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(
          (await centre(period.locator('[data-slot="calendar-nav"]'))) -
            tabsCentre,
        ),
      ).toBeLessThanOrEqual(2);
    }
    expect(positions[1]).toEqual(positions[0]);
    expect(positions[2]).toEqual(positions[0]);
  });

  test("prev / next move by month and the Mes tab returns to the current one", async ({
    page,
  }) => {
    await page.goto("/calendario?view=mes");
    const card = page.getByTestId("calendar-card");
    const period = page.getByTestId("calendar-period");
    const title = period.getByRole("heading", { level: 2 });
    const current = await title.textContent();
    const nav = period.getByRole("navigation", { name: "Navegar meses" });

    await nav.getByRole("link", { name: "Mes siguiente" }).click();
    await expect(page).toHaveURL(/\/calendario\?view=mes&date=\d{4}-\d{2}-01$/);
    await expect(title).not.toHaveText(current ?? "");
    // Late in the month, today can show up as a greyed spill-over day in the
    // next month's first row; only in-month days must not be marked as today.
    await expect(
      card.locator(
        '[data-slot="calendar-day"][data-today]:not([data-outside="true"])',
      ),
    ).toHaveCount(0);

    await nav.getByRole("link", { name: "Mes anterior" }).click();
    await expect(title).toHaveText(current ?? "");
    await nav.getByRole("link", { name: "Mes anterior" }).click();
    await expect(title).not.toHaveText(current ?? "");

    await page
      .getByRole("navigation", { name: "Vistas del calendario" })
      .getByRole("link", { name: "Mes" })
      .click();
    await expect(page).toHaveURL("/calendario?view=mes");
    await expect(title).toHaveText(current ?? "");
    await expect(dayCell(page, todayIn(ZONE))).toHaveAttribute(
      "data-today",
      "true",
    );
  });

  // Phase 8 H3: "Semana X" names the week of its month and follows the
  // arrows; the Semana tab returns to the current week.
  test("the next week changes Semana X and the Semana tab returns to this week", async ({
    page,
  }) => {
    await page.goto("/calendario?view=semana");
    const period = page.getByTestId("calendar-period");
    const overline = period.locator('[data-part="overline"]');
    await expect(overline).toHaveText(/^Semana [1-5]$/);
    const current = await overline.textContent();

    await period.getByRole("link", { name: "Semana siguiente" }).click();
    await expect(page).toHaveURL(/view=semana&date=\d{4}-\d{2}-\d{2}$/);
    // Consecutive weeks never share a number (n → n+1, or the last → 1).
    await expect(overline).not.toHaveText(current ?? "");

    await page
      .getByRole("navigation", { name: "Vistas del calendario" })
      .getByRole("link", { name: "Semana" })
      .click();
    await expect(page).toHaveURL("/calendario?view=semana");
    await expect(overline).toHaveText(current ?? "");
  });

  // Phase 8 H3 (approved mockup 2026-10-19): Mes days are selectable; the
  // side panel names the selected day and lists the seven days after it.
  test("clicking a month day selects it; Próximos covers only the next seven days", async ({
    page,
  }) => {
    await createNotebookWithOpenPage(
      page,
      `Cuaderno panel ${randomUUID().slice(0, 8)}`,
    );
    const [, , , , pageId] = new URL(page.url()).pathname.split("/");
    if (!pageId) throw new Error("page id missing from the editor URL");
    const today = todayIn(ZONE);
    await seedItemsDueAt(
      pageId,
      { exam_question: 1 },
      noonInZone(addDays(today, 3)),
    );
    await seedItemsDueAt(
      pageId,
      { recall_question: 1 },
      noonInZone(addDays(today, 9)),
    );
    try {
      await page.goto("/calendario?view=mes");
      const next = page.getByRole("list", { name: "Próximos 7 días" });
      await expect(next.getByRole("link", { name: /^Examen de / })).toHaveCount(
        1,
      );
      // Day 9 is beyond the window.
      await expect(
        next.getByRole("link", { name: /^Recordación activa de / }),
      ).toHaveCount(0);

      // Select another day of this month: the URL and the panel follow.
      const other =
        today.slice(8) === "15"
          ? `${today.slice(0, 8)}16`
          : `${today.slice(0, 8)}15`;
      const heading = page
        .locator('[data-part="aside"]')
        .getByRole("heading", { level: 3 });
      const before = await heading.textContent();
      await dayCell(page, other).locator('[data-part="select"]').click();
      await expect(page).toHaveURL(`/calendario?view=mes&date=${other}`);
      await expect(heading).not.toHaveText(before ?? "");
      await expect(dayCell(page, other)).toHaveAttribute(
        "data-selected",
        "true",
      );
    } finally {
      await clearStudyItems(pageId);
    }
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
      // Outlined chip (Phase 8 H3): the technique shows in its accent bar.
      await expect(flashcards.locator('[data-part="accent"]')).toHaveClass(
        /bg-technique-flashcards-accent/,
      );
      await expect(flashcards).toHaveAttribute(
        "href",
        `/notebooks/${notebookId}/pages/${pageId}`,
      );
      const exam = cell.getByRole("link", {
        name: "Examen de Sin título: 1 ítem",
      });
      await expect(exam).toHaveAttribute("data-tone", "rose");
      await expect(exam.locator('[data-part="accent"]')).toHaveClass(
        /bg-technique-exam-accent/,
      );
      // A wide grid shows whole chips: the label is visible text.
      const wide = await chipRendering(flashcards);
      expect(wide.labelHidden).toBe(false);
      expect(wide.width).toBeGreaterThan(40);
      // The dated day is selected: the side panel lists its reviews.
      await expect(
        page
          .getByRole("list", { name: "Repasos del día" })
          .getByRole("link", { name: "Flashcards de Sin título: 2 ítems" }),
      ).toHaveAttribute("href", `/notebooks/${notebookId}/pages/${pageId}`);
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
      // Phase 8 H3-T2: one progress ring per technique in the metric card
      // beside the page title (nothing reviewed yet: 0 of the 2 flashcards).
      await expect(
        page
          .getByTestId("week-metrics")
          .locator('[data-slot="technique-ring"]'),
      ).toHaveCount(3);
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

      // A narrow grid (sidebar open on a small laptop): chips become dots
      // (size-2.5 = 10 px) whose label is screen-reader text only. At the
      // wide viewport above these checks fail.
      await page.setViewportSize({ width: 900, height: 900 });
      await page.goto(`/calendario?view=mes&date=${target}`);
      const narrowChips = dayCell(page, target).locator(
        '[data-slot="technique-chip"]',
      );
      await expect(narrowChips).toHaveCount(2);
      await expect(async () => {
        for (const chip of await narrowChips.all()) {
          const narrow = await chipRendering(chip);
          expect(narrow.labelHidden).toBe(true);
          expect(narrow.width).toBeLessThanOrEqual(12);
          expect(narrow.height).toBeLessThanOrEqual(12);
        }
      }).toPass({ timeout: 5_000 });
      await expect(
        dayCell(page, target).getByRole("link", {
          name: "Flashcards de Sin título: 2 ítems",
        }),
      ).toBeAttached();
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
