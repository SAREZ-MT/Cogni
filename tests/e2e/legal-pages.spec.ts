import { expect, test } from "@playwright/test";

// Public legal pages (feature legal-consent L1): reachable without a
// session, with the draft notice and the section anchors the other
// documents link to.
const PAGES = [
  ["/legal/terminos", "Términos y condiciones de uso de Cogni"],
  ["/legal/privacidad", "Política de tratamiento de datos personales de Cogni"],
  [
    "/legal/uso-aceptable",
    "Política de uso aceptable y de inteligencia artificial de Cogni",
  ],
  ["/legal/derechos-de-autor", "Política de derechos de autor de Cogni"],
] as const;

test.describe("legal pages", () => {
  for (const [path, title] of PAGES) {
    test(`serves ${path} to an anonymous visitor`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(path);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      await expect(page.getByTestId("legal-draft-notice")).toBeVisible();
    });
  }

  test("jumps to the cookies and subencargados sections by anchor", async ({
    page,
  }) => {
    await page.goto("/legal/privacidad#cookies");
    await expect(page.locator("h2#cookies")).toBeInViewport();

    await page.goto("/legal/privacidad#subencargados");
    await expect(page.locator("h2#subencargados")).toBeInViewport();
  });
});
