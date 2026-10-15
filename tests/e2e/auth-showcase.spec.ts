import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/auth";

// The login brand panel draws a Three.js constellation (AuthShowcase →
// ConstellationCanvas). These checks pin its robustness: whatever happens to
// the WebGL context, the sign-in form keeps working, the panel shows either
// the live scene ("ready") or the static gradient, and remounts never pile
// up live WebGL contexts (Chrome caps them per process).
//
// SwiftShader gives headless Chromium a software WebGL implementation, on
// macOS and in Linux CI alike, so "ready" is deterministic. Scoped to this
// spec only.
test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
  viewport: { width: 1440, height: 900 },
});

const showcase = (page: Page) => page.getByTestId("public-showcase");

async function webglSupported(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  });
}

async function expectUsableForm(page: Page) {
  const email = page.getByLabel("Correo electrónico");
  const password = page.getByLabel("Contraseña");
  await expect(email).toBeVisible();
  await email.fill("nadie@cogni-e2e.test");
  await password.fill("Secreta-123");
  await expect(email).toHaveValue("nadie@cogni-e2e.test");
  await expect(password).toHaveValue("Secreta-123");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión" }),
  ).toBeEnabled();
}

// Counts WebGL contexts created by this document that are still alive.
async function countLiveContexts(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __liveWebGL: () => number }).__liveWebGL(),
  );
}

test.describe("auth showcase", () => {
  test("every reload of /login renders the form and the scene", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/login");
    const expected = (await webglSupported(page)) ? "ready" : "unavailable";
    // On a developer Mac with SwiftShader this must be the live scene.
    if (process.platform === "darwin") expect(expected).toBe("ready");

    for (let i = 0; i < 20; i++) {
      if (i > 0) await page.reload();
      await expect(showcase(page)).toHaveAttribute(
        "data-canvas-state",
        expected,
      );
      await expectUsableForm(page);
    }
  });

  test("a lost WebGL context falls back to the gradient and recovers", async ({
    page,
  }) => {
    await page.goto("/login");
    test.skip(!(await webglSupported(page)), "WebGL unavailable here");
    await expect(showcase(page)).toHaveAttribute("data-canvas-state", "ready");
    const canvas = showcase(page).locator("canvas");
    // A corner with no glass card: only the gradient plus the scene.
    const corner = { x: 560, y: 40, width: 150, height: 150 };

    await page.evaluate(() => {
      const element = document.querySelector<HTMLCanvasElement>(
        '[data-testid="public-showcase"] canvas',
      );
      const gl =
        element?.getContext("webgl2") ?? element?.getContext("webgl") ?? null;
      const extension = gl?.getExtension("WEBGL_lose_context") ?? null;
      (window as unknown as { __loseExt: unknown }).__loseExt = extension;
      extension?.loseContext();
    });

    await expect(showcase(page)).toHaveAttribute("data-canvas-state", "lost");
    await expectUsableForm(page);
    // Fallback visible: the faded-out canvas leaves the static gradient,
    // whose pixels no longer change.
    await expect(canvas.locator("..")).toHaveClass(/opacity-0/);
    await page.waitForTimeout(700);
    const lostA = await page.screenshot({ clip: corner });
    await page.waitForTimeout(300);
    const lostB = await page.screenshot({ clip: corner });
    expect(lostA.equals(lostB)).toBe(true);

    await page.evaluate(() =>
      (
        window as unknown as {
          __loseExt: { restoreContext: () => void } | null;
        }
      ).__loseExt?.restoreContext(),
    );

    await expect(showcase(page)).toHaveAttribute("data-canvas-state", "ready");
    await expect(canvas.locator("..")).toHaveClass(/opacity-100/);
    // The restored context draws again (geometries and shaders re-uploaded).
    await page.waitForTimeout(1800);
    const restored = await page.screenshot({ clip: corner });
    expect(restored.equals(lostA)).toBe(false);
    await expectUsableForm(page);
  });

  test("navigating and remounting never grows the live WebGL contexts", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      const contexts: Array<WebGLRenderingContext | WebGL2RenderingContext> =
        [];
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        const context = (
          original as (...args: unknown[]) => RenderingContext | null
        ).call(this, type, ...rest);
        if (
          context &&
          type.startsWith("webgl") &&
          !contexts.includes(context as WebGLRenderingContext)
        ) {
          contexts.push(context as WebGLRenderingContext);
        }
        return context;
      } as typeof original;
      (window as unknown as { __liveWebGL: () => number }).__liveWebGL = () =>
        contexts.filter((context) => !context.isContextLost()).length;
    });

    await page.goto("/login");
    test.skip(!(await webglSupported(page)), "WebGL unavailable here");
    await expect(showcase(page)).toHaveAttribute("data-canvas-state", "ready");
    await expect.poll(() => countLiveContexts(page)).toBe(1);

    for (let round = 0; round < 3; round++) {
      await page.getByRole("link", { name: "Crea una" }).click();
      await expect(page).toHaveURL("/register");
      await page.getByRole("link", { name: "Inicia sesión" }).click();
      await expect(page).toHaveURL("/login");
      await page
        .getByRole("link", { name: "¿Olvidaste tu contraseña?" })
        .click();
      await expect(page).toHaveURL("/forgot-password");
      await page.getByRole("link", { name: "Volver a iniciar sesión" }).click();
      await expect(page).toHaveURL("/login");
      await expect(showcase(page)).toHaveAttribute(
        "data-canvas-state",
        "ready",
      );
      await expect.poll(() => countLiveContexts(page)).toBe(1);
    }

    // Narrow then widen: the canvas unmounts and remounts in the same
    // document; the old context must be released every time.
    for (let round = 0; round < 5; round++) {
      await page.setViewportSize({ width: 600, height: 900 });
      await expect(showcase(page)).toHaveAttribute(
        "data-canvas-state",
        "disabled",
      );
      await expect.poll(() => countLiveContexts(page)).toBe(0);
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(showcase(page)).toHaveAttribute(
        "data-canvas-state",
        "ready",
      );
      await expect.poll(() => countLiveContexts(page)).toBe(1);
    }
    await expectUsableForm(page);
  });
});
