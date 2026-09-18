import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Supabase's transaction pooler has no prepared statements: prepare: false
// is mandatory or queries fail silently. max: 1 keeps serverless functions
// from exhausting the pool (design.md). PR4 moves the URL into env.server.
function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = postgres(url, { prepare: false, max: 1 });
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;

let cached: Db | undefined;

export function getDb(): Db {
  cached ??= createDb();
  return cached;
}
