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

// Every application table in public, parents before children (foreign-key
// order). A reversion test locks ALL of them, in this one order, before its
// down scripts run: DROP TABLE takes ACCESS EXCLUSIVE on the dropped table
// and locks on the tables it references, one statement at a time, so
// without this a down script picks up locks in its own order while another
// runner on the shared cogni-dev (a concurrent test:db, an e2e run) holds
// some of them — the deadlock CI hit in "reversion drops the four exam
// tables". Add a new table here when a migration creates one.
export const REVERSION_LOCK_ORDER = [
  "profiles",
  "notebooks",
  "pages",
  "page_assets",
  "import_jobs",
  "ai_generations",
  "flashcards",
  "study_items",
  "review_logs",
  "page_mastery",
  "flashcard_sessions",
  "session_feedback",
  "exam_questions",
  "exam_sessions",
  "exam_answers",
  "exam_page_state",
  "recall_questions",
  "recall_sessions",
  "recall_answers",
  "generation_fingerprints",
] as const;

// A waiting lock gives up after this instead of hanging the suite.
export const REVERSION_LOCK_TIMEOUT = "15s";

const REVERSION_ATTEMPTS = 3;

// deadlock_detected (40P01) and lock_not_available (55P03, lock_timeout).
function isLockConflict(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "40P01" || code === "55P03";
}

// Runs a migration reversal (and its assertions) in a rolled-back
// transaction that first takes every table lock in REVERSION_LOCK_ORDER
// with a bounded lock_timeout. The fixed order removes the deadlocks a
// down script can cause by itself; a peer transaction that already holds a
// row lock and then asks for a table this one holds can still form a
// cycle, and Postgres may abort either side. Only that case (40P01, or a
// lock wait past the timeout) is retried, at most twice, with a short
// pause: the transaction rolled back, so a retry starts clean. Assertion
// failures and every other error propagate at once.
export async function inRolledBackReversion(
  sql: postgres.Sql,
  work: (tx: postgres.TransactionSql) => Promise<void>,
): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await inRolledBackTx(sql, async (tx) => {
        await tx.unsafe(`set local lock_timeout = '${REVERSION_LOCK_TIMEOUT}'`);
        await tx.unsafe(
          `lock table ${REVERSION_LOCK_ORDER.join(", ")} in access exclusive mode`,
        );
        await work(tx);
      });
      return;
    } catch (error) {
      if (!isLockConflict(error) || attempt >= REVERSION_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}
