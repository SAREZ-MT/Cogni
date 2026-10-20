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

function longDayIn(timeZone: string, at: Date = new Date()): string {
  const text = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(at);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The calendar falls back to UTC when the zone cannot be read, so the saved
// zone must put "today" on a different calendar day than UTC or the header
// check cannot tell them apart. Kiritimati (UTC+14) is a day ahead of UTC
// from 10:00 to 24:00 UTC and Pago Pago (UTC-11) a day behind from 00:00 to
// 11:00 UTC; pick the one that differs now and for the next ten minutes
// (the test's run time). Only in the last minutes before 00:00 UTC does
// neither qualify; Kiritimati is then the best effort.
const DIFFERS_FOR_MS = 10 * 60 * 1000;
function zoneOffUtcDay(): string {
  const now = new Date();
  const later = new Date(now.getTime() + DIFFERS_FOR_MS);
  const differs = (zone: string) =>
    [now, later].every((at) => longDayIn(zone, at) !== longDayIn("UTC", at));
  return (
    ["Pacific/Kiritimati", "Pacific/Pago_Pago"].find(differs) ??
    "Pacific/Kiritimati"
  );
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

    const chosenZone = zoneOffUtcDay();
    await select.selectOption(chosenZone);
    await expect(select).toHaveValue(chosenZone);
    await card.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(card.getByRole("status")).toHaveText("Zona horaria guardada.");

    await page.reload();
    await expect(
      page.getByTestId("time-zone-card").getByLabel("Zona horaria"),
    ).toHaveValue(chosenZone);
    expect(await profileTimeZoneOf(freshUser.id)).toBe(chosenZone);

    await sidebar.getByRole("link", { name: "Calendario" }).click();
    await expect(page).toHaveURL(/\/calendario$/);
    // The long day lives in the period block and the date badge beside the
    // page title (Phase 8 H3); on the default Hoy view the badge is today.
    const calendar = page.getByTestId("calendar-period");
    await expect(calendar).toContainText(longDayIn(chosenZone));
    await expect(
      page.locator('[data-slot="date-badge"] [data-part="day"]'),
    ).toHaveText(
      new Intl.DateTimeFormat("es", {
        day: "numeric",
        timeZone: chosenZone,
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
      "UTC (GMT+0)",
    );
  });
});
