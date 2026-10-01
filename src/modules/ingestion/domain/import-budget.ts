// Time budgets for the PDF import pipeline (design.md, "Decision: Entidad
// ImportJob y transiciones de la spec"). Kept in one file because the three
// constants derive from each other and must never drift apart.

// The Vercel function `maxDuration` (seconds) declared as a literal on the
// page route that invokes `processPdfImport` (documento maestro v1.1.0
// §8.1 regla 5; ADR 0003 — everything happens inside one Vercel function
// call, no background job service). A unit test (T8) compares that page
// route literal against this constant; keep them equal.
export const MAX_DURATION_S = 120;

// `processImportJob`'s internal time budget in milliseconds, strictly less
// than `MAX_DURATION_S * 1000` so there is always time left to persist a
// `failed` state and respond even when the platform never interrupts the
// call. Leaves a 20 s safety margin (`MAX_DURATION_S * 1000 -
// PROCESSING_BUDGET_MS`) for the last write plus the response.
export const PROCESSING_BUDGET_MS = 100_000;

// How long a non-terminal job may go without an `updated_at` write before
// `isAbandoned` reports it as abandoned. The platform kills the function at
// `MAX_DURATION_S`, so nothing can still be running past that instant; the
// extra 30 s absorb clock skew between the app server and the database and
// give a genuinely in-flight call room to finish its last write.
export const ABANDONED_AFTER_MS = (MAX_DURATION_S + 30) * 1000;
