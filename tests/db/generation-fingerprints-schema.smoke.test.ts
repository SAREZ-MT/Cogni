import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  inRolledBackReversion,
  inRolledBackTx,
  readDownSql,
} from "./helpers/rollback";
import {
  createTestOwner,
  deleteTestOwner,
  type TestOwner,
} from "./helpers/test-owner";

// Guards drizzle/0013_generation_fingerprints.sql (+ .down.sql): the
// technique and fingerprint CHECKs, the unique (page, owner, technique,
// fingerprint) key, the page cascade, RLS and the reversal. Every write
// runs in a rolled-back transaction.
const url = process.env.DATABASE_URL;

const FINGERPRINT = "0".repeat(63).concat("a");

describe.skipIf(!url)("0013 generation fingerprints schema", () => {
  let owner: TestOwner | undefined;
  const pageId = randomUUID();
  const notebookId = randomUUID();
  const sql = postgres(url as string, { prepare: false, max: 1 });

  function ownerId(): string {
    if (!owner) throw new Error("owner was not initialized by beforeAll");
    return owner.id;
  }

  function insertFingerprint(
    tx: postgres.TransactionSql,
    values: { technique?: string; fingerprint?: string; page?: string } = {},
  ) {
    return tx`
      insert into generation_fingerprints (owner_id, page_id, technique, fingerprint)
      values (${ownerId()}, ${values.page ?? pageId},
        ${values.technique ?? "flashcards"}, ${values.fingerprint ?? FINGERPRINT})
    `;
  }

  async function expectViolation(
    work: (tx: postgres.TransactionSql) => Promise<unknown>,
    constraint: string,
  ) {
    await inRolledBackTx(sql, async (tx) => {
      await expect(work(tx)).rejects.toMatchObject({
        constraint_name: constraint,
      });
    });
  }

  beforeAll(async () => {
    owner = await createTestOwner("fingerprints-schema");
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

  it("accepts one fingerprint per technique of a page", async () => {
    await inRolledBackTx(sql, async (tx) => {
      await insertFingerprint(tx, { technique: "flashcards" });
      await insertFingerprint(tx, { technique: "exam" });
      await insertFingerprint(tx, { technique: "recall" });
      const rows = await tx`
        select technique, created_at from generation_fingerprints
        where page_id = ${pageId} order by technique
      `;
      expect(rows.map((row) => row.technique)).toEqual([
        "exam",
        "flashcards",
        "recall",
      ]);
      expect(rows[0].created_at).toBeInstanceOf(Date);
    });
  });

  it("enables row level security", async () => {
    const [row] = await sql`
      select relrowsecurity from pg_class where relname = 'generation_fingerprints'
    `;
    expect(row.relrowsecurity).toBe(true);
  });

  it("refuses an unknown technique", async () => {
    await expectViolation(
      (tx) => insertFingerprint(tx, { technique: "quiz" }),
      "generation_fingerprints_technique_check",
    );
  });

  it.each([
    ["too short", "abc"],
    ["upper case", "A".repeat(64)],
    ["not hex", "g".repeat(64)],
  ])("refuses a fingerprint that is %s", async (_label, fingerprint) => {
    await expectViolation(
      (tx) => insertFingerprint(tx, { fingerprint }),
      "generation_fingerprints_fingerprint_format",
    );
  });

  it("refuses the same fingerprint twice for a technique of a page", async () => {
    await expectViolation(async (tx) => {
      await insertFingerprint(tx);
      await insertFingerprint(tx);
    }, "generation_fingerprints_pkey");
  });

  it("deleting the page deletes its fingerprints", async () => {
    await inRolledBackTx(sql, async (tx) => {
      const otherPage = randomUUID();
      await tx`
        insert into pages (id, owner_id, notebook_id, title, content, position)
        values (${otherPage}, ${ownerId()}, ${notebookId}, 'Otra', ${tx.json({ type: "doc" })}, 1)
      `;
      await insertFingerprint(tx, { page: otherPage });
      await tx`delete from pages where id = ${otherPage}`;
      const rows = await tx`
        select 1 from generation_fingerprints where page_id = ${otherPage}
      `;
      expect(rows).toHaveLength(0);
    });
  });

  it("reversion drops the table and keeps pages", async () => {
    await inRolledBackReversion(sql, async (tx) => {
      await tx.unsafe(readDownSql("0013_generation_fingerprints"));
      const tables = await tx`
        select table_name from information_schema.tables
        where table_schema = 'public'
          and table_name in ('generation_fingerprints', 'pages')
      `;
      expect(tables.map((row) => row.table_name)).toEqual(["pages"]);
    });
  });
});
