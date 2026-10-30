import postgres from "postgres";

// Sets a page's stored plain_text straight in the database (Phase 8 H14):
// the hubs' page pickers count its words (100 to generate cards, 150 for
// recall and the smallest exam) without typing a long text in the editor.
// The page's Tiptap content is left as is.
export async function setPagePlainText(
  pageId: string,
  plainText: string,
): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  try {
    await sql`update pages set plain_text = ${plainText} where id = ${pageId}`;
  } finally {
    await sql.end();
  }
}

// `n` distinct words.
export function wordsOfText(n: number): string {
  return Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");
}
