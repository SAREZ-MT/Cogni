import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// profiles mirrors auth.users (same id). Rows are created by the
// EnsureProfile use case, never by a database trigger (design.md).
// RLS is on with no policies: only the server connection (which bypasses
// RLS) reaches the table, so PostgREST with the publishable key sees nothing.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name"),
  locale: text("locale").notNull().default("es"),
  timezone: text("timezone").notNull().default("UTC"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", {
    withTimezone: true,
  }),
  // Terms-of-use acceptance: version string (a date) + instant. Both null
  // until the user accepts; a new TERMS_VERSION re-asks everyone.
  termsAcceptedVersion: text("terms_accepted_version"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export type ProfileRow = typeof profiles.$inferSelect;

// Two-level hierarchy: owner -> notebook -> page (documento-maestro §3.1).
// ids are UUID v7 generated in application by createId(), never a Postgres
// default (design.md, "Modelo de datos de notebooks/pages/page_assets").
export const notebooks = pgTable(
  "notebooks",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    icon: text("icon"),
    color: text("color"),
    position: integer("position").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("notebooks_owner_id_idx").on(table.ownerId)],
).enableRLS();

export type NotebookRow = typeof notebooks.$inferSelect;

// content is the raw Tiptap JSON document; plain_text is materialized on
// the server from content on every save (design.md, "plain_text como
// recorrido puro de AST"). content_version powers optimistic
// compare-and-swap concurrency in SavePage.
export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    notebookId: uuid("notebook_id")
      .notNull()
      .references(() => notebooks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: jsonb("content").notNull(),
    plainText: text("plain_text").notNull().default(""),
    contentVersion: integer("content_version").notNull().default(1),
    position: integer("position").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("pages_notebook_id_idx").on(table.notebookId)],
).enableRLS();

export type PageRow = typeof pages.$inferSelect;

// storage_path is unique so RegisterPageAsset can upsert idempotently on
// repeated registration of the same uploaded object (design.md).
export const pageAssets = pgTable(
  "page_assets",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("page_assets_page_id_idx").on(table.pageId),
    unique("page_assets_storage_path_key").on(table.storagePath),
  ],
).enableRLS();

export type PageAssetRow = typeof pageAssets.$inferSelect;

// The four ImportJob statuses (mirrors domain's IMPORT_JOB_STATUS in
// modules/ingestion/domain/import-job.ts). Kept as its own literal tuple
// here — not imported from that module — because schema.ts stays free of
// module imports, like every other table in this file; `status`'s
// `$type<>()` below and the `import_jobs_status_check` constraint text
// are both derived from this single tuple so they can never drift apart
// from each other (review follow-up from T1: R2-status-untyped). If this
// list ever changes, `import-jobs.smoke.test.ts` asserts the CHECK
// constraint still matches it, and the domain tuple must be updated too.
export const IMPORT_JOB_STATUSES = [
  "queued",
  "processing",
  "done",
  "failed",
] as const;

export type ImportJobStatusValue = (typeof IMPORT_JOB_STATUSES)[number];

// One row per PDF import (design.md, "Tabla `import_jobs` solo accesible
// desde el servidor"). RLS is on with no policies, like pages: only the
// server connection reads or writes it. There is no external run id
// column: processing runs inside the app itself (ADR 0003).
export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    fileName: text("file_name").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status")
      .notNull()
      .default("queued")
      .$type<ImportJobStatusValue>(),
    pageCount: integer("page_count"),
    pagesWithoutText: integer("pages_without_text").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("import_jobs_page_id_idx").on(table.pageId),
    // Serves the sidebar query for active imports of one owner.
    index("import_jobs_owner_status_idx").on(table.ownerId, table.status),
    unique("import_jobs_storage_path_key").on(table.storagePath),
    check(
      "import_jobs_status_check",
      sql`${table.status} in ('queued', 'processing', 'done', 'failed')`,
    ),
  ],
).enableRLS();

export type ImportJobRow = typeof importJobs.$inferSelect;

// Same convention as IMPORT_JOB_STATUSES: literal tuples kept here (schema.ts
// imports no module) that feed both `$type<>()` and the CHECK text. The ai
// domain owns AI_PURPOSES / GenerationStatus; `ai-generations.contract` and
// the DB smoke tests keep these in step.
export const AI_GENERATION_STATUSES = [
  "queued",
  "running",
  "done",
  "failed",
] as const;
export type AiGenerationStatusValue = (typeof AI_GENERATION_STATUSES)[number];

export const AI_GENERATION_PURPOSES = [
  "generate_flashcards",
  "generate_exam_questions",
  "generate_exam_variants",
  "generate_recall_questions",
  "evaluate_recall_answer",
  "session_feedback",
] as const;
export type AiGenerationPurposeValue = (typeof AI_GENERATION_PURPOSES)[number];

// One audited model call (documento-maestro §6.1). page_id is nullable and
// SET NULL on page delete so the audit trail and quota history survive.
// RLS on with no policies, like every table here: only the server connection
// reaches it.
export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, {
      onDelete: "set null",
    }),
    purpose: text("purpose").notNull().$type<AiGenerationPurposeValue>(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    status: text("status").notNull().$type<AiGenerationStatusValue>(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_generations_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
    index("ai_generations_page_id_idx").on(table.pageId),
    check(
      "ai_generations_status_check",
      sql`${table.status} in ('queued', 'running', 'done', 'failed')`,
    ),
    check(
      "ai_generations_purpose_check",
      sql`${table.purpose} in ('generate_flashcards', 'generate_exam_questions', 'generate_exam_variants', 'generate_recall_questions', 'evaluate_recall_answer', 'session_feedback')`,
    ),
  ],
).enableRLS();

export type AiGenerationRow = typeof aiGenerations.$inferSelect;

// A page's deck is its cards (documento-maestro §6.1): there is no deck
// table, and a deck never holds an empty card (CHECK constraints).
export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    generationId: uuid("generation_id").references(() => aiGenerations.id, {
      onDelete: "set null",
    }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    origin: text("origin").notNull().$type<"ai" | "manual">(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("flashcards_page_position_idx").on(table.pageId, table.position),
    index("flashcards_owner_id_idx").on(table.ownerId),
    check("flashcards_origin_check", sql`${table.origin} in ('ai', 'manual')`),
    check("flashcards_front_not_blank", sql`length(btrim(${table.front})) > 0`),
    check("flashcards_back_not_blank", sql`length(btrim(${table.back})) > 0`),
  ],
).enableRLS();

export type FlashcardRow = typeof flashcards.$inferSelect;
