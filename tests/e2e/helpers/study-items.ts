import postgres from "postgres";

// Direct study_items seeding for read-only views (the calendar's "Hoy" tab,
// Home's due count). scheduling only reads study_items — it never joins the
// technique tables — so a row with a fresh source id is enough to make a
// technique due on a page without generating real content through the UI.

export type DueKind = "flashcard" | "exam_question" | "recall_question";

function connect() {
  return postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
}

// Inserts `count` items of each kind on the page, due a minute ago, owned by
// the page's owner.
export async function seedDueItems(
  pageId: string,
  counts: Partial<Record<DueKind, number>>,
): Promise<void> {
  const sql = connect();
  try {
    for (const [kind, count] of Object.entries(counts)) {
      if (!count) continue;
      await sql`
        insert into study_items (id, owner_id, page_id, kind, source_id, due_at)
        select gen_random_uuid(), p.owner_id, p.id, ${kind}, gen_random_uuid(),
               now() - interval '1 minute'
        from pages p, generate_series(1, ${count}::int)
        where p.id = ${pageId}
      `;
    }
  } finally {
    await sql.end();
  }
}

// Removes every study item of the page (the e2e user is shared per worker,
// so seeded rows must not leak into other specs' due lists).
export async function clearStudyItems(pageId: string): Promise<void> {
  const sql = connect();
  try {
    await sql`delete from study_items where page_id = ${pageId}`;
  } finally {
    await sql.end();
  }
}
