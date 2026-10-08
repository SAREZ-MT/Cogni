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
    await expect(content).toHaveCSS("border-top-left-radius", "16px");
  });

  // Scenario "Reescritura de shell-empty-state.spec.ts"
  // (specs/design-tokens-and-shell/spec.md): a fresh owner without
  // notebooks sees the empty-state message and a control to create the
  // first one. Since design pass 2 the sidebar is navigation only, so both
  // live in Home's content area (the "Nuevo cuaderno" pill, whose dialog
  // confirms with "Crear cuaderno").
  test("home shows the empty state and a control to create the first notebook", async ({
    page,
    freshUser,
  }) => {
    // The worker user may already own notebooks created by other specs in
    // the same worker, so this scenario signs in as a brand-new owner. The
    // beforeEach session must go first: the proxy keeps a signed-in user
    // away from /login.
    await page.context().clearCookies();
    await signIn(page, freshUser);
    await page.goto("/");

    const content = page.getByTestId("content-area");
    await expect(
      content.getByText("Aún no tienes cuadernos. Crea uno para empezar."),
    ).toBeVisible();
    await expect(
      content.getByRole("button", { name: "Nuevo cuaderno" }),
    ).toBeVisible();

    // The sidebar no longer carries the notebook tree or its empty state.
    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await expect(
      sidebar.getByText("Aún no tienes cuadernos. Crea uno para empezar."),
    ).toHaveCount(0);
  });

  // Design previews (Dashboard, Active recall) are hidden in production
  // builds, which is what this suite runs against (`next build && next
  // start`): they render as disabled "pronto" rows instead of links.
  // Flashcards (Phase 3) and Exámenes (Phase 5 T9) run on real data, so
  // they are always live links.
  test("sidebar lists the preview areas as disabled 'pronto' entries", async ({
    page,
  }) => {
    await page.goto("/");

    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await expect(
      sidebar.getByRole("link", { name: "Flashcards" }),
    ).toHaveAttribute("href", "/flashcards");
    await expect(
      sidebar.getByRole("link", { name: "Exámenes" }),
    ).toHaveAttribute("href", "/exams");
    for (const label of ["Dashboard", "Active recall"]) {
      await expect(sidebar.getByRole("link", { name: label })).toHaveCount(0);
      await expect(
        sidebar.locator('[aria-disabled="true"]').filter({ hasText: label }),
      ).toContainText("pronto");
    }
    await expect(
      sidebar.getByRole("link", { name: "Cuadernos" }),
    ).toHaveAttribute("href", "/notebooks");
  });

  // Phase 3: /flashcards serves the user's real decks and never the sample
  // data; the sample notebook and player routes stay not-found in production
  // builds. The verified user is shared by the worker, so another spec may
  // already have generated a deck: assert the real hub, not the empty state.
  test("serves /flashcards on real data and hides the sample flashcards routes", async ({
    page,
  }) => {
    const hub = await page.goto("/flashcards");
    expect(hub?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Flashcards" }),
    ).toBeVisible();
    await expect(page.getByText("Estudiar ahora")).toHaveCount(0);
    await expect(page.getByText("Biología Celular")).toHaveCount(0);

    for (const path of [
      "/flashcards/biologia-celular",
      "/flashcards/biologia-celular/session?deck=mitocondria-semana-3",
    ]) {
      const response = await page.goto(path);

      expect(response?.status(), path).toBe(404);
      await expect(page.getByText("Estudiar ahora")).toHaveCount(0);
      await expect(page.getByText("Biología Celular")).toHaveCount(0);
    }
  });

  // Phase 6 T7: /active-recall serves the user's real sessions and never the
  // sample data; the sample notebook/page slugs are not real ids, so every
  // former preview path answers not-found.
  test("serves /active-recall on real data and hides the sample recall routes", async ({
    page,
  }) => {
    const hub = await page.goto("/active-recall");
    expect(hub?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Active recall" }),
    ).toBeVisible();
    await expect(page.getByText("Biología Celular")).toHaveCount(0);
    await expect(page.getByText("Vista previa")).toHaveCount(0);

    for (const path of [
      "/active-recall/biologia-celular",
      "/active-recall/biologia-celular/mitocondria",
      "/active-recall/biologia-celular/mitocondria/resultados?sesion=x",
    ]) {
      const response = await page.goto(path);

      expect(response?.status(), path).toBe(404);
      await expect(page.getByText("Active recall — Biología")).toHaveCount(0);
      await expect(page.getByText("Pregunta 1 de")).toHaveCount(0);
      await expect(page.getByText("Sesiones por página")).toHaveCount(0);
    }
  });

  // Phase 5 T9: /exams serves the user's real exam pages and never the
  // sample data; the sample notebook/page slugs are not real ids, so every
  // other former preview path answers not-found.
  test("serves /exams on real data and hides the sample exams routes", async ({
    page,
  }) => {
    const hub = await page.goto("/exams");
    expect(hub?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Exámenes" }),
    ).toBeVisible();
    await expect(page.getByText("Biología Celular")).toHaveCount(0);
    await expect(page.getByText("Mitocondria")).toHaveCount(0);

    for (const path of [
      "/exams/biologia-celular",
      "/exams/biologia-celular/mitocondria",
      "/exams/biologia-celular/mitocondria?retake=1",
      "/exams/biologia-celular/mitocondria?retake=1&variantes=error",
      "/exams/biologia-celular/mitocondria/resultados",
      "/exams/biologia-celular/mitocondria/preguntas",
    ]) {
      const response = await page.goto(path);

      expect(response?.status(), path).toBe(404);
      await expect(page.getByText("Biología Celular")).toHaveCount(0);
      await expect(page.getByText("Pregunta 1 de")).toHaveCount(0);
      await expect(page.getByText("Nueva pregunta")).toHaveCount(0);
      await expect(
        page.getByText("Revisión pregunta por pregunta"),
      ).toHaveCount(0);
    }
  });

  test("hides the dashboard preview route: /dashboard answers not-found", async ({
    page,
  }) => {
    for (const path of ["/dashboard", "/dashboard?range=30"]) {
      const response = await page.goto(path);

      expect(response?.status(), path).toBe(404);
      await expect(page.getByText("Actividad de repaso")).toHaveCount(0);
      await expect(page.getByText("Tasa de acierto")).toHaveCount(0);
      await expect(page.getByText("Dominio global")).toHaveCount(0);
    }
  });

  test("collapses the sidebar to 64px and keeps the choice after navigating", async ({
    page,
  }) => {
    await page.goto("/");

    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await page.getByRole("button", { name: "Contraer barra lateral" }).click();
    await expect(sidebar).toHaveCSS("width", "64px");

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

test.describe("keep-alive", () => {
  test("is not redirected by the session proxy and rejects a missing bearer", async ({
    request,
  }) => {
    const response = await request.get("/api/keep-alive", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(401);
  });
});
