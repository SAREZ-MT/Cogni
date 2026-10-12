import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";
import { profileTimeZoneOf } from "./helpers/profiles";

// Phase 7 T2a: Configuración holds the profile time zone. A new account
// adopts the browser's zone on first use (never silently UTC); choosing
// another one persists, and the calendar's "Hoy" header follows it.

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

// Kiritimati is UTC+14: its calendar day differs from Bogota's (UTC-5)
// for 19 hours of every day, and the assertion computes the expected text
// in the same zone, so it holds at any time of day.
const CHOSEN_ZONE = "Pacific/Kiritimati";

function longDayIn(timeZone: string): string {
  const text = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

test.describe("Configuración — zona horaria", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");
  test.use({ timezoneId: "America/Bogota" });

  test("adopts the browser zone, saves a chosen one and dates Hoy with it", async ({
    page,
    freshUser,
  }) => {
    await signIn(page, freshUser);

    // First use: the shell reports the browser zone and the profile keeps it.
    await expect
      .poll(() => profileTimeZoneOf(freshUser.id))
      .toBe("America/Bogota");

    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await sidebar.getByRole("link", { name: /Configuración/ }).click();
    await expect(page).toHaveURL(/\/configuracion$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Configuración" }),
    ).toBeVisible();

    const card = page.getByTestId("time-zone-card");
    const select = card.getByLabel("Zona horaria");
    await expect(select).toHaveValue("America/Bogota");
    await shot(page, "settings-time-zone");

    await select.selectOption(CHOSEN_ZONE);
    await page.waitForTimeout(50);
    await card.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(card.getByRole("status")).toHaveText("Zona horaria guardada.");

    await page.reload();
    await expect(
      page.getByTestId("time-zone-card").getByLabel("Zona horaria"),
    ).toHaveValue(CHOSEN_ZONE);
    expect(await profileTimeZoneOf(freshUser.id)).toBe(CHOSEN_ZONE);

    await sidebar.getByRole("link", { name: "Calendario" }).click();
    await expect(page).toHaveURL(/\/calendario$/);
    const calendar = page.getByTestId("calendar-card");
    await expect(calendar).toContainText(longDayIn(CHOSEN_ZONE));
    await expect(
      calendar.locator('[data-slot="date-badge"] [data-part="day"]'),
    ).toHaveText(
      new Intl.DateTimeFormat("es", {
        day: "numeric",
        timeZone: CHOSEN_ZONE,
      }).format(new Date()),
    );
    await shot(page, "calendar-today-time-zone");
  });

  test("offers the IANA zones grouped by region, UTC as an explicit choice", async ({
    page,
    freshUser,
  }) => {
    await signIn(page, freshUser);
    await page.goto("/configuracion");

    const select = page
      .getByTestId("time-zone-card")
      .getByLabel("Zona horaria");
    await expect(select.locator("optgroup")).not.toHaveCount(0);
    await expect(select.locator('option[value="Etc/UTC"]')).toHaveText(
      "UTC (GMT)",
    );
  });
});
