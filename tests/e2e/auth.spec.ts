import {
  createVerifiedUser,
  deleteUserByEmail,
  expect,
  formAlert,
  hasSupabaseEnv,
  signIn,
  test,
  uniqueEmail,
} from "./fixtures/auth";

test.describe("authentication", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test("sends an anonymous visitor from the shell to /login", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/login");
  });

  test("registers, asks for verification and refuses login until verified", async ({
    page,
  }) => {
    const email = uniqueEmail("unverified");
    try {
      await page.goto("/register");
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByLabel("Contraseña", { exact: true }).fill("Secreta-123");
      await page.getByRole("button", { name: "Crear cuenta" }).click();
      await expect(page.getByRole("status")).toContainText(
        "Te enviamos un correo de verificación",
      );

      await page.goto("/login");
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByLabel("Contraseña", { exact: true }).fill("Secreta-123");
      await page.getByRole("button", { name: "Iniciar sesión" }).click();
      await expect(formAlert(page)).toContainText(
        "Aún no has verificado tu correo",
      );
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("offers sign-in for an email that already exists", async ({
    page,
    verifiedUser,
  }) => {
    await page.goto("/register");
    await page.getByLabel("Correo electrónico").fill(verifiedUser.email);
    await page.getByLabel("Contraseña", { exact: true }).fill("Otra-clave-123");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(formAlert(page)).toContainText("El email ya está registrado");
  });

  test("rejects a wrong password without revealing whether the email exists", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill("nadie@cogni-e2e.test");
    await page.getByLabel("Contraseña", { exact: true }).fill("Secreta-123");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(formAlert(page)).toContainText(
      "El correo o la contraseña no son correctos",
    );
  });

  test("logs a verified user in, keeps them out of /login, and signs out", async ({
    page,
  }) => {
    const user = await createVerifiedUser();
    try {
      await signIn(page, user);
      // Home's content area shows the empty-state copy (the sidebar is
      // navigation only since design pass 2); scoping to it keeps the
      // assertion independent of any other surface that may repeat the copy.
      await expect(
        page
          .getByTestId("content-area")
          .getByText("Aún no tienes cuadernos. Crea uno para empezar."),
      ).toBeVisible();

      await page.goto("/login");
      await expect(page).toHaveURL("/");

      await page.getByRole("button", { name: "Menú de usuario" }).click();
      await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
      await expect(page).toHaveURL("/login");

      await page.goto("/");
      await expect(page).toHaveURL("/login");
    } finally {
      await deleteUserByEmail(user.email);
    }
  });

  test("starts the Google OAuth flow from the login screen", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Continuar con Google" }).click();

    await page.waitForURL(/provider=google|accounts\.google\.com/);
  });

  test("answers a password reset request without revealing the account", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Correo electrónico").fill("nadie@cogni-e2e.test");
    await page.getByRole("button", { name: "Enviar enlace" }).click();

    await expect(page.getByRole("status")).toContainText("Si el correo existe");
  });

  test("sends a callback without code back to login with the invalid-link message", async ({
    page,
  }) => {
    await page.goto("/auth/callback?next=//evil.tld");

    await expect(page).toHaveURL(/\/login\?error=link$/);
    await expect(
      page.getByText("El enlace no es válido o ya venció. Pide uno nuevo."),
    ).toBeVisible();
  });

  test("sends a Google callback without code back to login with the Google message", async ({
    page,
    context,
    baseURL,
  }) => {
    // signInWithGoogleAction marks the Google flow with this cookie (the
    // redirect URL itself carries no marker).
    await context.addCookies([
      {
        name: "cogni_auth_flow",
        value: "google",
        url: new URL("/auth/callback", baseURL).toString(),
      },
    ]);
    await page.goto("/auth/callback");

    await expect(page).toHaveURL(/\/login\?error=google$/);
    await expect(
      page.getByText("No se completó el acceso con Google"),
    ).toBeVisible();
  });
});
