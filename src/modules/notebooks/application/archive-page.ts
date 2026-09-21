import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { PAGE_ERROR } from "../domain/errors";
import type { Page } from "../domain/page";
import type { PageRepository } from "../domain/page-repository";
import { parseInput } from "./validation";

export const archivePageSchema = z.object({ pageId: z.string() });

export async function archivePage(
  input: unknown,
  deps: { pages: PageRepository; clock: Clock },
  ownerId: string,
): Promise<Result<Page, DomainError>> {
  const parsed = parseInput(archivePageSchema, input);
  if (!parsed.ok) return parsed;

  const page = await deps.pages.findById(parsed.value.pageId);
  if (!page || page.ownerId !== ownerId) {
    return err(new DomainError(PAGE_ERROR.NOT_FOUND, parsed.value.pageId));
  }

  // Idempotent: archiving an already archived page keeps its original
  // archivedAt (specs/notebooks/spec.md, "Archivado repetido").
  if (page.archivedAt) return ok(page);

  const archivedAt = deps.clock.now();
  const updated: Page = { ...page, archivedAt, updatedAt: archivedAt };
  await deps.pages.update(updated);
  return ok(updated);
}
