import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { PAGE_ERROR } from "../domain/errors";
import type { PageRepository } from "../domain/page-repository";
import { extractPlainText, type TiptapDoc } from "../domain/plain-text";
import { parseInput } from "./validation";

const tiptapNodeSchema: z.ZodType<{
  type: string;
  content?: unknown[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}> = z.object({
  type: z.string(),
  content: z.array(z.lazy(() => tiptapNodeSchema)).optional(),
  text: z.string().optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  marks: z
    .array(
      z.object({
        type: z.string(),
        attrs: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

// content MUST have a "doc" root node (Scenario: "Contenido que no es un
// documento Tiptap"). plain_text is intentionally not part of this schema:
// a client-sent plain_text is dropped by parseInput before it ever reaches
// the domain (Scenario: "plain_text enviado por el cliente ignorado").
export const savePageSchema = z.object({
  pageId: z.string(),
  expectedVersion: z.number().int(),
  content: z.object({
    type: z.literal("doc"),
    content: z.array(tiptapNodeSchema).optional(),
  }),
});

export async function savePage(
  input: unknown,
  deps: { pages: PageRepository; clock: Clock },
  ownerId: string,
): Promise<Result<{ version: number }, DomainError>> {
  const parsed = parseInput(savePageSchema, input);
  if (!parsed.ok) return parsed;

  const page = await deps.pages.findById(parsed.value.pageId);
  if (!page || page.ownerId !== ownerId || page.archivedAt) {
    return err(new DomainError(PAGE_ERROR.NOT_FOUND, parsed.value.pageId));
  }

  const plainText = extractPlainText(parsed.value.content as TiptapDoc);

  // updateIfVersion is an atomic conditional UPDATE, never a
  // read-compare-write (design.md).
  const result = await deps.pages.updateIfVersion({
    pageId: parsed.value.pageId,
    ownerId,
    expectedVersion: parsed.value.expectedVersion,
    content: parsed.value.content as TiptapDoc,
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
