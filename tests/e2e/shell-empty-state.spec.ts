import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";

// Task 2.6: the authenticated shell renders an empty state, the sidebar
// collapses and the choice survives navigation. Since PR3 the shell needs
// a session, so each test signs in with the worker's verified user.
test.describe("app shell", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test.beforeEach(async ({ page, verifiedUser }) => {
    await signIn(page, verifiedUser);
  });

  test("renders canvas, content area, sidebar and topbar with the declared sizes", async ({
    page,
  }) => {
    await page.goto("/");

    const body = page.locator("body");
    await expect(body).toHaveCSS("background-color", "rgb(237, 234, 228)");
    await expect(body).toHaveCSS("font-family", /DM.?Sans/i);

    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await expect(sidebar).toHaveCSS("width", "240px");

    const topbar = page.getByRole("banner");
    await expect(topbar).toHaveCSS("height", "52px");

    const content = page.getByTestId("content-area");
    await expect(content).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(content).toHaveCSS("border-top-left-radius", "20px");
  });

  test("shows only an empty state, no product features", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText("Aún no tienes cuadernos. Crea uno para empezar."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /cuadernos/i })).toHaveCount(0);
  });

  test("collapses the sidebar to 64px and keeps the choice after navigating", async ({
    page,
  }) => {
    await page.goto("/");

    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await page.getByRole("button", { name: "Contraer barra lateral" }).click();
    await expect(sidebar).toHaveCSS("width", "64px");
    await expect(sidebar.getByRole("link", { name: "Inicio" })).toBeVisible();

    await page.reload();
    await expect(sidebar).toHaveCSS("width", "64px");

    await page.getByRole("button", { name: "Expandir barra lateral" }).click();
    await expect(sidebar).toHaveCSS("width", "240px");
  });

  test("exposes sign-out inside the user menu", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Menú de usuario" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeVisible();
  });
});

test.describe("public auth layout", () => {
  test.skip(!hasSupabaseEnv, "Supabase env (cogni-dev) is not configured");

  test("renders the split panel with the declared backgrounds on desktop", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.getByTestId("public-panel-brand")).toHaveCSS(
      "background-color",
      "rgb(28, 25, 23)",
    );
    await expect(page.getByTestId("public-panel-form")).toHaveCSS(
      "background-color",
      "rgb(250, 250, 248)",
    );
    await expect(
      page.getByRole("button", { name: "Iniciar sesión" }),
    ).toHaveCSS("background-color", "rgb(28, 25, 23)");
  });

  test("submits credentials with POST and never through the URL", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill("ana@example.com");
    await page.getByLabel("Contraseña").fill("secreta123");

    const [request] = await Promise.all([
      page.waitForRequest((candidate) => candidate.url().includes("/login")),
      page.getByRole("button", { name: "Iniciar sesión" }).click(),
    ]);

    expect(request.method()).toBe("POST");
    expect(new URL(page.url()).search).toBe("");
    expect(page.url()).not.toContain("secreta123");
  });

  test("uses the full width without horizontal scroll on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/login");

    await expect(page.getByTestId("public-panel-brand")).toBeHidden();
    const form = page.getByTestId("public-panel-form");
    await expect(form).toBeVisible();
    const box = await form.boundingBox();
    expect(box?.width).toBe(375);

    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});

test.describe("security headers", () => {
  test("every page answers with the declared headers", async ({ page }) => {
    const response = await page.goto("/login");
    const headers = response?.headers() ?? {};
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["permissions-policy"]).toContain("camera=()");
  });
});
