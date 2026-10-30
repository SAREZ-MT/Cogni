import postgres from "postgres";

// Direct recall question seeding (Phase 8 H16): questions are created by AI
// only, so a spec that needs them without calling a provider writes them
// straight into the database, each with its study item due now — the same
// rows a generation saves (origin "ai"; no audited generation, no session).

export async function seedRecallQuestions(
  pageId: string,
  prompts: readonly string[],
): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  try {
    for (const prompt of prompts) {
      await sql`
        with question as (
          insert into recall_questions (id, owner_id, page_id, prompt, rubric,
                                        origin)
          select gen_random_uuid(), p.owner_id, p.id, ${prompt},
                 ${sql.json({ keyConcepts: ["ATP"], acceptableAnswerSummary: "ATP." })},
                 'ai'
          from pages p
          where p.id = ${pageId}
          returning id, owner_id, page_id
        )
        insert into study_items (id, owner_id, page_id, kind, source_id, due_at)
        select gen_random_uuid(), owner_id, page_id, 'recall_question', id,
               now()
        from question
      `;
    }
  } finally {
    await sql.end();
  }
}
