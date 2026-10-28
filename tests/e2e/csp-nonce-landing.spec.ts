import { expect, test } from "@playwright/test";

// The marketing pages render per request so their scripts carry the CSP
// nonce (src/app/(marketing)/layout.tsx). A prerendered /landing shipped
// nonce-less scripts that 'strict-dynamic' blocks under `next start`.
// Runs against the production server (playwright.config.ts webServer).
for (const path of ["/landing", "/ciencia", "/creditos"]) {
  test(`${path} stamps the response CSP nonce on every script`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    const csp = response?.headers()["content-security-policy"] ?? "";
    const nonce = csp.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
    expect(nonce, "script-src must carry a per-request nonce").toBeTruthy();

    const html = await response?.text();
    const tags = html?.match(/<script\b[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toContain(`nonce="${nonce}"`);
    }
  });
}

test("/landing hydrates without a script-src violation", async ({ page }) => {
  const violations: string[] = [];
  await page.exposeFunction("__onCspViolation", (directive: string) => {
    violations.push(directive);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (
        window as unknown as { __onCspViolation: (directive: string) => void }
      ).__onCspViolation(event.violatedDirective);
    });
  });

  await page.goto("/landing");
  const question = page.getByRole("button", {
    name: "¿Funciona en el celular?",
  });
  // The FAQ accordion is a client component: it only toggles once the
  // page's scripts have loaded and hydrated.
  await expect(async () => {
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass();
  expect(violations.filter((d) => d.startsWith("script-src"))).toEqual([]);
});
