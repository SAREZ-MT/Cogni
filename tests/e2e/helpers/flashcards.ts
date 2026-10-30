import postgres from "postgres";

// Direct flashcard seeding (Phase 8 H13): cards are created by AI only, so a
// spec that needs a deck without calling a provider writes the cards
// straight into the database, each with its study item due now, the same
// rows requestGeneration saves (origin "ai"; no audited generation).

export interface SeedCard {
  front: string;
  back: string;
}

// Appends `cards` to the page's deck, in order, owned by the page's owner.
export async function seedFlashcards(
  pageId: string,
  cards: readonly SeedCard[],
): Promise<void> {
  // Without it postgres() would quietly try a local database: fail loudly.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("seedFlashcards needs DATABASE_URL (cogni-dev)");
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    for (const [index, card] of cards.entries()) {
      const inserted = await sql`
        with card as (
          insert into flashcards (id, owner_id, page_id, front, back, origin,
                                  position)
          select gen_random_uuid(), p.owner_id, p.id, ${card.front},
                 ${card.back}, 'ai',
                 coalesce((select max(position) + 1 from flashcards
                           where page_id = p.id), ${index})
          from pages p
          where p.id = ${pageId}
          returning id, owner_id, page_id
        )
        insert into study_items (id, owner_id, page_id, kind, source_id, due_at)
        select gen_random_uuid(), owner_id, page_id, 'flashcard', id, now()
        from card
        returning id
      `;
      if (inserted.length !== 1) {
        throw new Error(`seedFlashcards: no page ${pageId} to seed`);
      }
    }
  } finally {
    await sql.end();
  }
}
