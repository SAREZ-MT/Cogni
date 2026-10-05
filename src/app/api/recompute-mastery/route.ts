import { timingSafeEqual } from "node:crypto";
import { createMasteryRecomputeJob } from "@/modules/study-engine";
import { serverEnv } from "@/shared/config/env.server";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { createId } from "@/shared/kernel/id";

// Vercel Cron calls this daily (vercel.json) so every page's mastery
// (items due, level, score; documento-maestro §7.3) stays current even when
// nobody reviews it. No user session: the cron bearer is the only access.
export const dynamic = "force-dynamic";

// Constant-time comparison, as in /api/keep-alive: length is checked
// first, so a prefix never leaks timing information about the secret.
// Never log or echo the header.
function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

// Fails closed: without a configured secret nothing can be authorized.
function cronSecret(): string | null {
  try {
    return serverEnv().CRON_SECRET || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const secret = cronSecret();
  if (secret === null) {
    console.error("[recompute-mastery] CRON_SECRET is not configured");
    return new Response(null, { status: 500 });
  }
  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return new Response(null, { status: 401 });
  }

  const summary = await createMasteryRecomputeJob({
    db: getDb(),
    clock: systemClock,
    ids: { next: createId },
    // Ids only: no page or item content reaches the logs.
    onPageError: (page, error) => {
      console.error("[recompute-mastery] page failed", {
        pageId: page.pageId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  }).run();

  return Response.json({ ok: true, ...summary });
}
