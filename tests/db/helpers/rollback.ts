import { readFileSync } from "node:fs";
import path from "node:path";
import type postgres from "postgres";

// Shared by every DB smoke test that must exercise a statement (a
// migration's reversal, a race, a constraint) against real `cogni-dev`
// Postgres without leaving rows behind. Previously duplicated in
// import-jobs.smoke.test.ts and page-pdfs-storage.smoke.test.ts (T1
// follow-up: R2-dup-rollback-helper).
export class ForceRollback extends Error {}

// Runs `work` in a transaction that is always rolled back, swallowing
// only the sentinel `ForceRollback` this helper itself throws to trigger
// the rollback — any other error thrown by `work` still propagates.
export async function inRolledBackTx(
  sql: postgres.Sql,
  work: (tx: postgres.TransactionSql) => Promise<void>,
): Promise<void> {
  await sql
    .begin(async (tx) => {
      await work(tx);
      throw new ForceRollback();
    })
    .catch((error) => {
      if (!(error instanceof ForceRollback)) throw error;
    });
}

// Reads a migration's `.down.sql` reversal file from the repo's `drizzle/`
// directory (drizzle-kit has no built-in `down` command, so these are
// hand-written and run directly against Postgres in smoke tests).
export function readDownSql(migration: string): string {
  return readFileSync(
    path.join(process.cwd(), "drizzle", `${migration}.down.sql`),
    "utf8",
  );
}
