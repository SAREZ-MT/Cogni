import type { NotebookRepository } from "../../domain/notebook-repository";
import type { PageRepository } from "../../domain/page-repository";

// Phase 8 H19 removed the archive use cases (deleting is a real delete),
// but rows archived before it still exist and every read must keep hiding
// them. These fixtures set archived_at directly, as old data has it.
const ARCHIVED_AT = new Date("2026-10-01T10:00:00.000Z");

export async function markPageArchived(
  pages: PageRepository,
  pageId: string,
): Promise<void> {
  const page = await pages.findById(pageId);
  if (!page) throw new Error(`no page ${pageId}`);
  await pages.update({ ...page, archivedAt: ARCHIVED_AT });
}

export async function markNotebookArchived(
  deps: { notebooks: NotebookRepository; pages: PageRepository },
  notebookId: string,
): Promise<void> {
  const notebook = await deps.notebooks.findById(notebookId);
  if (!notebook) throw new Error(`no notebook ${notebookId}`);
  await deps.notebooks.update({ ...notebook, archivedAt: ARCHIVED_AT });
  for (const page of await deps.pages.listActiveByNotebook(notebookId)) {
    await deps.pages.update({ ...page, archivedAt: ARCHIVED_AT });
  }
}
