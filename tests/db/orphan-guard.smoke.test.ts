import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

// Guards the fail-closed DO block in 0002_profiles_auth_fk.sql
// (guard:start/guard:end). Scenario "Migracion rechaza borrar perfiles
// cuando auth.users esta vacio (db smoke)", specs/identity-auth/spec.md.
const url = process.env.DATABASE_URL;

function extractGuardSql(): string {
  const text = readFileSync(
    path.join(process.cwd(), "drizzle", "0002_profiles_auth_fk.sql"),
    "utf8",
  );
  const start = text.indexOf("-- guard:start");
  const end = text.indexOf("-- guard:end");
  if (start === -1 || end === -1 || end <= start) return "";
  return text.slice(start + "-- guard:start".length, end);
}

class ForceRollback extends Error {}

describe.skipIf(!url)("0002 orphan-delete guard", () => {
  it("rejects deleting orphan profiles when auth.users is empty", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    const orphanId = randomUUID();

    await sql
      .begin(async (tx) => {
        await tx.unsafe(
          "alter table profiles drop constraint profiles_id_fkey",
        );
        // The guard fires only when auth.users is empty. cogni-dev is
        // shared and an interrupted e2e run can leave a fixture user
        // behind, so the precondition is created inside this transaction
        // (rolled back below) instead of assumed from the environment.
        await tx`delete from auth.users`;
        await tx`insert into profiles (id) values (${orphanId})`;
        await expect(tx.unsafe(extractGuardSql())).rejects.toMatchObject({
          code: "P0001",
        });
        throw new ForceRollback();
      })
      .catch((error) => {
        if (!(error instanceof ForceRollback)) throw error;
      });

    const [c] =
      await sql`select 1 from pg_constraint where conname = 'profiles_id_fkey'`;
    expect(c).toBeDefined();
    const [orphan] = await sql`select 1 from profiles where id = ${orphanId}`;
    expect(orphan).toBeUndefined();
    await sql.end();
  });
});
