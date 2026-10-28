import type { Page } from "@playwright/test";
import { expect, hasSupabaseEnv, signIn, test } from "./fixtures/auth";

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

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
    await page.goto("/inicio");

    const body = page.locator("body");
    await expect(body).toHaveCSS("background-color", "rgb(232, 232, 232)");
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
  // notebooks sees the empty state and a control to create the first one.
  // Since Phase 8 H2-T3 it is the "Tu inicio está vacío por ahora" screen:
  // one primary "Crea tu primer cuaderno" (whose dialog confirms with
  // "Crear cuaderno"), the "Ver tutorial" link and three static previews.
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
    await page.goto("/inicio");

    const content = page.getByTestId("content-area");
    await expect(
      content.getByRole("heading", {
        level: 1,
        name: "Tu inicio está vacío por ahora",
      }),
    ).toBeVisible();
    const create = content.getByRole("button", {
      name: "Crea tu primer cuaderno",
    });
    await expect(create).toBeVisible();
    await expect(create).toHaveAttribute("data-tour", "crear-cuaderno");
    await expect(
      content.getByRole("button", { name: "Ver tutorial", exact: true }),
    ).toBeVisible();
    await expect(
      content
        .getByRole("region", { name: "Lo que verás aquí" })
        .getByRole("heading", { level: 3 }),
    ).toHaveText(["Para hoy", "Continúa donde lo dejaste", "Temas débiles"]);

    await create.click();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Crear cuaderno" }),
    ).toBeVisible();

    // The sidebar no longer carries the notebook tree or its empty state.
    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await expect(
      sidebar.getByText("Tu inicio está vacío por ahora"),
    ).toHaveCount(0);
  });

  // Phase 8 H4-T1 (user-approved mockup 2026-10-20): a brand-new owner's
  // /notebooks shows the illustrated invitation, without the old
  // "Biblioteca" eyebrow, and its CTA opens the create-notebook dialog.
  test("notebooks hub shows the illustrated empty state for a new owner", async ({
    page,
    freshUser,
  }) => {
    await page.context().clearCookies();
    await signIn(page, freshUser);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/notebooks");

    const content = page.getByTestId("content-area");
    await expect(
      content.getByRole("heading", { level: 1, name: "Cuadernos" }),
    ).toBeVisible();
    await expect(content.getByText("Aún no tienes cuadernos")).toBeVisible();
    await expect(content.getByText("Biblioteca")).toHaveCount(0);
    await expect(
      content.getByRole("heading", {
        name: "Todas tus materias, en un solo lugar",
      }),
    ).toBeVisible();
    // Scoped to the empty state: the breadcrumb is a list too.
    const empty = content.locator('[data-slot="illustrated-empty-state"]');
    await expect(empty.getByRole("listitem")).toHaveText([
      "1Crea un cuaderno por materia",
      "2Escribe o importa tus apuntes",
      "3Repasa con las técnicas",
    ]);
    // Phase 8 H4-T3: a CSS notebook fan instead of an illustration.
    await expect(empty.locator('[data-slot="notebook-fan"]')).toBeVisible();
    await expect(empty.locator("img")).toHaveCount(0);
    await shot(page, "real-1440");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
      empty.getByRole("button", { name: "Crear mi primer cuaderno" }),
    ).toBeVisible();
    await shot(page, "real-390");

    await empty
      .getByRole("button", { name: "Crear mi primer cuaderno" })
      .click();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Crear cuaderno" }),
    ).toBeVisible();
  });

  // Every sidebar area runs on real data, so each one is a live link:
  // Flashcards (Phase 3), Exámenes (Phase 5 T9), Active recall (Phase 6 T7),
  // Calendario (Phase 7 T1), Configuración (Phase 7 T2a) and Dashboard
  // (Phase 7 T4). No disabled "pronto" row is left.
  test("sidebar lists every area as a live link", async ({ page }) => {
    await page.goto("/inicio");

    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await expect(
      sidebar.getByRole("link", { name: "Flashcards" }),
    ).toHaveAttribute("href", "/flashcards");
    await expect(
      sidebar.getByRole("link", { name: "Exámenes" }),
    ).toHaveAttribute("href", "/exams");
    await expect(
      sidebar.getByRole("link", { name: "Recordación activa" }),
    ).toHaveAttribute("href", "/active-recall");
    // Phase 7 T1: the old "Horarios" row is the live "Calendario" entry.
    await expect(
      sidebar.getByRole("link", { name: "Calendario" }),
    ).toHaveAttribute("href", "/calendario");
    // Phase 7 T2a: "Configuración" is a live entry (time-zone setting).
    await expect(
      sidebar.getByRole("link", { name: /Configuración/ }),
    ).toHaveAttribute("href", "/configuracion");
    // Phase 7 T4: "Progreso" runs on analytics data.
    await expect(
      sidebar.getByRole("link", { name: "Progreso", exact: true }),
    ).toHaveAttribute("href", "/dashboard");
    await expect(sidebar.locator('[aria-disabled="true"]')).toHaveCount(0);
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
      page.getByRole("heading", { level: 1, name: "Recordación activa" }),
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
      await expect(page.getByText("Recordación activa — Biología")).toHaveCount(
        0,
      );
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

  // Phase 7 T4: /dashboard is no longer a hidden design preview; it serves
  // the user's analytics (content is covered by dashboard.spec.ts).
  test("serves /dashboard instead of hiding it as a preview", async ({
    page,
  }) => {
    const response = await page.goto("/dashboard");

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Progreso", level: 1 }),
    ).toBeVisible();
  });

  test("collapses the sidebar to 64px and keeps the choice after navigating", async ({
    page,
  }) => {
    await page.goto("/inicio");

    const sidebar = page.getByRole("navigation", { name: "Barra lateral" });
    await page.getByRole("button", { name: "Contraer barra lateral" }).click();
    await expect(sidebar).toHaveCSS("width", "64px");

    await page.reload();
    await expect(sidebar).toHaveCSS("width", "64px");

    await page.getByRole("button", { name: "Expandir barra lateral" }).click();
    await expect(sidebar).toHaveCSS("width", "240px");
  });

  test("exposes sign-out inside the user menu", async ({ page }) => {
    await page.goto("/inicio");

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
      "rgb(245, 243, 239)",
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
    await page.getByLabel("Contraseña", { exact: true }).fill("secreta123");

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
