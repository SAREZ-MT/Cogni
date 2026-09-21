import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { NOTEBOOK_ERROR } from "../domain/errors";
import type { Notebook } from "../domain/notebook";
import { validateTitle } from "../domain/notebook";
import type { NotebookRepository } from "../domain/notebook-repository";
import { parseInput } from "./validation";

export const renameNotebookSchema = z.object({
  notebookId: z.string(),
  title: z.string(),
});

export async function renameNotebook(
  input: unknown,
  deps: { notebooks: NotebookRepository; clock: Clock },
  ownerId: string,
): Promise<Result<Notebook, DomainError>> {
  const parsed = parseInput(renameNotebookSchema, input);
  if (!parsed.ok) return parsed;

  const notebook = await deps.notebooks.findById(parsed.value.notebookId);
  if (!notebook || notebook.ownerId !== ownerId) {
    return err(
      new DomainError(NOTEBOOK_ERROR.NOT_FOUND, parsed.value.notebookId),
    );
  }

  const title = validateTitle(parsed.value.title);
  if (!title.ok) return title;

  const updated: Notebook = {
    ...notebook,
    title: title.value,
    updatedAt: deps.clock.now(),
  };
  await deps.notebooks.update(updated);
  return ok(updated);
}
