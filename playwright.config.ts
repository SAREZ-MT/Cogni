import nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Same .env.local Next.js reads, so fixtures can reach the Supabase admin API.
// @next/env is CommonJS, hence the default import.
nextEnv.loadEnvConfig(process.cwd());

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

// Playwright covers the 3-5 critical end-to-end flows (see documento-maestro
// §4.4). It never runs against jsdom: it drives a real Chromium browser
// against a real running Next.js server.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    // favicon.ico bypasses the proxy, so readiness never depends on Supabase env.
    url: `${baseURL}/favicon.ico`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
