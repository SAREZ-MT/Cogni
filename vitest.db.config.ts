import { defineConfig } from "vitest/config";

// Separate runner for tests that need a real database. `pnpm test` never
// includes them, so the unit suite stays hermetic.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
  },
});
