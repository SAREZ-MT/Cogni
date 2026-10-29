import { randomUUID } from "node:crypto";
import postgres from "postgres";

// Direct exam question seeding (Phase 8 H13): questions are created by AI
// only, so a spec that needs questions without calling a provider writes
// them straight into the database, each a lineage root (root_id = id) with
// its study item due now, the same rows the exams use cases save. They
// default to origin "manual" (no audited generation, as the domain wants
// of a question without a generation id), which also stands for the rows
// written by hand before H13 that must keep working.

export interface SeedQuestion {
  stem: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  concept: string;
  explanation?: string;
}

// Adds `questions` to the page, owned by the page's owner; returns their ids.
export async function seedExamQuestions(
  pageId: string,
  questions: readonly SeedQuestion[],
): Promise<string[]> {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  const ids: string[] = [];
  try {
    for (const question of questions) {
      const id = randomUUID();
      await sql`
        with question as (
          insert into exam_questions (id, owner_id, page_id, stem, options,
                                      correct_index, explanation, concept,
                                      root_id, origin)
          select ${id}, p.owner_id, p.id, ${question.stem},
                 ${sql.json(question.options)}, ${question.correctIndex},
                 ${question.explanation ?? ""}, ${question.concept}, ${id},
                 'manual'
          from pages p
          where p.id = ${pageId}
          returning id, owner_id, page_id
        )
        insert into study_items (id, owner_id, page_id, kind, source_id, due_at)
        select gen_random_uuid(), owner_id, page_id, 'exam_question', id, now()
        from question
      `;
      ids.push(id);
    }
  } finally {
    await sql.end();
  }
  return ids;
}
