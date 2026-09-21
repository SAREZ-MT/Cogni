import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, type Result } from "@/shared/kernel/result";
import { NOTEBOOK_ERROR } from "../domain/errors";
import type { NotebookRepository } from "../domain/notebook-repository";
import { createPage as newPage, type Page } from "../domain/page";
import type { PageRepository } from "../domain/page-repository";
import { parseInput } from "./validation";

export const createPageSchema = z.object({
  notebookId: z.string(),
  title: z.string().optional(),
});

export async function createPage(
  input: unknown,
  deps: { notebooks: NotebookRepository; pages: PageRepository; clock: Clock },
  ownerId: string,
): Promise<Result<Page, DomainError>> {
  const parsed = parseInput(createPageSchema, input);
  if (!parsed.ok) return parsed;

  const notebook = await deps.notebooks.findById(parsed.value.notebookId);
  if (!notebook || notebook.ownerId !== ownerId) {
    return err(
      new DomainError(NOTEBOOK_ERROR.NOT_FOUND, parsed.value.notebookId),
    );
  }
  if (notebook.archivedAt) {
    return err(
      new DomainError(NOTEBOOK_ERROR.ARCHIVED, parsed.value.notebookId),
    );
  }

  const position = await deps.pages.nextPosition(notebook.id);
  const page = newPage(
    {
      id: createId(),
      ownerId,
      notebookId: notebook.id,
      title: parsed.value.title,
      position,
    },
    deps.clock,
  );
  if (!page.ok) return page;

  await deps.pages.create(page.value);
  return page;
}
