// document-import T9b (security audit 2026-10-26: no import rate limit or
// concurrency cap): imports are expensive — a 20 MiB upload, a page, and up
// to 100 s of parsing in a Vercel function — so each user is throttled.
// The port the use cases consume; actions.ts composes it over
// `src/shared/rate-limit` (Upstash in live mode, in memory in fake mode).
export interface ImportRateLimiter {
  // Counts one attempt by `ownerId`; `allowed: false` once the window's
  // limit is spent.
  consume(ownerId: string): Promise<{ allowed: boolean }>;
}

const HOUR_MS = 60 * 60 * 1000;

// `startPdfImport` calls per user and hour (idempotent repeats excluded).
export const IMPORT_STARTS_PER_HOUR = { limit: 10, windowMs: HOUR_MS };
// `requestPdfUpload` grants per user and hour: twice the starts, so a
// failed upload can be retried without hitting the start limit first.
export const UPLOAD_GRANTS_PER_HOUR = { limit: 20, windowMs: HOUR_MS };
// Imports a user may have queued or processing at once (abandoned jobs do
// not count); `startPdfImport` refuses another one until one finishes.
export const MAX_ACTIVE_IMPORTS = 3;
