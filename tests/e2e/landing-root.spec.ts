import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";

// landing-v1 T5: the landing is the domain root. An anonymous visitor on /
// reads it; a signed-in visitor asking for / is sent to Inicio (/inicio) by
// the proxy, and the old /landing address redirects permanently to /.
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
  });
});
