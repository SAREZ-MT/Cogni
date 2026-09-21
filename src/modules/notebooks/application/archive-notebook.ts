import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { NOTEBOOK_ERROR } from "../domain/errors";
import type { Notebook } from "../domain/notebook";
import type { NotebookRepository } from "../domain/notebook-repository";
import type { PageRepository } from "../domain/page-repository";
import { parseInput } from "./validation";

export const archiveNotebookSchema = z.object({ notebookId: z.string() });

// Archiving a notebook MUST also hide its pages (specs/notebooks/spec.md,
// "Cuaderno archivado desaparece con sus paginas"). Both the notebook and
// each of its active pages set the same archivedAt instant.
export async function archiveNotebook(
  input: unknown,
  deps: { notebooks: NotebookRepository; pages: PageRepository; clock: Clock },
  ownerId: string,
): Promise<Result<Notebook, DomainError>> {
  const parsed = parseInput(archiveNotebookSchema, input);
  if (!parsed.ok) return parsed;

  const notebook = await deps.notebooks.findById(parsed.value.notebookId);
  if (!notebook || notebook.ownerId !== ownerId) {
    return err(
      new DomainError(NOTEBOOK_ERROR.NOT_FOUND, parsed.value.notebookId),
    );
  }

  // Idempotent: archiving an already archived notebook is a success that
  // does not touch archivedAt or re-archive its pages.
  if (notebook.archivedAt) return ok(notebook);

  const archivedAt = deps.clock.now();
  const updated: Notebook = { ...notebook, archivedAt, updatedAt: archivedAt };
  await deps.notebooks.update(updated);

  const activePages = await deps.pages.listActiveByNotebook(notebook.id);
  for (const page of activePages) {
    await deps.pages.update({ ...page, archivedAt, updatedAt: archivedAt });
  }

  return ok(updated);
}
