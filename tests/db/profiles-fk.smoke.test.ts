import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

// Guards the FK from profiles.id to auth.users.id (0002_profiles_auth_fk.sql).
// Runs only through `pnpm test:db` with a real DATABASE_URL (cogni-dev).
// Scenario "Fila huerfana rechazada por la clave foranea", specs/identity-auth/spec.md.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("profiles FK to auth.users", () => {
  it("rejects an orphan id not present in auth.users", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    const orphanId = randomUUID();
    try {
      await expect(
        sql`insert into profiles (id) values (${orphanId})`,
      ).rejects.toMatchObject({ code: "23503" });
    } finally {
      // Best-effort cleanup in case the insert unexpectedly succeeded.
      await sql`delete from profiles where id = ${orphanId}`;
      await sql.end();
    }
  });
});
