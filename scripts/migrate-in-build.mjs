#!/usr/bin/env node
// Gate for package.json#build: only run drizzle-kit migrate on a real
// production build. Preview builds (and local dev builds) must never touch
// a database, since Vercel Preview builds run for every branch and share
// whatever DATABASE_URL is configured for the Preview scope.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Pure predicate, unit-tested directly: true only for a Vercel production
// build, or when the escape hatch RUN_DB_MIGRATIONS=1 is set explicitly
// (used to migrate locally against cogni-dev without a full deploy).
export function shouldRunMigrations(env) {
  return env.VERCEL_ENV === "production" || env.RUN_DB_MIGRATIONS === "1";
}

function isMain() {
  // Compare resolved file:// URLs (not a raw string concat) so paths with
  // spaces or other characters that get percent-encoded still match.
  return (
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
  );
}

if (isMain()) {
  if (shouldRunMigrations(process.env)) {
    console.log(
      "migrate-in-build: running drizzle-kit migrate (VERCEL_ENV=production)",
    );
    const result = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
      stdio: "inherit",
    });
    // Fail closed: propagate drizzle-kit's exit status (or a non-zero
    // status if the process itself could not start) so the build fails.
    process.exit(result.status ?? 1);
  } else {
    console.log(
      `migrate-in-build: skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`,
    );
    process.exit(0);
  }
}
