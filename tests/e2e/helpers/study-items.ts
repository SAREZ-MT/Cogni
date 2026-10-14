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

// Inserts `count` items of each kind on the page, due at `dueAt` (future
// dates for the calendar's "Mes" / "Semana" views).
export async function seedItemsDueAt(
  pageId: string,
  counts: Partial<Record<DueKind, number>>,
  dueAt: Date,
): Promise<void> {
  const sql = connect();
  try {
    for (const [kind, count] of Object.entries(counts)) {
      if (!count) continue;
      await sql`
        insert into study_items (id, owner_id, page_id, kind, source_id, due_at)
        select gen_random_uuid(), p.owner_id, p.id, ${kind}, gen_random_uuid(),
               ${dueAt}
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

export type ReviewSessionKind = "flashcards" | "recall" | "exam";

const ITEM_KIND_OF: Record<ReviewSessionKind, DueKind> = {
  flashcards: "flashcard",
  recall: "recall_question",
  exam: "exam_question",
};

// Inserts one review_logs row per entry (the dashboard's "Repasos
// completados" and "racha" source), each on its own study item of the page
// that is due in a week, so the reviews never count as due items.
export async function seedReviews(
  pageId: string,
  reviews: readonly {
    sessionKind: ReviewSessionKind;
    quality: number;
    reviewedAt: Date;
  }[],
): Promise<void> {
  const sql = connect();
  try {
    for (const review of reviews) {
      await sql`
        with item as (
          insert into study_items (id, owner_id, page_id, kind, source_id, due_at)
          select gen_random_uuid(), p.owner_id, p.id,
                 ${ITEM_KIND_OF[review.sessionKind]}, gen_random_uuid(),
                 now() + interval '7 days'
          from pages p
          where p.id = ${pageId}
          returning id, owner_id
        )
        insert into review_logs (id, owner_id, item_id, quality, reviewed_at,
                                 interval_before, interval_after,
                                 easiness_after, session_kind, session_id)
        select gen_random_uuid(), item.owner_id, item.id, ${review.quality},
               ${review.reviewedAt}, 0, 1, 2.5, ${review.sessionKind},
               gen_random_uuid()
        from item
      `;
    }
  } finally {
    await sql.end();
  }
}
