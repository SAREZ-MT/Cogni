import { DomainError } from "@/shared/kernel/domain-error";
import { isValidId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import type {
  ContentDeletion,
  DeletedFiles,
  ImportSourceStorage,
  NotebookDeletionPreview,
  PageDeletionPreview,
} from "../domain/content-deletion";
import { NOTEBOOK_ERROR, PAGE_ERROR } from "../domain/errors";
import type { StorageGateway } from "../domain/storage-gateway";

interface PreviewDeps {
  deletion: ContentDeletion;
}

interface DeleteDeps extends PreviewDeps {
  storage: StorageGateway;
  importSources: ImportSourceStorage;
}

// Phase 8 H19: "Eliminar" of a notebook or a page is a real delete (it
// replaces archiving). The confirmation first reads what goes; the delete
// removes the target with everything below it in one transaction, then
// its files from Storage, best effort: a leftover object is owner-scoped
// and unreferenced, so a Storage failure is logged, never surfaced. A
// malformed, unknown or foreign id is NOT_FOUND, never a database error.

function idOf(input: unknown, key: "pageId" | "notebookId"): string | null {
  if (typeof input !== "object" || input === null) return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && isValidId(value) ? value : null;
}

async function removeFiles(
  files: DeletedFiles,
  deps: DeleteDeps,
): Promise<void> {
  for (const [bucket, remove, paths] of [
    ["page assets", deps.storage.remove.bind(deps.storage), files.assetPaths],
    [
      "import sources",
      deps.importSources.remove.bind(deps.importSources),
      files.importPaths,
    ],
  ] as const) {
    if (paths.length === 0) continue;
    try {
      await remove([...paths]);
    } catch (error) {
      console.error(`notebooks: removing deleted ${bucket} failed`, {
        count: paths.length,
        error,
      });
    }
  }
}

export async function previewPageDeletion(
  input: unknown,
  deps: PreviewDeps,
  ownerId: string,
): Promise<Result<PageDeletionPreview, DomainError>> {
  const pageId = idOf(input, "pageId");
  const preview = pageId && (await deps.deletion.previewPage(pageId, ownerId));
  if (!preview) return err(new DomainError(PAGE_ERROR.NOT_FOUND, "page"));
  return ok(preview);
}

export async function deletePage(
  input: unknown,
  deps: DeleteDeps,
  ownerId: string,
): Promise<Result<{ pageId: string }, DomainError>> {
  const pageId = idOf(input, "pageId");
  const files = pageId && (await deps.deletion.deletePage(pageId, ownerId));
  if (!pageId || !files) {
    return err(new DomainError(PAGE_ERROR.NOT_FOUND, "page"));
  }
  await removeFiles(files, deps);
  return ok({ pageId });
}

export async function previewNotebookDeletion(
  input: unknown,
  deps: PreviewDeps,
  ownerId: string,
): Promise<Result<NotebookDeletionPreview, DomainError>> {
  const notebookId = idOf(input, "notebookId");
  const preview =
    notebookId && (await deps.deletion.previewNotebook(notebookId, ownerId));
  if (!preview) {
    return err(new DomainError(NOTEBOOK_ERROR.NOT_FOUND, "notebook"));
  }
  return ok(preview);
}

export async function deleteNotebook(
  input: unknown,
  deps: DeleteDeps,
  ownerId: string,
): Promise<Result<{ notebookId: string }, DomainError>> {
  const notebookId = idOf(input, "notebookId");
  const files =
    notebookId && (await deps.deletion.deleteNotebook(notebookId, ownerId));
  if (!notebookId || !files) {
    return err(new DomainError(NOTEBOOK_ERROR.NOT_FOUND, "notebook"));
  }
  await removeFiles(files, deps);
  return ok({ notebookId });
}
