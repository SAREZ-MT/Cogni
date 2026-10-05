import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inRolledBackTx, readDownSql } from "./helpers/rollback";
import {
  createTestOwner,
  deleteTestOwner,
  type TestOwner,
} from "./helpers/test-owner";

// Guards drizzle/0010_exams.sql (+ .down.sql): the CHECK constraints that
// keep a question's options, lineage and a session's result consistent, and
// the reversal. Every write runs in a rolled-back transaction.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("0010 exams schema", () => {
  let owner: TestOwner | undefined;
  const pageId = randomUUID();
  const sql = postgres(url as string, { prepare: false, max: 1 });

  function ownerId(): string {
    if (!owner) throw new Error("owner was not initialized by beforeAll");
    return owner.id;
  }

  function insertQuestion(
    tx: postgres.TransactionSql,
    values: {
      id?: string;
      rootId?: string;
      variantOf?: string | null;
      options?: string[];
    },
  ) {
    const id = values.id ?? randomUUID();
    return tx`
      insert into exam_questions (id, owner_id, page_id, stem, options, correct_index,
        explanation, concept, root_id, variant_of, origin)
      values (${id}, ${ownerId()}, ${pageId}, '¿Pregunta?',
        ${tx.json(values.options ?? ["A", "B", "C", "D"])}, 0, '', 'Concepto',
        ${values.rootId ?? id}, ${values.variantOf ?? null}, 'manual')
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
    owner = await createTestOwner("exams-schema");
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

  it("accepts an original that is its own root", async () => {
    await inRolledBackTx(sql, async (tx) => {
      await insertQuestion(tx, {});
    });
  });

  it("refuses three options", async () => {
    await expectViolation(
      (tx) => insertQuestion(tx, { options: ["A", "B", "C"] }),
      "exam_questions_options_count",
    );
  });

  it("refuses an original pointing at another root", async () => {
    await expectViolation(async (tx) => {
      const rootId = randomUUID();
      await insertQuestion(tx, { id: rootId });
      await insertQuestion(tx, { rootId, variantOf: null });
    }, "exam_questions_lineage_check");
  });

  it("refuses a requested count outside 10..30", async () => {
    await expectViolation(
      (tx) => tx`
        insert into exam_sessions (id, owner_id, page_id, requested_count, started_at)
        values (${randomUUID()}, ${ownerId()}, ${pageId}, 9, now())
      `,
      "exam_sessions_requested_count_range",
    );
  });

  it("refuses a finished session without its result", async () => {
    await expectViolation(
      (tx) => tx`
        insert into exam_sessions (id, owner_id, page_id, requested_count, started_at, finished_at)
        values (${randomUUID()}, ${ownerId()}, ${pageId}, 10, now(), now())
      `,
      "exam_sessions_result_check",
    );
  });

  it("reversion drops the four exam tables", async () => {
    await inRolledBackTx(sql, async (tx) => {
      await tx.unsafe(readDownSql("0010_exams"));
      const tables = await tx`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_name in (
          'exam_questions', 'exam_sessions', 'exam_answers', 'exam_page_state', 'pages'
        )
      `;
      expect(tables.map((row) => row.table_name)).toEqual(["pages"]);
    });
  });
});
