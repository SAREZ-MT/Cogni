import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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

// document-import T10: the formats an import job may record, same
// convention as IMPORT_JOB_STATUSES (mirrors ingestion's DOCUMENT_FORMATS;
// `import-jobs.smoke.test.ts` asserts the CHECK constraint matches it).
export const IMPORT_JOB_FORMATS = ["pdf", "docx", "pptx"] as const;

export type ImportJobFormatValue = (typeof IMPORT_JOB_FORMATS)[number];

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
    // document-import T10 (0014): rows before it were all PDF imports.
    format: text("format")
      .notNull()
      .default("pdf")
      .$type<ImportJobFormatValue>(),
    status: text("status")
      .notNull()
      .default("queued")
      .$type<ImportJobStatusValue>(),
    pageCount: integer("page_count"),
    pagesWithoutText: integer("pages_without_text").notNull().default(0),
    // document-import T10 (0014): images not imported by a done job.
    skippedImages: integer("skipped_images").notNull().default(0),
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
    check(
      "import_jobs_format_check",
      sql`${table.format} in ('pdf', 'docx', 'pptx')`,
    ),
    check("import_jobs_skipped_images_check", sql`${table.skippedImages} >= 0`),
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
    // Logical delete (documento-maestro §6.1); the card's study item is
    // suspended at the same time.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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

// Study-engine literal tuples (same convention as IMPORT_JOB_STATUSES): they
// mirror StudyItemKind, SessionKind, Quality and MasteryLevel in
// modules/study-engine/domain and feed both `$type<>()` and the CHECK text.
export const STUDY_ITEM_KINDS = [
  "flashcard",
  "exam_question",
  "recall_question",
] as const;
export type StudyItemKindValue = (typeof STUDY_ITEM_KINDS)[number];

export const REVIEW_SESSION_KINDS = ["flashcards", "exam", "recall"] as const;
export type ReviewSessionKindValue = (typeof REVIEW_SESSION_KINDS)[number];

export type QualityValue = 0 | 1 | 2 | 3 | 4 | 5;

export const MASTERY_LEVEL_VALUES = [
  "Nuevo",
  "Aprendiendo",
  "Consolidando",
  "Dominado",
] as const;
export type MasteryLevelValue = (typeof MASTERY_LEVEL_VALUES)[number];

export const SESSION_FEEDBACK_STATUSES = ["pending", "done", "failed"] as const;
export type SessionFeedbackStatusValue =
  (typeof SESSION_FEEDBACK_STATUSES)[number];

// Per-item SM-2 state (documento-maestro §3.4, §6.1, §7.1). source_id points
// to a flashcard, a root exam question or a recall question depending on
// kind, so it carries no foreign key; (kind, source_id) is unique: one item
// per source. RLS on with no policies, like every table here.
export const studyItems = pgTable(
  "study_items",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<StudyItemKindValue>(),
    sourceId: uuid("source_id").notNull(),
    easiness: doublePrecision("easiness").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    lastQuality: integer("last_quality").$type<QualityValue>(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Serves "due today" (listDue) for one owner.
    index("study_items_owner_due_idx").on(table.ownerId, table.dueAt),
    index("study_items_page_id_idx").on(table.pageId),
    unique("study_items_kind_source_key").on(table.kind, table.sourceId),
    check(
      "study_items_kind_check",
      sql`${table.kind} in ('flashcard', 'exam_question', 'recall_question')`,
    ),
    check("study_items_easiness_min", sql`${table.easiness} >= 1.3`),
    check(
      "study_items_counters_non_negative",
      sql`${table.intervalDays} >= 0 and ${table.repetitions} >= 0 and ${table.lapses} >= 0`,
    ),
    check(
      "study_items_last_quality_range",
      sql`${table.lastQuality} between 0 and 5`,
    ),
  ],
).enableRLS();

export type StudyItemRow = typeof studyItems.$inferSelect;

