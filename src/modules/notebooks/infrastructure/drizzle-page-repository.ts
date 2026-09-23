import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import { type PageRow, pages } from "@/shared/db/schema";
import type { Page } from "../domain/page";
import type {
  PageRepository,
  UpdateIfVersionInput,
  UpdateIfVersionResult,
} from "../domain/page-repository";
import type { TiptapDoc } from "../domain/plain-text";

function toPage(row: PageRow): Page {
  return {
    id: row.id,
    ownerId: row.ownerId,
    notebookId: row.notebookId,
    title: row.title,
    content: row.content as TiptapDoc,
    plainText: row.plainText,
    contentVersion: row.contentVersion,
    position: row.position,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePageRepository implements PageRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Page | null> {
    const row = await this.db.query.pages.findFirst({
      where: eq(pages.id, id),
    });
    return row ? toPage(row) : null;
  }

  async nextPosition(notebookId: string): Promise<number> {
    const last = await this.db.query.pages.findFirst({
      where: eq(pages.notebookId, notebookId),
      orderBy: [desc(pages.position)],
    });
    return (last?.position ?? 0) + 1;
  }

  async create(page: Page): Promise<void> {
    await this.db.insert(pages).values({
      id: page.id,
      ownerId: page.ownerId,
      notebookId: page.notebookId,
      title: page.title,
      content: page.content,
      plainText: page.plainText,
      contentVersion: page.contentVersion,
      position: page.position,
      archivedAt: page.archivedAt,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    });
  }

  async update(page: Page): Promise<void> {
    await this.db
      .update(pages)
      .set({
        title: page.title,
        content: page.content,
        plainText: page.plainText,
        contentVersion: page.contentVersion,
        position: page.position,
        archivedAt: page.archivedAt,
        updatedAt: page.updatedAt,
      })
      .where(eq(pages.id, page.id));
  }

  async listActiveByNotebook(notebookId: string): Promise<Page[]> {
    const rows = await this.db.query.pages.findMany({
      where: and(eq(pages.notebookId, notebookId), isNull(pages.archivedAt)),
      orderBy: [pages.position],
    });
    return rows.map(toPage);
  }

  // S4 Home overview: no notebook_id filter, ordered by most recently
  // updated first (GetHomeOverview re-derives lastActivityAt/
  // pagesEditedThisWeek/recentPages from this same list either way, but
  // the DB-level order keeps a debugging query on this table meaningful).
  async listActiveByOwner(ownerId: string): Promise<Page[]> {
    const rows = await this.db.query.pages.findMany({
      where: and(eq(pages.ownerId, ownerId), isNull(pages.archivedAt)),
      orderBy: [desc(pages.updatedAt)],
    });
    return rows.map(toPage);
  }

  // Single conditional UPDATE: compare-and-swap on content_version happens
  // atomically inside Postgres, never as a read-then-write from the app
  // (design.md, "Guardado de contenido con comparar-e-intercambiar"). A
  // zero-row result re-reads the row to report the real current version.
  async updateIfVersion(
    input: UpdateIfVersionInput,
  ): Promise<UpdateIfVersionResult> {
    const updated = await this.db
      .update(pages)
      .set({
        content: input.content,
        plainText: input.plainText,
        contentVersion: sql`${pages.contentVersion} + 1`,
        updatedAt: input.updatedAt,
      })
      .where(
        and(
          eq(pages.id, input.pageId),
          eq(pages.ownerId, input.ownerId),
          isNull(pages.archivedAt),
          eq(pages.contentVersion, input.expectedVersion),
        ),
      )
      .returning({ contentVersion: pages.contentVersion });

    if (updated.length > 0) {
      return { updated: true, version: updated[0].contentVersion };
    }

    // Scoped exactly like the conditional UPDATE above: a page owned by
    // someone else (or archived) must report as not-found, never leak its
    // real content_version to a caller probing with the wrong owner_id.
    const current = await this.db.query.pages.findFirst({
      where: and(
        eq(pages.id, input.pageId),
        eq(pages.ownerId, input.ownerId),
        isNull(pages.archivedAt),
      ),
    });
    return { updated: false, currentVersion: current?.contentVersion ?? 0 };
  }
}
