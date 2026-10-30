import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";

// landing-v1 T5: the landing is the domain root. An anonymous visitor on /
// reads it; a signed-in visitor asking for / is sent to Inicio (/inicio) by
// the proxy, and the old /landing address redirects permanently to /. A
// signed-in visitor may still read /ciencia, whose nav, back link, closing
// and footer all offer the app instead of the landing.
test.describe("landing at the domain root", () => {
  test("an anonymous visitor on / sees the landing", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Principal" }),
    ).toBeVisible();
  });

  test("the old /landing address redirects to /", async ({ page }) => {
    const response = await page.request.get("/landing", { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe("/");
  });

  test.describe("signed in", () => {
    test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

    test("a signed-in visitor on / lands on Inicio", async ({
      page,
      verifiedUser,
    }) => {
      await signIn(page, verifiedUser);

      await page.goto("/");

      await expect(page).toHaveURL("/inicio");
      await expect(page.getByTestId("content-area")).toBeVisible();
    });

    test("a signed-in visitor on /ciencia stays there with Ir a la app", async ({
      page,
      verifiedUser,
    }) => {
      await signIn(page, verifiedUser);

      await page.goto("/ciencia");

      await expect(page).toHaveURL("/ciencia");
      const nav = page.getByRole("navigation", { name: "Principal" });
      await expect(
        nav.getByRole("link", { name: "Ir a la app" }),
      ).toHaveAttribute("href", "/inicio");
      await expect(
        nav.getByRole("link", { name: "Cómo funciona" }),
      ).toHaveCount(0);
    });

    test("a signed-in visitor on /ciencia gets app links in the footer and closing", async ({
      page,
      verifiedUser,
    }) => {
      await signIn(page, verifiedUser);

      await page.goto("/ciencia");

      const footer = page.getByRole("contentinfo");
      await expect(
        footer.getByRole("link", { name: "Ir a la app" }),
      ).toHaveAttribute("href", "/inicio");
      await expect(footer.locator('a[href^="/#"]')).toHaveCount(0);
      await expect(page.locator('a[href^="/#"], a[href="/"]')).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Volver a la app" }),
      ).toHaveAttribute("href", "/inicio");
    });
  });
});