// Append-only history of graded answers (§6.1). session_id points to a
// flashcard, exam or recall session depending on session_kind, so it
// carries no foreign key; logs go away with their item.
export const reviewLogs = pgTable(
  "review_logs",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => studyItems.id, { onDelete: "cascade" }),
    quality: integer("quality").notNull().$type<QualityValue>(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    intervalBefore: integer("interval_before").notNull(),
    intervalAfter: integer("interval_after").notNull(),
    easinessAfter: doublePrecision("easiness_after").notNull(),
    sessionKind: text("session_kind").notNull().$type<ReviewSessionKindValue>(),
    sessionId: uuid("session_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("review_logs_item_reviewed_idx").on(table.itemId, table.reviewedAt),
    index("review_logs_owner_reviewed_idx").on(table.ownerId, table.reviewedAt),
    check("review_logs_quality_range", sql`${table.quality} between 0 and 5`),
    check(
      "review_logs_session_kind_check",
      sql`${table.sessionKind} in ('flashcards', 'exam', 'recall')`,
    ),
  ],
).enableRLS();

export type ReviewLogRow = typeof reviewLogs.$inferSelect;

// One persisted mastery aggregate per page (§6.1, §7.3), rewritten after
// every review and by the daily job.
export const pageMastery = pgTable(
  "page_mastery",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    level: text("level").notNull().$type<MasteryLevelValue>(),
    score: doublePrecision("score").notNull(),
    itemsTotal: integer("items_total").notNull(),
    itemsDue: integer("items_due").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("page_mastery_page_id_key").on(table.pageId),
    index("page_mastery_owner_id_idx").on(table.ownerId),
    check(
      "page_mastery_level_check",
      sql`${table.level} in ('Nuevo', 'Aprendiendo', 'Consolidando', 'Dominado')`,
    ),
    check(
      "page_mastery_score_range",
      sql`${table.score} >= 0 and ${table.score} <= 1`,
    ),
  ],
).enableRLS();

export type PageMasteryRow = typeof pageMastery.$inferSelect;

// One flashcard review session (§6.1). page_id is null for the multi-page
// "Hoy" session; an open session has no finished_at.
export const flashcardSessions = pgTable(
  "flashcard_sessions",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, {
      onDelete: "cascade",
    }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    reviewedCount: integer("reviewed_count").notNull().default(0),
    againCount: integer("again_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("flashcard_sessions_owner_started_idx").on(
      table.ownerId,
      table.startedAt,
    ),
    index("flashcard_sessions_page_id_idx").on(table.pageId),
  ],
).enableRLS();

export type FlashcardSessionRow = typeof flashcardSessions.$inferSelect;

// AI feedback for one finished session of any technique (§6.1): exactly one
// row per (session_kind, session_id). A failed generation never blocks
// closing the session; it only marks the row failed.
export const sessionFeedback = pgTable(
  "session_feedback",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sessionKind: text("session_kind").notNull().$type<ReviewSessionKindValue>(),
    sessionId: uuid("session_id").notNull(),
    content: jsonb("content"),
    generationId: uuid("generation_id").references(() => aiGenerations.id, {
      onDelete: "set null",
    }),
    status: text("status")
      .notNull()
      .default("pending")
      .$type<SessionFeedbackStatusValue>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("session_feedback_session_key").on(
      table.sessionKind,
      table.sessionId,
    ),
    index("session_feedback_owner_id_idx").on(table.ownerId),
    check(
      "session_feedback_session_kind_check",
      sql`${table.sessionKind} in ('flashcards', 'exam', 'recall')`,
    ),
    check(
      "session_feedback_status_check",
      sql`${table.status} in ('pending', 'done', 'failed')`,
    ),
  ],
).enableRLS();

export type SessionFeedbackRow = typeof sessionFeedback.$inferSelect;

// Exams (documento-maestro §3.3, §6.1, §7.5). Literal tuples mirror
// ExamQuestionOrigin in modules/exams/domain; RLS on with no policies, like
// every table here.
export const EXAM_QUESTION_ORIGINS = ["ai", "manual", "ai_variant"] as const;
export type ExamQuestionOriginValue = (typeof EXAM_QUESTION_ORIGINS)[number];

