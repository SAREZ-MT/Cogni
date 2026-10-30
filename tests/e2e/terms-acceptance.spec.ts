import {
  expect,
  formAlert,
  hasSupabaseEnv,
  submitSignIn,
  test,
} from "./fixtures/auth";

// Consent before the account exists (feature legal-consent): a sign-in-wrap
// notice sits next to every account-creating button and links the public
// legal pages. The /terminos gate stays as the fallback for accounts with
// no recorded acceptance and for terms-version bumps.
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
    await expect(
      page.getByRole("link", { name: "Términos y condiciones" }),
    ).toHaveAttribute("href", "/legal/terminos");
  });

  test("shows the consent notice next to the sign-up and Google buttons on /register", async ({
    page,
  }) => {
    await page.goto("/register");

    const notice = page.getByTestId("sign-up-consent-notice");
    await expect(notice).toContainText(
      "Al crear tu cuenta o continuar con Google, aceptas los Términos y condiciones",
    );
    await expect(notice).toContainText("mayor de 18 años");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Crear cuenta" }),
    ).toHaveAttribute("aria-describedby", "sign-up-consent");
    await expect(
      page.getByRole("button", { name: "Continuar con Google" }),
    ).toHaveAttribute("aria-describedby", "sign-up-consent");

    await notice.getByRole("link", { name: "Política de privacidad" }).click();
    await expect(page).toHaveURL("/legal/privacidad");
  });

  test("shows the new-account notice next to the Google button on /login", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.getByTestId("sign-up-consent-notice")).toContainText(
      "Si continúas con Google y aún no tienes cuenta",
    );
  });

  test.describe("acceptance gate", () => {
    test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

    test("holds an account with no recorded acceptance until it accepts", async ({
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
        "Aceptaste la versión 2026-10-28",
      );
    });

    test("asks an account that accepted an older version to accept again", async ({
      page,
      staleTermsUser,
    }) => {
      await submitSignIn(page, staleTermsUser);
      await expect(page).toHaveURL(/\/terminos\?next=/);
      await expect(page.getByTestId("terms-accept-checkbox")).toBeVisible();
    });
  });
});
