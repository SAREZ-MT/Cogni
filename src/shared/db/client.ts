import "server-only";
import type { PgDatabase } from "drizzle-orm/pg-core";
import {
  drizzle,
  type PostgresJsQueryResultHKT,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/shared/config/env.server";
import * as schema from "./schema";

// Supabase's transaction pooler has no prepared statements: prepare: false
// is mandatory or queries fail silently. max: 1 keeps serverless functions
// from exhausting the pool (design.md).
function createDb() {
  const sql = postgres(serverEnv().DATABASE_URL, { prepare: false, max: 1 });
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;

// What a repository needs to run queries: the database or an open
// transaction (`db.transaction(async (tx) => ...)`). Both extend PgDatabase,
// so a repository built on a transaction joins its unit of work.
export type DbExecutor = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

let cached: Db | undefined;

export function getDb(): Db {
  cached ??= createDb();
  return cached;
}
