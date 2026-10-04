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
  // Always 1, in CI and locally: the webServer above is a single `next
  // start` process, and its Postgres client is created with `max: 1`
  // (src/shared/db/client.ts), so more than one worker hitting it at once
  // starves that one connection and tests fail non-deterministically.
  workers: 1,
  // Every authenticated flow talks to the real cogni-dev Supabase project
  // over the network, and the acceptance flows chain several Server
  // Actions and reloads (or an 11 MB upload). Playwright's default 30 s
  // per test is too tight for them on a home connection.
  timeout: 60_000,
  // Same reason for the assertion timeout: a Server Action's effect (a new
  // sidebar item, an autosave status) can take more than the default 5 s
  // to show up when the single Postgres connection is busy.
  expect: { timeout: 10_000 },
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
    // Never hit real AI providers from e2e, even if .env.local has keys.
    env: { AI_PROVIDER_MODE: process.env.AI_PROVIDER_MODE ?? "fake" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
