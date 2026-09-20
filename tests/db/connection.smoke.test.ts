import postgres from "postgres";
import { describe, expect, it } from "vitest";

// Guards the prepare: false mitigation for Supabase's transaction pooler.
// Runs only through `pnpm test:db` with a real DATABASE_URL (cogni-dev).
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("Supabase transaction pooler", () => {
  it("answers select 1 without prepared statements", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    try {
      const rows = await sql`select 1 as one`;
      expect(rows[0]?.one).toBe(1);
    } finally {
      await sql.end();
    }
  });
});
