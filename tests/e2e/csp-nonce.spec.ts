import { expect, test } from "./fixtures/auth";

// Requirement "Nonces de CSP" (specs/observability-and-delivery/spec.md),
// Scenario "Script en línea sin nonce rechazado": with CSP nonces active,
// the browser must reject an inline script that does not carry the
// request's nonce. Runs against the real Next.js production server
// (playwright.config.ts webServer: `next build && next start`), never
// against a preview deployment — the "against preview" part of task 8a.4
// is a manual follow-up (see apply-progress.md, Pendiente — (usuario)).
test.describe("CSP nonce", () => {
  test("the response CSP carries a per-request nonce and no 'unsafe-inline' for scripts", async ({
    page,
  }) => {
    const response = await page.goto("/login");
    const csp = response?.headers()["content-security-policy"] ?? "";
    const scriptSrc =
      csp.split("; ").find((directive) => directive.startsWith("script-src")) ??
      "";

    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  test("an inline script without the correct nonce is blocked by the CSP and never executes", async ({
    page,
  }) => {
    // page.evaluate() runs through the DevTools Protocol (Runtime.evaluate),
    // which Chromium treats as a trusted execution context: a <script>
    // element it creates and appends would run even under 'strict-dynamic',
    // proving nothing about the CSP the server actually sent. Real HTML
    // parsing is required, so this intercepts the real navigation response
    // (same headers, same per-request nonce) and appends a raw, nonce-less
    // <script> to its body before the browser's own HTML parser sees it —
    // exactly the attack the Requirement describes.
    await page.route("**/login", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const withoutNonceScript = body.replace(
        "</body>",
        '<script>window.__cspNonceMarker = "executed-without-nonce";</script></body>',
      );
      await route.fulfill({ response, body: withoutNonceScript });
    });

    const violatedDirectives: string[] = [];
    await page.exposeFunction(
      "__onCspViolation",
      (violatedDirective: string) => {
        violatedDirectives.push(violatedDirective);
      },
    );
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        (
          window as unknown as {
            __onCspViolation: (directive: string) => void;
          }
        ).__onCspViolation(event.violatedDirective);
      });
    });

    await page.goto("/login");

    await expect
      .poll(() => violatedDirectives.length, {
        message: "expected a securitypolicyviolation event for script-src",
      })
      .toBeGreaterThan(0);
    expect(
      violatedDirectives.some((directive) =>
        directive.startsWith("script-src"),
      ),
    ).toBe(true);

    const executed = await page.evaluate(
      () =>
        (window as unknown as { __cspNonceMarker?: string }).__cspNonceMarker,
    );
    expect(executed).toBeUndefined();
  });
});
