import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ForceRollback, inRolledBackTx } from "./helpers/rollback";
import {
  createTestOwner,
  deleteTestOwner,
  type TestOwner,
} from "./helpers/test-owner";

// Guards drizzle/0016_owner_scoped_page_keys.sql (security-hardening S6b):
// the database refuses a page whose owner is not its notebook's, and a row
// under a page whose owner is not the page's, while consistent rows and the
// page cascade keep working.
const url = process.env.DATABASE_URL;

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

describe.skipIf(!url)("0016 owner-scoped page keys", () => {
  let owner: TestOwner | undefined;
  let other: TestOwner | undefined;
  const notebookId = randomUUID();
  const pageId = randomUUID();
  const sql = postgres(url as string, { prepare: false, max: 1 });

  function ownerId(): string {
    if (!owner) throw new Error("test owner missing");
    return owner.id;
  }

  function otherId(): string {
    if (!other) throw new Error("second test owner missing");
    return other.id;
  }

  function insertPage(
    tx: postgres.TransactionSql,
    values: { id: string; ownerId: string; notebookId: string },
  ) {
    return tx`
      insert into pages (id, owner_id, notebook_id, title, content, position)
      values (${values.id}, ${values.ownerId}, ${values.notebookId},
        'Página', '{"type":"doc","content":[]}'::jsonb, 2)
    `;
  }

  function insertAsset(tx: postgres.TransactionSql, rowOwnerId: string) {
    return tx`
      insert into page_assets (id, owner_id, page_id, storage_path, mime, size_bytes)
      values (${randomUUID()}, ${rowOwnerId}, ${pageId},
        ${`${rowOwnerId}/${randomUUID()}.png`}, 'image/png', 10)
    `;
  }

  function insertFlashcard(tx: postgres.TransactionSql, rowOwnerId: string) {
    return tx`
      insert into flashcards (id, owner_id, page_id, front, back, origin, position)
      values (${randomUUID()}, ${rowOwnerId}, ${pageId}, 'Frente', 'Reverso',
        'manual', 1)
    `;
  }

  function insertStudyItem(tx: postgres.TransactionSql, rowOwnerId: string) {
    return tx`
      insert into study_items (id, owner_id, page_id, kind, source_id, due_at)
      values (${randomUUID()}, ${rowOwnerId}, ${pageId}, 'flashcard',
        ${randomUUID()}, now())
    `;
  }

  function insertFlashcardSession(
    tx: postgres.TransactionSql,
    values: { ownerId: string; pageId: string | null },
  ) {
    return tx`
      insert into flashcard_sessions (id, owner_id, page_id, started_at)
      values (${randomUUID()}, ${values.ownerId}, ${values.pageId}, now())
    `;
  }

  beforeAll(async () => {
    owner = await createTestOwner("owner-scoped-keys");
    other = await createTestOwner("owner-scoped-keys-other");
    await sql`insert into profiles (id) values (${owner.id}), (${other.id})`;
    await sql`
      insert into notebooks (id, owner_id, title, position)
      values (${notebookId}, ${owner.id}, 'Cuaderno', 1)
    `;
    await sql`
      insert into pages (id, owner_id, notebook_id, title, content, position)
      values (${pageId}, ${owner.id}, ${notebookId}, 'Página',
        '{"type":"doc","content":[]}'::jsonb, 1)
    `;
  });

  afterAll(async () => {
    if (owner) await deleteTestOwner(owner.id);
    if (other) await deleteTestOwner(other.id);
    await sql.end();
  });

  it("rejects a page whose owner is not its notebook's owner", async () => {
    const violated = await violatedConstraint(sql, (tx) =>
      insertPage(tx, { id: randomUUID(), ownerId: otherId(), notebookId }),
    );

    expect(violated).toBe("pages_notebook_owner_fk");
  });

  it("rejects a page asset whose owner is not its page's owner", async () => {
    const violated = await violatedConstraint(sql, (tx) =>
      insertAsset(tx, otherId()),
    );

    expect(violated).toBe("page_assets_page_owner_fk");
  });

  it("rejects a flashcard whose owner is not its page's owner", async () => {
    const violated = await violatedConstraint(sql, (tx) =>
      insertFlashcard(tx, otherId()),
    );

    expect(violated).toBe("flashcards_page_owner_fk");
  });

  it("rejects a study item whose owner is not its page's owner", async () => {
    const violated = await violatedConstraint(sql, (tx) =>
      insertStudyItem(tx, otherId()),
    );

    expect(violated).toBe("study_items_page_owner_fk");
  });

  it("rejects a flashcard session on another owner's page, but not one without a page", async () => {
    const onForeignPage = await violatedConstraint(sql, (tx) =>
      insertFlashcardSession(tx, { ownerId: otherId(), pageId }),
    );
    const withoutPage = await violatedConstraint(sql, (tx) =>
      insertFlashcardSession(tx, { ownerId: otherId(), pageId: null }),
    );

    expect(onForeignPage).toBe("flashcard_sessions_page_owner_fk");
    expect(withoutPage).toBeNull();
  });

  it("rejects moving an existing row to another owner", async () => {
    const violated = await violatedConstraint(sql, async (tx) => {
      await insertFlashcard(tx, ownerId());
      await tx`
        update flashcards set owner_id = ${otherId()} where page_id = ${pageId}
      `;
    });

    expect(violated).toBe("flashcards_page_owner_fk");
  });

  it("accepts a page and its rows when every owner matches", async () => {
    await inRolledBackTx(sql, async (tx) => {
      await insertPage(tx, {
        id: randomUUID(),
        ownerId: ownerId(),
        notebookId,
      });
      await insertAsset(tx, ownerId());
      await insertFlashcard(tx, ownerId());
      await insertStudyItem(tx, ownerId());
      await insertFlashcardSession(tx, { ownerId: ownerId(), pageId });

      const [row] = await tx`
        select
          (select count(*)::int from pages where notebook_id = ${notebookId}) as pages,
          (select count(*)::int from page_assets where page_id = ${pageId}) as assets,
          (select count(*)::int from flashcards where page_id = ${pageId}) as flashcards,
          (select count(*)::int from study_items where page_id = ${pageId}) as study_items,
          (select count(*)::int from flashcard_sessions where page_id = ${pageId}) as sessions
      `;
      expect(row).toEqual({
        pages: 2,
        assets: 1,
        flashcards: 1,
        study_items: 1,
        sessions: 1,
      });
    });
  });

  it("still removes a page's rows when the page is deleted", async () => {
    await inRolledBackTx(sql, async (tx) => {
      await insertAsset(tx, ownerId());
      await insertFlashcard(tx, ownerId());
      await insertStudyItem(tx, ownerId());
      await insertFlashcardSession(tx, { ownerId: ownerId(), pageId });

      await tx`delete from pages where id = ${pageId}`;

      const [row] = await tx`
        select
          (select count(*)::int from page_assets where page_id = ${pageId}) as assets,
          (select count(*)::int from flashcards where page_id = ${pageId}) as flashcards,
          (select count(*)::int from study_items where page_id = ${pageId}) as study_items,
          (select count(*)::int from flashcard_sessions where page_id = ${pageId}) as sessions
      `;
      expect(row).toEqual({
        assets: 0,
        flashcards: 0,
        study_items: 0,
        sessions: 0,
      });
    });
  });

  it("still removes a notebook's pages when the notebook is deleted", async () => {
    await inRolledBackTx(sql, async (tx) => {
      await tx`delete from notebooks where id = ${notebookId}`;

      const [row] = await tx`
        select count(*)::int as pages from pages where id = ${pageId}
      `;
      expect(row).toEqual({ pages: 0 });
    });
  });
});