// One multiple-choice question. root_id is the lineage's original question
// (its own id when original) and variant_of the question it replaced; the
// study item of kind exam_question points at the root. A retired question
// never shows again but stays for the lineage (a variant never repeats an
// earlier wording). Questions are retired, never deleted: the lineage keys
// are NO ACTION, so deleting a root with variants or a replaced question
// fails, while deleting the page (or the owner) removes the whole lineage
// in one statement, because every question of a lineage shares the root's
// owner and page (exam_questions_root_fk).
export const examQuestions = pgTable(
  "exam_questions",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    stem: text("stem").notNull(),
    options: jsonb("options").notNull().$type<string[]>(),
    correctIndex: integer("correct_index").notNull(),
    explanation: text("explanation").notNull(),
    concept: text("concept").notNull(),
    rootId: uuid("root_id").notNull(),
    variantOf: uuid("variant_of"),
    origin: text("origin").notNull().$type<ExamQuestionOriginValue>(),
    generationId: uuid("generation_id").references(() => aiGenerations.id, {
      onDelete: "set null",
    }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Serves listActiveByPage: the page's questions still shown.
    index("exam_questions_page_active_idx")
      .on(table.pageId, table.createdAt)
      .where(sql`${table.retiredAt} is null`),
    index("exam_questions_root_id_idx").on(table.rootId),
    index("exam_questions_owner_id_idx").on(table.ownerId),
    // Targets of the composite lineage keys below and of exam_answers.
    unique("exam_questions_id_owner_page_key").on(
      table.id,
      table.ownerId,
      table.pageId,
    ),
    unique("exam_questions_id_root_key").on(table.id, table.rootId),
    // The root is a question of the same owner and page.
    foreignKey({
      name: "exam_questions_root_fk",
      columns: [table.rootId, table.ownerId, table.pageId],
      foreignColumns: [table.id, table.ownerId, table.pageId],
    }),
    // The replaced question belongs to the same lineage.
    foreignKey({
      name: "exam_questions_variant_of_fk",
      columns: [table.variantOf, table.rootId],
      foreignColumns: [table.id, table.rootId],
    }),
    check(
      "exam_questions_origin_check",
      sql`${table.origin} in ('ai', 'manual', 'ai_variant')`,
    ),
    check(
      "exam_questions_options_count",
      sql`jsonb_typeof(${table.options}) = 'array' and jsonb_array_length(${table.options}) = 4`,
    ),
    check(
      "exam_questions_correct_index_range",
      sql`${table.correctIndex} between 0 and 3`,
    ),
    check(
      "exam_questions_stem_not_blank",
      sql`length(btrim(${table.stem})) > 0`,
    ),
    check(
      "exam_questions_concept_not_blank",
      sql`length(btrim(${table.concept})) > 0`,
    ),
    // An original is its own root; only a variant replaces another question.
    check(
      "exam_questions_lineage_check",
      sql`(${table.variantOf} is null) = (${table.rootId} = ${table.id})`,
    ),
  ],
).enableRLS();

export type ExamQuestionRow = typeof examQuestions.$inferSelect;

