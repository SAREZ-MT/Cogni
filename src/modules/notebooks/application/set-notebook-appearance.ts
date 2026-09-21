import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { NOTEBOOK_ERROR } from "../domain/errors";
import { type Notebook, validateColor } from "../domain/notebook";
import type { NotebookRepository } from "../domain/notebook-repository";
import { parseInput } from "./validation";

export const setNotebookAppearanceSchema = z.object({
  notebookId: z.string(),
  icon: z.string().nullish(),
  color: z.string().nullish(),
});

export async function setNotebookAppearance(
  input: unknown,
  deps: { notebooks: NotebookRepository; clock: Clock },
  ownerId: string,
): Promise<Result<Notebook, DomainError>> {
  const parsed = parseInput(setNotebookAppearanceSchema, input);
  if (!parsed.ok) return parsed;

  const notebook = await deps.notebooks.findById(parsed.value.notebookId);
  if (!notebook || notebook.ownerId !== ownerId) {
    return err(
      new DomainError(NOTEBOOK_ERROR.NOT_FOUND, parsed.value.notebookId),
    );
  }

  const color = validateColor(
    parsed.value.color === undefined ? notebook.color : parsed.value.color,
  );
  if (!color.ok) return color;

  const updated: Notebook = {
    ...notebook,
    icon: parsed.value.icon === undefined ? notebook.icon : parsed.value.icon,
    color: color.value,
    updatedAt: deps.clock.now(),
  };
  await deps.notebooks.update(updated);
  return ok(updated);
}
