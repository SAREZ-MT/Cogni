import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { PAGE_ERROR } from "../domain/errors";
import { validateTitle } from "../domain/notebook";
import type { Page } from "../domain/page";
import type { PageRepository } from "../domain/page-repository";
import { parseInput } from "./validation";

export const renamePageSchema = z.object({
  pageId: z.string(),
  title: z.string(),
});

export async function renamePage(
  input: unknown,
  deps: { pages: PageRepository; clock: Clock },
  ownerId: string,
): Promise<Result<Page, DomainError>> {
  const parsed = parseInput(renamePageSchema, input);
  if (!parsed.ok) return parsed;

  const page = await deps.pages.findById(parsed.value.pageId);
  if (!page || page.ownerId !== ownerId) {
    return err(new DomainError(PAGE_ERROR.NOT_FOUND, parsed.value.pageId));
  }

  const title = validateTitle(parsed.value.title);
  if (!title.ok) return title;

  const updated: Page = {
    ...page,
    title: title.value,
    updatedAt: deps.clock.now(),
  };
  await deps.pages.update(updated);
  return ok(updated);
}
