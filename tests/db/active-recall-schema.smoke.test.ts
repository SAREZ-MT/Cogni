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

// Guards drizzle/0012_active_recall.sql (+ .down.sql): the CHECK
// constraints on rubrics, statuses and scores, the composite owner keys,
// the page cascade, RLS and the reversal. Every write runs in a
// rolled-back transaction.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("0012 active recall schema", () => {
  let owner: TestOwner | undefined;
  let otherOwner: TestOwner | undefined;
  const pageId = randomUUID();
  const notebookId = randomUUID();
  let position = 1;
  const sql = postgres(url as string, { prepare: false, max: 1 });

  function ownerId(): string {
    if (!owner) throw new Error("owner was not initialized by beforeAll");
    return owner.id;
  }

  function otherOwnerId(): string {
    if (!otherOwner) throw new Error("other owner was not initialized");
    return otherOwner.id;
  }

  async function insertQuestion(
    tx: postgres.TransactionSql,
    values: {
      rubric?: unknown;
      prompt?: string;
      origin?: string;
      page?: string;
      owner?: string;
    } = {},
  ): Promise<string> {
    const id = randomUUID();
    await tx`
      insert into recall_questions (id, owner_id, page_id, prompt, rubric, origin)
      values (${id}, ${values.owner ?? ownerId()}, ${values.page ?? pageId},
        ${values.prompt ?? "Explica la fotosíntesis"},
        ${tx.json((values.rubric ?? { keyConcepts: ["luz"], acceptableAnswerSummary: "Usa luz." }) as postgres.JSONValue)},
        ${values.origin ?? "manual"})
    `;
    return id;
  }

  async function insertSession(
    tx: postgres.TransactionSql,
    values: {
      page?: string;
      owner?: string;
      status?: string;
      finished?: boolean;
    } = {},
  ): Promise<string> {
    const id = randomUUID();
    await tx`
      insert into recall_sessions (id, owner_id, page_id, started_at, finished_at, evaluation_status)
      values (${id}, ${values.owner ?? ownerId()}, ${values.page ?? pageId}, now(),
        case when ${values.finished ?? false}::boolean then now() end,
        ${values.status ?? "pending"})
    `;
    return id;
  }

  function insertAnswer(
    tx: postgres.TransactionSql,
    values: {
      sessionId: string;
      questionId: string;
      owner?: string;
      selfRating?: number;
      status?: string;
      aiEvaluation?: unknown;
      aiScore?: number | null;
      combined?: number | null;
    },
  ) {
    const raw =
      values.aiEvaluation === undefined
        ? null
        : tx.json(values.aiEvaluation as postgres.JSONValue);
    return tx`
      insert into recall_answers (id, owner_id, session_id, question_id, answer_text,
        self_rating, evaluation_status, ai_evaluation, ai_score, combined_quality)
      values (${randomUUID()}, ${values.owner ?? ownerId()}, ${values.sessionId},
        ${values.questionId}, 'Usa la luz.', ${values.selfRating ?? 3},
        ${values.status ?? "pending"}, ${raw}, ${values.aiScore ?? null},
        ${values.combined ?? null})
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
    owner = await createTestOwner("recall-schema");
    otherOwner = await createTestOwner("recall-schema-other");
    await sql`insert into profiles (id) values (${ownerId()}), (${otherOwnerId()})`;
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
      if (otherOwner) await deleteTestOwner(otherOwner.id);
    } finally {
      await sql.end();
    }
  });

  it("accepts a question, a session and a pending answer", async () => {
    await inRolledBackTx(sql, async (tx) => {
      const questionId = await insertQuestion(tx);
      const sessionId = await insertSession(tx);
      await insertAnswer(tx, { sessionId, questionId });
    });
  });

  it("enables row level security on the three tables", async () => {
    const rows = await sql`
      select relname, relrowsecurity from pg_class
      where relname in ('recall_questions', 'recall_sessions', 'recall_answers')
      order by relname
    `;
    expect(rows.map((row) => [row.relname, row.relrowsecurity])).toEqual([
      ["recall_answers", true],
      ["recall_questions", true],
      ["recall_sessions", true],
    ]);
  });

  it.each([
    ["no key concepts", { keyConcepts: [], acceptableAnswerSummary: "x" }],
    ["no answer summary", { keyConcepts: ["luz"] }],
    [
      "a blank answer summary",
      { keyConcepts: ["luz"], acceptableAnswerSummary: " " },
    ],
    ["no key concepts list", { acceptableAnswerSummary: "x" }],
    [
      "key concepts that are not a list",
      { keyConcepts: "luz", acceptableAnswerSummary: "x" },
    ],
    ["a list instead of an object", ["luz"]],
  ])("refuses a rubric with %s", async (_label, rubric) => {
    await expectViolation(
      (tx) => insertQuestion(tx, { rubric }),
      "recall_questions_rubric_shape",
    );
  });

  it("refuses a blank prompt", async () => {
    await expectViolation(
      (tx) => insertQuestion(tx, { prompt: "   " }),
      "recall_questions_prompt_not_blank",
    );
  });

  it("refuses an unknown origin", async () => {
    await expectViolation(
      (tx) => insertQuestion(tx, { origin: "ai_variant" }),
      "recall_questions_origin_check",
    );
  });

  it("refuses an evaluated status on an open session", async () => {
    await expectViolation(
      (tx) => insertSession(tx, { status: "done" }),
      "recall_sessions_evaluation_status_check",
    );
  });

  it("refuses an unknown session status", async () => {
    await expectViolation(
      (tx) => insertSession(tx, { status: "failed", finished: true }),
      "recall_sessions_evaluation_status_check",
    );
  });

  it("refuses a session finished before it started", async () => {
    await expectViolation(
      (tx) => tx`
        insert into recall_sessions (id, owner_id, page_id, started_at, finished_at)
        values (${randomUUID()}, ${ownerId()}, ${pageId}, now(), now() - interval '1 minute')
      `,
      "recall_sessions_finished_after_start",
    );
  });

  it("refuses a self-rating outside 0..5", async () => {
    await expectViolation(async (tx) => {
      const questionId = await insertQuestion(tx);
      const sessionId = await insertSession(tx);
      await insertAnswer(tx, { sessionId, questionId, selfRating: 6 });
    }, "recall_answers_self_rating_range");
  });

  it("refuses an AI score outside 0..5", async () => {
    await expectViolation(async (tx) => {
      const questionId = await insertQuestion(tx);
      const sessionId = await insertSession(tx);
      await insertAnswer(tx, {
        sessionId,
        questionId,
        status: "done",
        aiEvaluation: {},
        aiScore: 6,
        combined: 3,
      });
    }, "recall_answers_ai_score_range");
  });

  it.each([
    [
      "a done answer without its score",
      { status: "done", aiEvaluation: {}, combined: 3 },
    ],
    [
      "a done answer without its raw evaluation",
      { status: "done", aiScore: 3, combined: 3 },
    ],
    [
      "a failed answer with a score",
      { status: "failed", aiEvaluation: {}, aiScore: 2 },
    ],
    ["a failed answer without its raw attempt", { status: "failed" }],
    ["a pending answer with a combined quality", { combined: 2 }],
    ["an unknown status", { status: "evaluating", aiEvaluation: {} }],
  ])("refuses %s", async (_label, values) => {
    await expectViolation(async (tx) => {
      const questionId = await insertQuestion(tx);
      const sessionId = await insertSession(tx);
      await insertAnswer(tx, { sessionId, questionId, ...values });
    }, "recall_answers_evaluation_check");
  });

  it("refuses a second answer to a question in one session", async () => {
    await expectViolation(async (tx) => {
      const questionId = await insertQuestion(tx);
      const sessionId = await insertSession(tx);
      await insertAnswer(tx, { sessionId, questionId });
      await insertAnswer(tx, { sessionId, questionId });
    }, "recall_answers_session_question_key");
  });

  it("refuses an answer on another owner's session", async () => {
    await expectViolation(async (tx) => {
      const questionId = await insertQuestion(tx);
      const sessionId = await insertSession(tx, { owner: otherOwnerId() });
      await insertAnswer(tx, { sessionId, questionId });
    }, "recall_answers_session_owner_fk");
  });

  it("refuses an answer to another owner's question", async () => {
    await expectViolation(async (tx) => {
      const questionId = await insertQuestion(tx, { owner: otherOwnerId() });
      const sessionId = await insertSession(tx);
      await insertAnswer(tx, { sessionId, questionId });
    }, "recall_answers_question_owner_fk");
  });

  it("deleting the page deletes its questions, sessions and answers", async () => {
    await inRolledBackTx(sql, async (tx) => {
      const page = randomUUID();
      await tx`
        insert into pages (id, owner_id, notebook_id, title, content, position)
        values (${page}, ${ownerId()}, ${notebookId}, 'Otra', ${tx.json({ type: "doc" })}, ${position++})
      `;
      const questionId = await insertQuestion(tx, { page });
      const sessionId = await insertSession(tx, { page });
      await insertAnswer(tx, { sessionId, questionId });

      await tx`delete from pages where id = ${page}`;

      const left = await tx`
        select (select count(*)::int from recall_questions where id = ${questionId}) as questions,
               (select count(*)::int from recall_sessions where id = ${sessionId}) as sessions,
               (select count(*)::int from recall_answers where session_id = ${sessionId}) as answers
      `;
      expect(left[0]).toEqual({ questions: 0, sessions: 0, answers: 0 });
    });
  });

  it("reversion drops the three recall tables", async () => {
    await inRolledBackReversion(sql, async (tx) => {
      await tx.unsafe(readDownSql("0012_active_recall"));
      const tables = await tx`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_name in (
          'recall_questions', 'recall_sessions', 'recall_answers', 'pages'
        )
      `;
      expect(tables.map((row) => row.table_name)).toEqual(["pages"]);
    });
  });
});
