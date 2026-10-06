import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MASTERY_LEVEL_VALUES,
  REVIEW_SESSION_KINDS,
  SESSION_FEEDBACK_STATUSES,
  STUDY_ITEM_KINDS,
} from "@/shared/db/schema";
import {
  ForceRollback,
  inRolledBackReversion,
  inRolledBackTx,
  readDownSql,
} from "./helpers/rollback";
import {
  createTestOwner,
  deleteTestOwner,
  type TestOwner,
} from "./helpers/test-owner";

// Guards drizzle/0009_study_engine.sql (+ .down.sql): the study_items
// backfill, the constraints the repositories rely on and the reversion.
const url = process.env.DATABASE_URL;

// The hand-written backfill statement, exactly as the migration runs it.
function readBackfillSql(): string {
  const migration = readFileSync(
    path.join(process.cwd(), "drizzle", "0009_study_engine.sql"),
    "utf8",
  );
  const match = migration.match(
    /-- backfill:study_items:start\n([\s\S]*?)-- backfill:study_items:end/,
  );
  if (!match?.[1]) throw new Error("backfill markers missing in 0009");
  return match[1];
}

// Returns the name of the constraint the statement violated, or null.
async function violatedConstraint(
  sql: postgres.Sql,
  work: (tx: postgres.TransactionSql) => Promise<unknown>,
): Promise<string | null> {
  try {
    await sql.begin(async (tx) => {
      await work(tx);
      throw new ForceRollback();
    });
    return null;
  } catch (error) {
    if (error instanceof ForceRollback) return null;
    return (error as postgres.PostgresError).constraint_name ?? null;
  }
}

async function checkValues(sql: postgres.Sql, name: string) {
  const [constraint] = await sql`
    select pg_get_constraintdef(oid) as definition
    from pg_constraint where conname = ${name}
  `;
  return new Set(
    [...String(constraint?.definition ?? "").matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    ),
  );
}

