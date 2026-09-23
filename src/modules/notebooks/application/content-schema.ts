import { z } from "zod";

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
