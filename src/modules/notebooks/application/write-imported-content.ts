import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { PAGE_ERROR } from "../domain/errors";
import type { PageRepository } from "../domain/page-repository";
import { extractPlainText, type TiptapDoc } from "../domain/plain-text";
import { tiptapDocSchema } from "./content-schema";
import { parseInput } from "./validation";

// .strict(): an extra top-level field, in particular plainText or
// plain_text, MUST make the whole input invalid, unlike savePageSchema
// which silently drops a client-sent plain_text (design.md invariant 1,
// Scenario: "Contenido inválido rechazado").
export const writeImportedContentSchema = z
  .object({
    pageId: z.string(),
    content: tiptapDocSchema,
    expectedVersion: z.number().int(),
  })
  .strict();

// Writes the first real content of a page created by another module (e.g.
// ingestion) with an atomic compare-and-swap on content_version
// (design.md, "writeImportedContent en notebooks, con
// comparar-e-intercambiar"). Called only through
// NotebooksServerApi.writeImportedContent (server-api.ts); no other module
// writes to `pages` directly (specs/notebooks/spec.md, "Escritura solo por
// la API pública").
export async function writeImportedContent(
  input: unknown,
  deps: { pages: PageRepository; clock: Clock },
  ownerId: string,
): Promise<Result<{ version: number }, DomainError>> {
  const parsed = parseInput(writeImportedContentSchema, input);
  if (!parsed.ok) return parsed;

  const content = parsed.value.content as TiptapDoc;
  // Invariant 2 (design.md): the initial content is never empty, unlike a
  // freshly created page's EMPTY_DOC.
  if (!content.content || content.content.length === 0) {
    return err(
      new DomainError(
        PAGE_ERROR.INVALID_CONTENT,
        "imported content must not be empty",
      ),
    );
  }

  const page = await deps.pages.findById(parsed.value.pageId);
  if (!page || page.ownerId !== ownerId || page.archivedAt) {
    return err(new DomainError(PAGE_ERROR.NOT_FOUND, parsed.value.pageId));
  }

  // plain_text is always materialized on the server, never accepted from
  // the caller (invariant 4).
  const plainText = extractPlainText(content);

  // updateIfVersion is an atomic conditional UPDATE, never a
  // read-compare-write (design.md, invariant 5).
  const result = await deps.pages.updateIfVersion({
    pageId: parsed.value.pageId,
    ownerId,
    expectedVersion: parsed.value.expectedVersion,
    content,
    plainText,
    updatedAt: deps.clock.now(),
  });

  if (!result.updated) {
    return err(
      new DomainError(
        PAGE_ERROR.VERSION_CONFLICT,
        `current version is ${result.currentVersion}`,
      ),
    );
  }
  return ok({ version: result.version });
}