describe.skipIf(!url)("0009 study_engine schema", () => {
  let owner: TestOwner | undefined;
  const pageId = randomUUID();
  const sql = postgres(url as string, { prepare: false, max: 1 });

  function ownerId(): string {
    if (!owner) throw new Error("owner was not initialized by beforeAll");
    return owner.id;
  }

  function insertCard(
    tx: postgres.TransactionSql,
    values: { id: string; createdAt: Date; archivedAt?: Date },
  ) {
    return tx`
      insert into flashcards (id, owner_id, page_id, front, back, origin, position, created_at, archived_at)
      values (
        ${values.id}, ${ownerId()}, ${pageId}, 'Frente', 'Reverso', 'manual', 0,
        ${values.createdAt}, ${values.archivedAt ?? null}
      )
    `;
  }

  function insertItem(
    tx: postgres.TransactionSql,
    values: { sourceId?: string; easiness?: number; lastQuality?: number },
  ) {
    return tx`
      insert into study_items (id, owner_id, page_id, kind, source_id, easiness, due_at, last_quality)
      values (
        ${randomUUID()}, ${ownerId()}, ${pageId}, 'flashcard',
        ${values.sourceId ?? randomUUID()}, ${values.easiness ?? 2.5}, now(),
        ${values.lastQuality ?? null}
      )
    `;
  }

  beforeAll(async () => {
    owner = await createTestOwner("study-engine-schema");
    const notebookId = randomUUID();
    await sql`insert into profiles (id) values (${ownerId()})`;
    await sql`
      insert into notebooks (id, owner_id, title, position)
      values (${notebookId}, ${ownerId()}, 'Cuaderno', 0)
    `;
    await sql`
      insert into pages (id, owner_id, notebook_id, title, content, position)
      values (${pageId}, ${ownerId()}, ${notebookId}, 'Página', ${sql.json({ type: "doc" })}, 0)
    `;
  });

  afterAll(async () => {
    try {
      if (owner) await deleteTestOwner(owner.id);
    } finally {
      await sql.end();
    }
  });

  it("backfills one due-now item per non-archived flashcard, re-runnably", async () => {
    await inRolledBackTx(sql, async (tx) => {
      const liveId = randomUUID();
      const archivedId = randomUUID();
      const createdAt = new Date("2026-09-30T12:00:00.000Z");
      await insertCard(tx, { id: liveId, createdAt });
      await insertCard(tx, {
        id: archivedId,
        createdAt,
        archivedAt: new Date("2026-10-01T00:00:00.000Z"),
      });

      await tx.unsafe(readBackfillSql());
      await tx.unsafe(readBackfillSql());

      const items = await tx`
        select source_id, owner_id, page_id, kind, easiness, interval_days,
               repetitions, lapses, due_at, last_quality, last_reviewed_at,
               suspended_at
        from study_items where source_id in (${liveId}, ${archivedId})
      `;
      expect(items).toEqual([
        {
          source_id: liveId,
          owner_id: ownerId(),
          page_id: pageId,
          kind: "flashcard",
          easiness: 2.5,
          interval_days: 0,
          repetitions: 0,
          lapses: 0,
          due_at: createdAt,
          last_quality: null,
          last_reviewed_at: null,
          suspended_at: null,
        },
      ]);
    });
  });

  it("rejects a second study item for the same source", async () => {
    const sourceId = randomUUID();
    const constraint = await violatedConstraint(sql, async (tx) => {
      await insertItem(tx, { sourceId });
      await insertItem(tx, { sourceId });
    });
    expect(constraint).toBe("study_items_kind_source_key");
  });

  it("rejects easiness below 1.3", async () => {
    expect(
      await violatedConstraint(sql, (tx) => insertItem(tx, { easiness: 1.2 })),
    ).toBe("study_items_easiness_min");
  });

  it("rejects a last quality outside 0..5", async () => {
    expect(
      await violatedConstraint(sql, (tx) => insertItem(tx, { lastQuality: 6 })),
    ).toBe("study_items_last_quality_range");
  });

  it("allows one session feedback per session", async () => {
    const sessionId = randomUUID();
    const constraint = await violatedConstraint(sql, async (tx) => {
      for (let i = 0; i < 2; i++) {
        await tx`
          insert into session_feedback (id, owner_id, session_kind, session_id)
          values (${randomUUID()}, ${ownerId()}, 'flashcards', ${sessionId})
        `;
      }
    });
    expect(constraint).toBe("session_feedback_session_key");
  });

  it("keeps the CHECK value lists equal to the schema tuples", async () => {
    expect(await checkValues(sql, "study_items_kind_check")).toEqual(
      new Set(STUDY_ITEM_KINDS),
    );
    expect(await checkValues(sql, "review_logs_session_kind_check")).toEqual(
      new Set(REVIEW_SESSION_KINDS),
    );
    expect(await checkValues(sql, "page_mastery_level_check")).toEqual(
      new Set(MASTERY_LEVEL_VALUES),
    );
    expect(await checkValues(sql, "session_feedback_status_check")).toEqual(
      new Set(SESSION_FEEDBACK_STATUSES),
    );
  });

  it("cascades: deleting a page deletes its study items and their logs", async () => {
    await inRolledBackTx(sql, async (tx) => {
      const itemId = randomUUID();
      await tx`
        insert into study_items (id, owner_id, page_id, kind, source_id, due_at)
        values (${itemId}, ${ownerId()}, ${pageId}, 'flashcard', ${randomUUID()}, now())
      `;
      await tx`
        insert into review_logs (id, owner_id, item_id, quality, reviewed_at,
          interval_before, interval_after, easiness_after, session_kind, session_id)
        values (${randomUUID()}, ${ownerId()}, ${itemId}, 4, now(), 0, 1, 2.5, 'flashcards', ${randomUUID()})
      `;
      await tx`delete from pages where id = ${pageId}`;
      const [counts] = await tx`
        select
          (select count(*)::int from study_items where id = ${itemId}) as items,
          (select count(*)::int from review_logs where item_id = ${itemId}) as logs
      `;
      expect(counts).toEqual({ items: 0, logs: 0 });
    });
  });

  it("reversion drops the study-engine tables and flashcards.archived_at", async () => {
    await inRolledBackReversion(sql, async (tx) => {
      await tx.unsafe(readDownSql("0009_study_engine"));

      const tables = await tx`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_name in (
          'study_items', 'review_logs', 'page_mastery', 'flashcard_sessions',
          'session_feedback', 'flashcards'
        )
      `;
      expect(tables.map((row) => row.table_name)).toEqual(["flashcards"]);
      const archived = await tx`
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'flashcards'
          and column_name = 'archived_at'
      `;
      expect(archived).toHaveLength(0);
    });
  });
});
