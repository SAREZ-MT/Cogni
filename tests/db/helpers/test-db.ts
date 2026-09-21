import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/shared/db/schema";

// Same shape as src/shared/db/client.ts's getDb(), but without importing
// that module: it starts with `import "server-only"`, which throws when
// resolved outside a Next.js server bundle (as Vitest does here). DB tests
// need the same Drizzle instance the Drizzle repositories expect, so this
// helper builds it directly against the schema.
export function createTestDb() {
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  return drizzle(sql, { schema });
}

export type TestDb = ReturnType<typeof createTestDb>;
