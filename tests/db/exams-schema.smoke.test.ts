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

// Guards drizzle/0010_exams.sql (+ .down.sql): the CHECK constraints that
// keep a question's options, lineage and a session's result consistent, and
// the reversal. Every write runs in a rolled-back transaction.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("0010 exams schema", () => {
  let owner: TestOwner | undefined;
  const pageId = randomUUID();
  const notebookId = randomUUID();
  let position = 1;
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
      pageId?: string;
    },
  ) {
    const id = values.id ?? randomUUID();
    return tx`
      insert into exam_questions (id, owner_id, page_id, stem, options, correct_index,
        explanation, concept, root_id, variant_of, origin)
      values (${id}, ${ownerId()}, ${values.pageId ?? pageId}, '¿Pregunta?',
        ${tx.json(values.options ?? ["A", "B", "C", "D"])}, 0, '', 'Concepto',
        ${values.rootId ?? id}, ${values.variantOf ?? null}, 'manual')
    `;
  }

  async function insertPage(tx: postgres.TransactionSql): Promise<string> {
    const id = randomUUID();
    await tx`
      insert into pages (id, owner_id, notebook_id, title, content, position)
      values (${id}, ${ownerId()}, ${notebookId}, 'Otra página', ${tx.json({ type: "doc" })}, ${position++})
    `;
    return id;
  }

  // A root, its variant v1 and v1's replacement v2 on `page`.
  async function insertLineage(tx: postgres.TransactionSql, page: string) {
    const root = randomUUID();
    const v1 = randomUUID();
    const v2 = randomUUID();
    await insertQuestion(tx, { id: root, pageId: page });
    await insertQuestion(tx, {
      id: v1,
      rootId: root,
      variantOf: root,
      pageId: page,
    });
    await insertQuestion(tx, {
      id: v2,
      rootId: root,
      variantOf: v1,
      pageId: page,
    });
    return { root, v1, v2 };
  }

  function insertAnswer(
    tx: postgres.TransactionSql,
    values: { sessionId: string; questionId: string; rootId: string },
  ) {
    return tx`
      insert into exam_answers (owner_id, session_id, question_id, root_id,
        selected_index, is_correct, answered_at)
      values (${ownerId()}, ${values.sessionId}, ${values.questionId},
        ${values.rootId}, 0, false, now())
    `;
  }

  async function insertSession(
    tx: postgres.TransactionSql,
    page: string,
  ): Promise<string> {
    const id = randomUUID();
    await tx`
      insert into exam_sessions (id, owner_id, page_id, requested_count, question_ids, started_at)
      values (${id}, ${ownerId()}, ${page}, 10, '["q"]'::jsonb, now())
    `;
    return id;
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

  it("refuses a variant on another page than its root", async () => {
    await expectViolation(async (tx) => {
      const rootId = randomUUID();
      await insertQuestion(tx, { id: rootId });
      await insertQuestion(tx, {
        rootId,
        variantOf: rootId,
        pageId: await insertPage(tx),
      });
    }, "exam_questions_root_fk");
  });

  it("refuses a variant replacing a question of another lineage", async () => {
    await expectViolation(async (tx) => {
      const a = randomUUID();
      const b = randomUUID();
      await insertQuestion(tx, { id: a });
      await insertQuestion(tx, { id: b });
      await insertQuestion(tx, { rootId: a, variantOf: b });
    }, "exam_questions_variant_of_fk");
  });

  it("refuses deleting a replaced question: questions are retired, not deleted", async () => {
    await expectViolation(async (tx) => {
      const { v1 } = await insertLineage(tx, pageId);
      await tx`delete from exam_questions where id = ${v1}`;
    }, "exam_questions_variant_of_fk");
  });

  it("refuses deleting a root that still has variants", async () => {
    await expectViolation(async (tx) => {
      const { root, v1, v2 } = await insertLineage(tx, pageId);
      // Without its replacements, only the root reference remains.
      await tx`update exam_questions set retired_at = now() where id in (${v1}, ${v2})`;
      await tx`delete from exam_questions where id = ${root}`;
    }, "exam_questions_root_fk");
  });

  it("deleting the page deletes the whole lineage, its sessions and answers", async () => {
    await inRolledBackTx(sql, async (tx) => {
      const page = await insertPage(tx);
      const { root, v1, v2 } = await insertLineage(tx, page);
      const sessionId = await insertSession(tx, page);
      await insertAnswer(tx, { sessionId, questionId: v2, rootId: root });

      await tx`delete from pages where id = ${page}`;

      const left = await tx`
        select (select count(*)::int from exam_questions where id in (${root}, ${v1}, ${v2})) as questions,
               (select count(*)::int from exam_sessions where id = ${sessionId}) as sessions,
               (select count(*)::int from exam_answers where session_id = ${sessionId}) as answers
      `;
      expect(left[0]).toEqual({ questions: 0, sessions: 0, answers: 0 });
    });
  });

  it("refuses an answer whose root is not its question's root", async () => {
    await expectViolation(async (tx) => {
      const { root: otherRoot } = await insertLineage(tx, pageId);
      const { v1 } = await insertLineage(tx, pageId);
      const sessionId = await insertSession(tx, pageId);
      await insertAnswer(tx, { sessionId, questionId: v1, rootId: otherRoot });
    }, "exam_answers_question_root_fk");
  });

  it("refuses a requested count outside 10..30", async () => {
    await expectViolation(
      (tx) => tx`
        insert into exam_sessions (id, owner_id, page_id, requested_count, question_ids, started_at)
        values (${randomUUID()}, ${ownerId()}, ${pageId}, 9, '["q"]'::jsonb, now())
      `,
      "exam_sessions_requested_count_range",
    );
  });

  it("refuses a finished session without its result", async () => {
    await expectViolation(
      (tx) => tx`
        insert into exam_sessions (id, owner_id, page_id, requested_count, question_ids, started_at, finished_at)
        values (${randomUUID()}, ${ownerId()}, ${pageId}, 10, '["q"]'::jsonb, now(), now())
      `,
      "exam_sessions_result_check",
    );
  });

  it("refuses a session without its question list", async () => {
    await inRolledBackTx(sql, async (tx) => {
      await expect(
        tx`
          insert into exam_sessions (id, owner_id, page_id, requested_count, started_at)
          values (${randomUUID()}, ${ownerId()}, ${pageId}, 10, now())
        `,
      ).rejects.toMatchObject({ code: "23502", column_name: "question_ids" });
    });
  });

  it.each([
    ["an empty list", "[]"],
    [
      "more ids than requested",
      JSON.stringify(Array.from({ length: 11 }, (_, n) => `q${n}`)),
    ],
    ["an object instead of a list", '{"q": 1}'],
  ])("refuses a question list with %s", async (_label, questionIds) => {
    await expectViolation(
      (tx) => tx`
        insert into exam_sessions (id, owner_id, page_id, requested_count, question_ids, started_at)
        values (${randomUUID()}, ${ownerId()}, ${pageId}, 10, ${questionIds}::jsonb, now())
      `,
      "exam_sessions_question_ids_check",
    );
  });

  it("reverting 0011 drops the question list and its check", async () => {
    await inRolledBackReversion(sql, async (tx) => {
      await tx.unsafe(readDownSql("0011_exam_session_questions"));
      const columns = await tx`
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'exam_sessions'
          and column_name = 'question_ids'
      `;
      expect(columns).toEqual([]);
    });
  });

  it("reversion drops the four exam tables", async () => {
    await inRolledBackReversion(sql, async (tx) => {
      await tx.unsafe(readDownSql("0011_exam_session_questions"));
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
