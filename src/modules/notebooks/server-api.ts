// Server-side API other modules use to create pages and fill them with
// initial content (design.md, "writeImportedContent en notebooks, con
// comparar-e-intercambiar"). This is a composition root, like actions.ts,
// but with no "use server" directive: unlike a Server Action it is not a
// client-reachable entry point, so a plain object of async functions is
// enough for ingestion/infrastructure to call it through
// NotebookPagesPort (T7).
import type { Db } from "@/shared/db/client";
import { type Clock, systemClock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import { createPage as createPageUseCase } from "./application/create-page";
import { getPage as getPageUseCase } from "./application/get-page";
import { writeImportedContent as writeImportedContentUseCase } from "./application/write-imported-content";
import type { PageTextReader } from "./domain/page-text-reader";
import type { TiptapDoc } from "./domain/plain-text";
import {
  DrizzleNotebookRepository,
  DrizzlePageRepository,
} from "./infrastructure";

export interface NotebooksServerApi extends PageTextReader {
  // null when the notebook does not exist, belongs to another owner, or is
  // archived.
  findActiveNotebook(
    ownerId: string,
    notebookId: string,
  ): Promise<{ id: string } | null>;
  // Same rules as CreatePage: owner, active notebook, title rules, position
  // at the end. An undefined title falls back to DEFAULT_PAGE_TITLE
  // ("Sin título").
  createPage(
    ownerId: string,
    input: { notebookId: string; title?: string },
  ): Promise<Result<{ id: string; notebookId: string }, DomainError>>;
  // Writes the first real content of a page with an atomic
  // compare-and-swap on content_version.
  writeImportedContent(
    ownerId: string,
    input: { pageId: string; content: TiptapDoc; expectedVersion: number },
  ): Promise<Result<{ version: number }, DomainError>>;
  // The page -> notebook lookup NotebookPagesPort.findPageNotebookId (T6)
  // needs: null when the page does not exist, belongs to another owner, is
  // archived, or its notebook does not exist, belongs to another owner or
  // is archived. Never leaks whether an unowned/archived page exists (T7a
  // deliverable; ingestion's NotebooksPagesAdapter, T7b, will implement
  // NotebookPagesPort.findPageNotebookId by calling this one-to-one).
  findPageNotebookId(ownerId: string, pageId: string): Promise<string | null>;
}

export function createNotebooksServerApi(deps: {
  db: Db;
  clock?: Clock;
}): NotebooksServerApi {
  const notebooks = new DrizzleNotebookRepository(deps.db);
  const pages = new DrizzlePageRepository(deps.db);
  const clock = deps.clock ?? systemClock;

  return {
    async findActiveNotebook(ownerId, notebookId) {
      const notebook = await notebooks.findById(notebookId);
      if (!notebook || notebook.ownerId !== ownerId || notebook.archivedAt) {
        return null;
      }
      return { id: notebook.id };
    },

    async createPage(ownerId, input) {
      const result = await createPageUseCase(
        input,
        { notebooks, pages, clock },
        ownerId,
      );
      if (!result.ok) return result;
      return ok({ id: result.value.id, notebookId: result.value.notebookId });
    },

    async writeImportedContent(ownerId, input) {
      return writeImportedContentUseCase(input, { pages, clock }, ownerId);
    },

    async getPageText(pageId, ownerId) {
      const result = await getPageUseCase({ pageId }, { pages }, ownerId);
      if (!result.ok) return result;
      return ok({
        title: result.value.title,
        plainText: result.value.plainText,
      });
    },

    async findPageNotebookId(ownerId, pageId) {
      const page = await pages.findById(pageId);
      if (!page || page.ownerId !== ownerId || page.archivedAt) return null;
      const notebook = await notebooks.findById(page.notebookId);
      // T7a review follow-up (R3-notebook-owner-unchecked): a page's own
      // ownerId should always match its notebook's, but this defends
      // against a data inconsistency instead of trusting that invariant
      // silently.
      if (!notebook || notebook.ownerId !== ownerId || notebook.archivedAt) {
        return null;
      }
      return page.notebookId;
    },
  };
}
