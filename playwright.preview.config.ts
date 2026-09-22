import nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Same .env.local Next.js reads, so PREVIEW_URL and the bypass secret can
// live there instead of the shell. @next/env is CommonJS, hence the default import.
nextEnv.loadEnvConfig(process.cwd());

// Runs the e2e specs against an already-deployed URL (a Vercel preview)
// instead of the local `next build && next start` webServer.
// Usage:
//   PREVIEW_URL=https://<deployment>.vercel.app \
//   VERCEL_AUTOMATION_BYPASS_SECRET=<secret> \
//   pnpm exec playwright test tests/e2e/csp-nonce.spec.ts --config playwright.preview.config.ts
const baseURL = process.env.PREVIEW_URL;
if (!baseURL) {
  throw new Error(
    "PREVIEW_URL is required (the deployment URL to test against)",
  );
}

// Vercel Deployment Protection: the bypass secret goes in a request header
// and the second header asks Vercel to also set a bypass cookie for the
// browser context, so later navigations stay authorized.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHTTPHeaders: Record<string, string> = bypassSecret
  ? {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    }
  : {};

export default defineConfig({
  testDir: "./tests/e2e",
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    extraHTTPHeaders,
    trace: "retain-on-failure",
  },
});
