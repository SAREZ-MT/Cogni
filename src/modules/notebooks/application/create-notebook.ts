import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import type { Result } from "@/shared/kernel/result";
import {
  COLOR_PALETTE,
  type Notebook,
  createNotebook as newNotebook,
} from "../domain/notebook";
import type { NotebookRepository } from "../domain/notebook-repository";
import { parseInput } from "./validation";

// Zod only checks shape here; semantic rules (title trimmed/non-empty,
// color in the pastel palette) live in domain/notebook.ts so their
// DomainError codes stay meaningful (NOTEBOOK_INVALID_TITLE/_COLOR).
export const createNotebookSchema = z.object({
  title: z.string(),
  icon: z.string().nullish(),
  color: z.string().nullish(),
});

// Every new notebook gets a random pastel color when none was supplied, so
// the library/Home tiles are never a flat neutral tile on creation (user
// decision, design pass 2). `color` stays optional in the schema/domain so
// legacy rows created before this rule (or seeded directly) can still carry
// `null`, but this use case never persists that state for a new notebook.
function pickRandomColor(): (typeof COLOR_PALETTE)[number] {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

export async function createNotebook(
  input: unknown,
  deps: { notebooks: NotebookRepository; clock: Clock },
  ownerId: string,
): Promise<Result<Notebook, DomainError>> {
  const parsed = parseInput(createNotebookSchema, input);
  if (!parsed.ok) return parsed;

  const position = await deps.notebooks.nextPosition(ownerId);
  const notebook = newNotebook(
    {
      id: createId(),
      ownerId,
      title: parsed.value.title,
      icon: parsed.value.icon,
      color: parsed.value.color ?? pickRandomColor(),
      position,
    },
    deps.clock,
  );
  if (!notebook.ok) return notebook;

  await deps.notebooks.create(notebook.value);
  return notebook;
}
