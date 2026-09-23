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

// One row per PDF import (design.md, "Tabla `import_jobs` solo accesible
// desde el servidor"). RLS is on with no policies, like pages: only the
// server connection reads or writes it. There is no external run id
// column: processing runs inside the app itself (ADR 0002).
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
    status: text("status").notNull().default("queued"),
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
