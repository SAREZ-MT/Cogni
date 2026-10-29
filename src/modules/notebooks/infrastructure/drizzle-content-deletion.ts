import {
  and,
  count,
  countDistinct,
  eq,
  inArray,
  isNull,
  or,
} from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import {
  examQuestions,
  examSessions,
  flashcardSessions,
  flashcards,
  importJobs,
  notebooks,
  pageAssets,
  pages,
  recallQuestions,
  recallSessions,
  sessionFeedback,
} from "@/shared/db/schema";
import type {
  ContentDeletion,
  DeletedFiles,
  NotebookDeletionPreview,
  PageDeletionPreview,
} from "../domain/content-deletion";

// Phase 8 H19: the hard delete of pages. Every table below a page cascades
// from it (pages → page_assets, import_jobs, flashcards, study_items →
// review_logs, page_mastery, sessions → answers, exam_page_state,
// generation_fingerprints; ai_generations only lose the link, they still
// count the daily AI quota). session_feedback has no foreign key to its
// session, so it is deleted first; Storage paths are read before the
// delete and returned for the caller to remove after the commit.
export class DrizzleContentDeletion implements ContentDeletion {
  constructor(private readonly db: DbExecutor) {}

  async previewPage(
    pageId: string,
    ownerId: string,
  ): Promise<PageDeletionPreview | null> {
    const [page] = await this.db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.id, pageId), eq(pages.ownerId, ownerId)));
    if (!page) return null;
    const [cards] = await this.db
      .select({ value: count() })
      .from(flashcards)
      .where(and(eq(flashcards.pageId, pageId), isNull(flashcards.archivedAt)));
    const [recall] = await this.db
      .select({ value: count() })
      .from(recallQuestions)
      .where(
        and(
          eq(recallQuestions.pageId, pageId),
          isNull(recallQuestions.archivedAt),
        ),
      );
    const [exam] = await this.db
      .select({ value: count() })
      .from(examQuestions)
      .where(
        and(eq(examQuestions.pageId, pageId), isNull(examQuestions.retiredAt)),
      );
    const [images] = await this.db
      .select({ value: count() })
      .from(pageAssets)
      .where(eq(pageAssets.pageId, pageId));
    return {
      flashcards: cards?.value ?? 0,
      recallQuestions: recall?.value ?? 0,
      examQuestions: exam?.value ?? 0,
      images: images?.value ?? 0,
    };
  }

  async previewNotebook(
    notebookId: string,
    ownerId: string,
  ): Promise<NotebookDeletionPreview | null> {
    const [notebook] = await this.db
      .select({ id: notebooks.id })
      .from(notebooks)
      .where(and(eq(notebooks.id, notebookId), eq(notebooks.ownerId, ownerId)));
    if (!notebook) return null;
    const active = and(
      eq(pages.notebookId, notebookId),
      eq(pages.ownerId, ownerId),
      isNull(pages.archivedAt),
    );
    const [pageCount] = await this.db
      .select({ value: count() })
      .from(pages)
      .where(active);
    const [decks] = await this.db
      .select({ value: countDistinct(flashcards.pageId) })
      .from(flashcards)
      .innerJoin(pages, eq(pages.id, flashcards.pageId))
      .where(and(active, isNull(flashcards.archivedAt)));
    const [recallSets] = await this.db
      .select({ value: countDistinct(recallQuestions.pageId) })
      .from(recallQuestions)
      .innerJoin(pages, eq(pages.id, recallQuestions.pageId))
      .where(and(active, isNull(recallQuestions.archivedAt)));
    const [examSets] = await this.db
      .select({ value: countDistinct(examQuestions.pageId) })
      .from(examQuestions)
      .innerJoin(pages, eq(pages.id, examQuestions.pageId))
      .where(and(active, isNull(examQuestions.retiredAt)));
    return {
      pages: pageCount?.value ?? 0,
      decks: decks?.value ?? 0,
      recallSets: recallSets?.value ?? 0,
      examSets: examSets?.value ?? 0,
    };
  }

  deletePage(pageId: string, ownerId: string): Promise<DeletedFiles | null> {
    return this.db.transaction(async (tx) => {
      const [page] = await tx
        .select({ id: pages.id })
        .from(pages)
        .where(and(eq(pages.id, pageId), eq(pages.ownerId, ownerId)))
        .for("update");
      if (!page) return null;
      const files = await removePages(tx, [pageId], ownerId);
      await tx
        .delete(pages)
        .where(and(eq(pages.id, pageId), eq(pages.ownerId, ownerId)));
      return files;
    });
  }

  deleteNotebook(
    notebookId: string,
    ownerId: string,
  ): Promise<DeletedFiles | null> {
    return this.db.transaction(async (tx) => {
      const [notebook] = await tx
        .select({ id: notebooks.id })
        .from(notebooks)
        .where(
          and(eq(notebooks.id, notebookId), eq(notebooks.ownerId, ownerId)),
        )
        .for("update");
      if (!notebook) return null;
      // Archived pages too: the notebook row's cascade takes all of them.
      const notebookPages = await tx
        .select({ id: pages.id })
        .from(pages)
        .where(
          and(eq(pages.notebookId, notebookId), eq(pages.ownerId, ownerId)),
        )
        .for("update");
      const files = await removePages(
        tx,
        notebookPages.map((row) => row.id),
        ownerId,
      );
      await tx
        .delete(notebooks)
        .where(
          and(eq(notebooks.id, notebookId), eq(notebooks.ownerId, ownerId)),
        );
      return files;
    });
  }
}

// Inside the deleting transaction, before the pages go: reads their
// Storage paths and deletes the AI feedback of their sessions (the one
// dependant with no foreign key to cascade through).
async function removePages(
  tx: DbExecutor,
  pageIds: string[],
  ownerId: string,
): Promise<DeletedFiles> {
  if (pageIds.length === 0) return { assetPaths: [], importPaths: [] };
  const assets = await tx
    .select({ path: pageAssets.storagePath })
    .from(pageAssets)
    .where(
      and(inArray(pageAssets.pageId, pageIds), eq(pageAssets.ownerId, ownerId)),
    );
  const imports = await tx
    .select({ path: importJobs.storagePath })
    .from(importJobs)
    .where(
      and(inArray(importJobs.pageId, pageIds), eq(importJobs.ownerId, ownerId)),
    );

  const sessionsOf = async (
    table:
      | typeof flashcardSessions
      | typeof recallSessions
      | typeof examSessions,
  ) =>
    (
      await tx
        .select({ id: table.id })
        .from(table)
        .where(and(inArray(table.pageId, pageIds), eq(table.ownerId, ownerId)))
    ).map((row) => row.id);
  const byKind: ReturnType<typeof and>[] = [];
  for (const [kind, table] of [
    ["flashcards", flashcardSessions],
    ["recall", recallSessions],
    ["exam", examSessions],
  ] as const) {
    const ids = await sessionsOf(table);
    if (ids.length > 0) {
      byKind.push(
        and(
          eq(sessionFeedback.sessionKind, kind),
          inArray(sessionFeedback.sessionId, ids),
        ),
      );
    }
  }
  if (byKind.length > 0) {
    await tx
      .delete(sessionFeedback)
      .where(and(eq(sessionFeedback.ownerId, ownerId), or(...byKind)));
  }

  return {
    assetPaths: assets.map((row) => row.path),
    importPaths: imports.map((row) => row.path),
  };
}
