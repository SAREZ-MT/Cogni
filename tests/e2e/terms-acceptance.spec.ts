import {
  expect,
  formAlert,
  hasSupabaseEnv,
  submitSignIn,
  test,
} from "./fixtures/auth";

// The terms gate: an account without the current terms version is held on
// /terminos until it accepts; afterwards the page shows the stored version.
test.describe("terms of use", () => {
  test("serves the terms to an anonymous visitor", async ({ page }) => {
    const response = await page.goto("/terminos");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL("/terminos");
    await expect(
      page.getByRole("heading", { level: 1, name: "Términos de uso" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Iniciar sesión" }),
    ).toBeVisible();
  });

  test.describe("acceptance gate", () => {
    test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

    test("holds a new account on the terms until it accepts", async ({
      page,
      unacceptedUser,
    }) => {
      await submitSignIn(page, unacceptedUser);
      await expect(page).toHaveURL(/\/terminos\?next=/);

      await page.goto("/");
      await expect(page).toHaveURL(/\/terminos\?next=%2F$/);

      // Submitting without ticking the box is refused by the server.
      await page.getByTestId("terms-accept-submit").click();
      await expect(formAlert(page)).toContainText(
        "Debes aceptar los términos para continuar.",
      );
      await expect(page).toHaveURL(/\/terminos/);

      await page.getByTestId("terms-accept-checkbox").check();
      await page.getByTestId("terms-accept-submit").click();
      await expect(page).toHaveURL("/");

      await page.goto("/terminos");
      await expect(page.getByTestId("terms-accepted-state")).toBeVisible();
      await expect(page.getByTestId("terms-accepted-state")).toContainText(
        "Aceptaste la versión",
      );
    });
  });
});