// One exam attempt. The result columns are null until the session is
// finished, all together; an abandoned session stays open.
export const examSessions = pgTable(
  "exam_sessions",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    requestedCount: integer("requested_count").notNull(),
    isRetake: boolean("is_retake").notNull().default(false),
    retakeOfSessionId: uuid("retake_of_session_id").references(
      (): AnyPgColumn => examSessions.id,
      { onDelete: "set null" },
    ),
    // The ordered ids of the questions shown, fixed at the start (0011):
    // the session never composes its questions again.
    questionIds: jsonb("question_ids").notNull().$type<string[]>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    total: integer("total"),
    correct: integer("correct"),
    score: doublePrecision("score"),
    passed: boolean("passed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Serves listFinishedByPage (feedback history) and the hub.
    index("exam_sessions_page_finished_idx").on(table.pageId, table.finishedAt),
    index("exam_sessions_owner_started_idx").on(table.ownerId, table.startedAt),
    check(
      "exam_sessions_requested_count_range",
      sql`${table.requestedCount} between 10 and 30`,
    ),
    check(
      "exam_sessions_question_ids_check",
      sql`jsonb_typeof(${table.questionIds}) = 'array' and jsonb_array_length(${table.questionIds}) between 1 and ${table.requestedCount}`,
    ),
    check(
      "exam_sessions_retake_check",
      sql`${table.retakeOfSessionId} is null or ${table.isRetake}`,
    ),
    check(
      "exam_sessions_result_check",
      sql`(${table.finishedAt} is null and ${table.total} is null and ${table.correct} is null and ${table.score} is null and ${table.passed} is null)
        or (${table.finishedAt} is not null and ${table.total} between 1 and ${table.requestedCount}
          and ${table.correct} between 0 and ${table.total}
          and ${table.score} between 0 and 1 and ${table.passed} is not null)`,
    ),
  ],
).enableRLS();

export type ExamSessionRow = typeof examSessions.$inferSelect;

// One graded answer. question_id is the wording actually shown (maybe a
// variant), root_id the lineage it feeds and must be that question's root
// (exam_answers_question_root_fk): one answer per question and per root in
// a session.
export const examAnswers = pgTable(
  "exam_answers",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => examSessions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").notNull(),
    rootId: uuid("root_id").notNull(),
    selectedIndex: integer("selected_index").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "exam_answers_pkey",
      columns: [table.sessionId, table.questionId],
    }),
    unique("exam_answers_session_root_key").on(table.sessionId, table.rootId),
    // CASCADE: a page delete removes the questions before the session
    // cascade reaches their answers, and a NO ACTION check would fire in
    // between. Questions are only deleted with their page or owner.
    foreignKey({
      name: "exam_answers_question_root_fk",
      columns: [table.questionId, table.rootId],
      foreignColumns: [examQuestions.id, examQuestions.rootId],
    }).onDelete("cascade"),
    index("exam_answers_question_id_idx").on(table.questionId),
    index("exam_answers_owner_id_idx").on(table.ownerId),
    check(
      "exam_answers_selected_index_range",
      sql`${table.selectedIndex} between 0 and 3`,
    ),
  ],
).enableRLS();

export type ExamAnswerRow = typeof examAnswers.$inferSelect;

