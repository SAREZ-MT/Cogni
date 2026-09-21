import { z } from "zod";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { PAGE_ERROR } from "../domain/errors";
import type { Page } from "../domain/page";
import type { PageRepository } from "../domain/page-repository";
import { parseInput } from "./validation";

export const getPageSchema = z.object({ pageId: z.string() });

// Ownership is enforced here, not in the database: the server connection
// bypasses RLS, so application code must filter (identity's get-profile.ts
// pattern). archived_at counts as not found (specs/notebooks/spec.md).
export async function getPage(
  input: unknown,
  deps: { pages: PageRepository },
  ownerId: string,
): Promise<Result<Page, DomainError>> {
  const parsed = parseInput(getPageSchema, input);
  if (!parsed.ok) return parsed;

  const page = await deps.pages.findById(parsed.value.pageId);
  if (!page || page.ownerId !== ownerId || page.archivedAt) {
    return err(new DomainError(PAGE_ERROR.NOT_FOUND, parsed.value.pageId));
  }
  return ok(page);
}
