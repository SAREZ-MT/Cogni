import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { serverEnv } from "@/shared/config/env.server";
import { getDb } from "@/shared/db/client";

// Vercel Cron calls this daily so the Supabase free project never pauses.
export const dynamic = "force-dynamic";

// Constant-time comparison: length is checked first, so a prefix never
// leaks timing information about the secret. Never log or echo the header.
function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

export async function GET(request: Request): Promise<Response> {
  const header = request.headers.get("authorization");
  if (!isAuthorized(header, serverEnv().CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  await getDb().execute(sql`select 1`);
  return Response.json({ ok: true });
}