// Per-page exam state: a pending retake with the roots failed in the last
// failed exam, and the last passing session.
export const examPageState = pgTable(
  "exam_page_state",
  {
    pageId: uuid("page_id")
      .primaryKey()
      .references(() => pages.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    retakePending: boolean("retake_pending").notNull().default(false),
    failedRootIds: jsonb("failed_root_ids")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<string[]>(),
    lastPassedSessionId: uuid("last_passed_session_id").references(
      () => examSessions.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("exam_page_state_owner_id_idx").on(table.ownerId),
    check(
      "exam_page_state_failed_root_ids_array",
      sql`jsonb_typeof(${table.failedRootIds}) = 'array'`,
    ),
  ],
).enableRLS();

export type ExamPageStateRow = typeof examPageState.$inferSelect;

// Active recall (documento-maestro §3.3, §6.1, §7.4, §8.5). Literal tuples
// mirror RecallQuestionOrigin, RecallSessionEvaluationStatus and
// RecallEvaluationStatus in modules/active-recall/domain; RLS on with no
// policies, like every table here.
export const RECALL_QUESTION_ORIGINS = ["ai", "manual"] as const;
export type RecallQuestionOriginValue =
  (typeof RECALL_QUESTION_ORIGINS)[number];

export const RECALL_SESSION_EVALUATION_STATUSES = [
  "pending",
  "done",
  "partial",
] as const;
export type RecallSessionEvaluationStatusValue =
  (typeof RECALL_SESSION_EVALUATION_STATUSES)[number];

export const RECALL_ANSWER_EVALUATION_STATUSES = [
  "pending",
  "done",
  "failed",
] as const;
export type RecallAnswerEvaluationStatusValue =
  (typeof RECALL_ANSWER_EVALUATION_STATUSES)[number];

// One open question of a page with the rubric its answers are scored
// against. The study item of kind recall_question points at it. Questions
// are archived, never deleted; deleting the page (or the owner) removes
// them with their answers.
export const recallQuestions = pgTable(
  "recall_questions",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    rubric: jsonb("rubric").notNull().$type<{
      keyConcepts: string[];
      acceptableAnswerSummary: string;
    }>(),
    origin: text("origin").notNull().$type<RecallQuestionOriginValue>(),
    generationId: uuid("generation_id").references(() => aiGenerations.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Serves listActiveByPage: the page's questions a session may show.
    index("recall_questions_page_active_idx")
      .on(table.pageId, table.createdAt)
      .where(sql`${table.archivedAt} is null`),
    index("recall_questions_owner_id_idx").on(table.ownerId),
    // Target of recall_answers_question_owner_fk.
    unique("recall_questions_id_owner_key").on(table.id, table.ownerId),
    check(
      "recall_questions_origin_check",
      sql`${table.origin} in ('ai', 'manual')`,
    ),
    check(
      "recall_questions_prompt_not_blank",
      sql`length(btrim(${table.prompt})) > 0`,
    ),
    // { keyConcepts: non-empty array, acceptableAnswerSummary: non-blank
    // string }. A missing key reads as NULL, which a CHECK would accept,
    // hence the coalesce; the CASE keeps jsonb_array_length off scalars.
    check(
      "recall_questions_rubric_shape",
      sql`coalesce(jsonb_typeof(${table.rubric}) = 'object'
        and case when jsonb_typeof(${table.rubric} -> 'keyConcepts') = 'array'
          then jsonb_array_length(${table.rubric} -> 'keyConcepts') > 0
          else false end
        and jsonb_typeof(${table.rubric} -> 'acceptableAnswerSummary') = 'string'
        and length(btrim(${table.rubric} ->> 'acceptableAnswerSummary')) > 0, false)`,
    ),
  ],
).enableRLS();

export type RecallQuestionRow = typeof recallQuestions.$inferSelect;

// One active-recall session. evaluation_status leaves pending only once
// the session is finished: the AI evaluation runs after closing (§8.5).
export const recallSessions = pgTable(
  "recall_sessions",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    evaluationStatus: text("evaluation_status")
      .notNull()
      .default("pending")
      .$type<RecallSessionEvaluationStatusValue>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Serve listByPage and listRecentByOwner (latest started first).
    index("recall_sessions_page_started_idx").on(
      table.pageId,
      table.startedAt.desc(),
    ),
    index("recall_sessions_owner_started_idx").on(
      table.ownerId,
      table.startedAt.desc(),
    ),
    // Target of recall_answers_session_owner_fk.
    unique("recall_sessions_id_owner_key").on(table.id, table.ownerId),
    check(
      "recall_sessions_evaluation_status_check",
      sql`${table.evaluationStatus} in ('pending', 'done', 'partial')
        and (${table.evaluationStatus} = 'pending' or ${table.finishedAt} is not null)`,
    ),
    check(
      "recall_sessions_finished_after_start",
      sql`${table.finishedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
  ],
).enableRLS();

export type RecallSessionRow = typeof recallSessions.$inferSelect;

// One written answer with its self-rating and AI evaluation, at most one
// per question in a session. The composite keys tie the session and the
// question to the answer's owner. A done answer has its raw evaluation, AI
// score and combined quality; a failed one keeps the raw attempt and no
// score; a pending one has no score yet (it may keep the attempt of a
// failed run being retried). evaluation_claimed_at marks the evaluation
// run that took a pending answer; a stale claim may be taken over.
export const recallAnswers = pgTable(
  "recall_answers",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull(),
    questionId: uuid("question_id").notNull(),
    answerText: text("answer_text").notNull(),
    selfRating: integer("self_rating").notNull(),
    evaluationStatus: text("evaluation_status")
      .notNull()
      .default("pending")
      .$type<RecallAnswerEvaluationStatusValue>(),
    aiEvaluation: jsonb("ai_evaluation").$type<unknown>(),
    aiScore: integer("ai_score"),
    combinedQuality: integer("combined_quality"),
    generationId: uuid("generation_id").references(() => aiGenerations.id, {
      onDelete: "set null",
    }),
    disagreed: boolean("disagreed").notNull().default(false),
    evaluationClaimedAt: timestamp("evaluation_claimed_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Also serves listBySession.
    unique("recall_answers_session_question_key").on(
      table.sessionId,
      table.questionId,
    ),
    foreignKey({
      name: "recall_answers_session_owner_fk",
      columns: [table.sessionId, table.ownerId],
      foreignColumns: [recallSessions.id, recallSessions.ownerId],
    }).onDelete("cascade"),
    foreignKey({
      name: "recall_answers_question_owner_fk",
      columns: [table.questionId, table.ownerId],
      foreignColumns: [recallQuestions.id, recallQuestions.ownerId],
    }).onDelete("cascade"),
    // Serves claimPendingForEvaluation.
    index("recall_answers_session_pending_idx")
      .on(table.sessionId)
      .where(sql`${table.evaluationStatus} = 'pending'`),
    index("recall_answers_question_id_idx").on(table.questionId),
    index("recall_answers_owner_id_idx").on(table.ownerId),
    check(
      "recall_answers_self_rating_range",
      sql`${table.selfRating} between 0 and 5`,
    ),
    check(
      "recall_answers_ai_score_range",
      sql`${table.aiScore} between 0 and 5`,
    ),
    check(
      "recall_answers_combined_quality_range",
      sql`${table.combinedQuality} between 0 and 5`,
    ),
    check(
      "recall_answers_evaluation_check",
      sql`(${table.evaluationStatus} = 'pending' and ${table.aiScore} is null and ${table.combinedQuality} is null)
        or (${table.evaluationStatus} = 'done' and ${table.aiEvaluation} is not null
          and ${table.aiScore} is not null and ${table.combinedQuality} is not null)
        or (${table.evaluationStatus} = 'failed' and ${table.aiEvaluation} is not null
          and ${table.aiScore} is null and ${table.combinedQuality} is null)`,
    ),
  ],
).enableRLS();

export type RecallAnswerRow = typeof recallAnswers.$inferSelect;

// Incremental generation (Phase 6 T5c, user decision 2026-10-06): the
// fingerprints (sha256 hex of the normalized text) of the page paragraphs
// each technique already sent to the AI (shared/kernel/page-paragraphs.ts). "Generar" only sends paragraphs
// whose fingerprint is not stored for that technique; rows are never
// deleted by an edit (deleted content keeps its generated items).
// Same values as shared/kernel/generation-fingerprints.ts's
// GENERATION_TECHNIQUES (schema.test.ts keeps them equal).
export const GENERATION_FINGERPRINT_TECHNIQUES = [
  "flashcards",
  "exam",
  "recall",
] as const;
export type GenerationTechniqueValue =
  (typeof GENERATION_FINGERPRINT_TECHNIQUES)[number];

export const generationFingerprints = pgTable(
  "generation_fingerprints",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    technique: text("technique").notNull().$type<GenerationTechniqueValue>(),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // The unique (page, owner, technique, fingerprint) rule; its prefix
    // serves listByPage and the page cascade.
    primaryKey({
      name: "generation_fingerprints_pkey",
      columns: [
        table.pageId,
        table.ownerId,
        table.technique,
        table.fingerprint,
      ],
    }),
    index("generation_fingerprints_owner_id_idx").on(table.ownerId),
    check(
      "generation_fingerprints_technique_check",
      sql`${table.technique} in ('flashcards', 'exam', 'recall')`,
    ),
    check(
      "generation_fingerprints_fingerprint_format",
      sql`${table.fingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
).enableRLS();

export type GenerationFingerprintRow =
  typeof generationFingerprints.$inferSelect;
