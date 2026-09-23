import { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { ImportedDoc } from "../../domain/imported-doc";
import type { NotebookPagesPort } from "../../domain/notebook-pages-port";

interface FakeNotebook {
  id: string;
  ownerId: string;
  active: boolean;
}

interface FakePage {
  id: string;
  ownerId: string;
  notebookId: string;
  title?: string;
  content: ImportedDoc | null;
  version: number;
}

// The literal codes notebooks/domain/errors.ts's PAGE_ERROR exports.
// Hardcoded (not imported) because `cross-module-via-index` forbids
// `ingestion` from reaching into `notebooks` for anything but its public
// index, and this fake must stay a pure double regardless.
const PAGE_NOT_FOUND = "PAGE_NOT_FOUND";
const PAGE_VERSION_CONFLICT = "PAGE_VERSION_CONFLICT";

// Test double for NotebookPagesPort — a minimal in-memory notebooks+pages
// world, just enough for `requestPdfUpload`/`startPdfImport` (T5) and
// `processImportJob` (T6) to exercise every branch without depending on
// the real `notebooks` module.
export class FakeNotebookPagesPort implements NotebookPagesPort {
  private readonly notebooks = new Map<string, FakeNotebook>();
  private readonly pages = new Map<string, FakePage>();
  private forcedCreatePageError: DomainError | null = null;

  readonly createPageCalls: Array<{
    ownerId: string;
    notebookId: string;
    title?: string;
  }> = [];
  readonly writeImportedContentCalls: Array<{
    ownerId: string;
    pageId: string;
  }> = [];

  addNotebook(notebook: FakeNotebook): void {
    this.notebooks.set(notebook.id, notebook);
  }

  getPage(pageId: string): FakePage | undefined {
    return this.pages.get(pageId);
  }

  // Forces the next createPage() call to fail — simulates the notebook
  // being archived/deleted between the active-notebook check and page
  // creation, so callers can exercise that error-propagation branch.
  forceNextCreatePageError(error: DomainError): void {
    this.forcedCreatePageError = error;
  }

  async findActiveNotebook(
    ownerId: string,
    notebookId: string,
  ): Promise<{ id: string } | null> {
    const notebook = this.notebooks.get(notebookId);
    if (!notebook || notebook.ownerId !== ownerId || !notebook.active) {
      return null;
    }
    return { id: notebook.id };
  }

  async createPage(
    ownerId: string,
    input: { notebookId: string; title?: string },
  ): Promise<Result<{ id: string; notebookId: string }, DomainError>> {
    this.createPageCalls.push({ ownerId, ...input });
    if (this.forcedCreatePageError) {
      const error = this.forcedCreatePageError;
      this.forcedCreatePageError = null;
      return err(error);
    }
    const page: FakePage = {
      id: createId(),
      ownerId,
      notebookId: input.notebookId,
      title: input.title,
      content: null,
      version: 1,
    };
    this.pages.set(page.id, page);
    return ok({ id: page.id, notebookId: page.notebookId });
  }

  async writeImportedContent(
    ownerId: string,
    input: { pageId: string; content: ImportedDoc; expectedVersion: number },
  ): Promise<Result<{ version: number }, DomainError>> {
    this.writeImportedContentCalls.push({ ownerId, pageId: input.pageId });
    const page = this.pages.get(input.pageId);
    if (!page || page.ownerId !== ownerId) {
      return err(new DomainError(PAGE_NOT_FOUND, input.pageId));
    }
    if (page.version !== input.expectedVersion) {
      return err(new DomainError(PAGE_VERSION_CONFLICT, input.pageId));
    }
    page.content = input.content;
    page.version += 1;
    return ok({ version: page.version });
  }
}
