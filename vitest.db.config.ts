import path from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = import.meta.dirname;

// Separate runner for tests that need a real database. `pnpm test` never
// includes them, so the unit suite stays hermetic. Same "@/" alias as
// vitest.config.ts so DB tests can import repositories/schema the same way
// application code does.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    // DB tests share one physical `cogni-dev` database and some of them
    // (orphan-guard.smoke.test.ts) assert on the total row count of
    // auth.users; running files in parallel races that assertion against
    // the notebooks/page repository tests, which create and delete real
    // auth users as fixtures. Sequential execution keeps the suite
    // deterministic without giving up real-Postgres coverage.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
});
