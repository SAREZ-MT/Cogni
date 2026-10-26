import { z } from "zod";
import { findBlockViolations } from "@/shared/kernel/tiptap-catalogue";

// Shared Tiptap document shape used by every use case that accepts page
// content (save-page.ts, write-imported-content.ts). Extracted so both
// enforce identical validation instead of duplicating the recursive node
// schema (design.md, "writeImportedContent en notebooks, con
// comparar-e-intercambiar").
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
// each use case's own top-level schema decides whether a client-sent
// plain_text is silently dropped (save-page.ts) or makes the whole input
// invalid (write-imported-content.ts, Scenario: "Contenido inválido
// rechazado").
export const tiptapDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(tiptapNodeSchema).optional(),
});

// Strict allow-list for the import path (writeImportedContent): every block
// must conform to the content catalogue (shared/kernel/tiptap-catalogue.ts)
// — known node and mark names, known attrs with valid values, the editor's
// nesting rules, http/https/mailto links only, no empty text nodes — so
// whatever an importer writes is something the editor renders. The editor
// autosave path keeps the permissive `tiptapDocSchema` above: existing pages
// may carry attrs the catalogue does not list yet. The "at least one block"
// rule stays with writeImportedContent's own invariant 2
// (PAGE_INVALID_CONTENT), so only the blocks are checked here.
export const tiptapContentSchema = z
  .unknown()
  // Checked on the raw input: tiptapDocSchema's z.object() would strip an
  // unknown node key (e.g. `html`) before a refinement could see it.
  .superRefine((raw, ctx) => {
    if (typeof raw !== "object" || raw === null) return;
    const blocks = (raw as { content?: unknown }).content;
    if (!Array.isArray(blocks)) return;
    blocks.forEach((block, index) => {
      for (const violation of findBlockViolations(block, ["content", index])) {
        ctx.addIssue({
          code: "custom",
          message: violation.message,
          path: violation.path,
        });
      }
    });
  })
  .pipe(tiptapDocSchema);
