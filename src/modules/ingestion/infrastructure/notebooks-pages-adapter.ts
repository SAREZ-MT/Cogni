import {
  createNotebooksServerApi,
  type NotebooksServerApi,
} from "@/modules/notebooks";
import type { Db } from "@/shared/db/client";
import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { ImportedDoc } from "../domain/imported-doc";
import type { NotebookPagesPort } from "../domain/notebook-pages-port";

// design.md, "Interfaces / Contracts" — wraps createNotebooksServerApi
// (notebooks' public API; cross-module-via-index in
// .dependency-cruiser.cjs forbids reaching past it) to implement
// NotebookPagesPort one-to-one. Every method is a direct pass-through:
// NotebooksServerApi's shape already matches the port (server-api.ts's own
// comments document the mirroring). `writeImportedContent` passes an
// ImportedDoc where notebooks expects a TiptapDoc; if the two shapes ever
// diverge, `tsc --noEmit` fails right here (design.md, "Decision: Tipo
// ImportedDoc estructural").
export class NotebooksPagesAdapter implements NotebookPagesPort {
  private readonly api: NotebooksServerApi;

  constructor(db: Db) {
    this.api = createNotebooksServerApi({ db });
  }

  async findActiveNotebook(
    ownerId: string,
    notebookId: string,
  ): Promise<{ id: string } | null> {
    return this.api.findActiveNotebook(ownerId, notebookId);
  }

  async createPage(
    ownerId: string,
    input: { notebookId: string; title?: string },
  ): Promise<Result<{ id: string; notebookId: string }, DomainError>> {
    return this.api.createPage(ownerId, input);
  }

  async findPageNotebookId(
    ownerId: string,
    pageId: string,
  ): Promise<string | null> {
    return this.api.findPageNotebookId(ownerId, pageId);
  }

  async writeImportedContent(
    ownerId: string,
    input: { pageId: string; content: ImportedDoc; expectedVersion: number },
  ): Promise<Result<{ version: number }, DomainError>> {
    return this.api.writeImportedContent(ownerId, input);
  }
}
