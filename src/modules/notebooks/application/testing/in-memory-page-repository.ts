import type { Page } from "../../domain/page";
import type {
  PageRepository,
  UpdateIfVersionInput,
  UpdateIfVersionResult,
} from "../../domain/page-repository";

// Test double for the PageRepository port. updateIfVersion implements the
// same conditional semantics as the SQL adapter: compare and write happen
// as one atomic step, with no window between reading and writing
// (design.md, "Guardado de contenido con comparar-e-intercambiar").
export class InMemoryPageRepository implements PageRepository {
  private readonly rows = new Map<string, Page>();

  async findById(id: string): Promise<Page | null> {
    return this.rows.get(id) ?? null;
  }

  async nextPosition(notebookId: string): Promise<number> {
    let max = 0;
    for (const page of this.rows.values()) {
      if (page.notebookId === notebookId && page.position > max) {
        max = page.position;
      }
    }
    return max + 1;
  }

  async create(page: Page): Promise<void> {
    this.rows.set(page.id, page);
  }

  async update(page: Page): Promise<void> {
    this.rows.set(page.id, page);
  }

  async listActiveByNotebook(notebookId: string): Promise<Page[]> {
    return [...this.rows.values()]
      .filter((page) => page.notebookId === notebookId && !page.archivedAt)
      .sort((a, b) => a.position - b.position);
  }

  async updateIfVersion(
    input: UpdateIfVersionInput,
  ): Promise<UpdateIfVersionResult> {
    const page = this.rows.get(input.pageId);
    // The fallback "current version" report must be scoped by owner_id,
    // exactly like the conditional write itself: a page owned by someone
    // else (or archived) is not-found for this caller, never a stale
    // version they can read by probing updateIfVersion.
    const visible =
      page && page.ownerId === input.ownerId && !page.archivedAt ? page : null;
    if (!visible || visible.contentVersion !== input.expectedVersion) {
      return {
        updated: false,
        currentVersion: visible?.contentVersion ?? 0,
      };
    }
    const nextVersion = visible.contentVersion + 1;
    this.rows.set(visible.id, {
      ...visible,
      content: input.content,
      plainText: input.plainText,
      contentVersion: nextVersion,
      updatedAt: input.updatedAt,
    });
    return { updated: true, version: nextVersion };
  }

  count(): number {
    return this.rows.size;
  }
}
