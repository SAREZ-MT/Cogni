import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createEditorExtensions } from "./extensions";
import { toPlainTiptapDoc } from "./to-plain-tiptap-doc";

// Root cause of the "writes every available block family" e2e failure:
// Tiptap/ProseMirror's getJSON() returns a node's `attrs` as a null-
// prototype object (`Object.create(null)`) whenever the node's attributes
// come from schema defaults (heading level, taskItem checked, codeBlock
// language — exactly the attrs-bearing blocks in that acceptance test).
// JSON.stringify()/console.log() on such a node look perfectly plain (they
// don't care about the prototype), but Next.js Server Actions serialize
// arguments through React's RSC/Flight protocol, which does not treat a
// null-prototype object the same as a plain one: on the server, that
// `attrs` value deserializes as a function instead of a record, and Zod's
// savePageSchema (`attrs: z.record(...)`) rejects the whole save with
// NOTEBOOKS_INVALID_INPUT ("invalid content") — every autosave request
// failing from the very first save. toPlainTiptapDoc() normalizes the
// document to plain, Object.prototype-based JSON right at the Tiptap/UI
// boundary (design.md, "Tiptap y ProseMirror solo en editor/ui") before it
// ever reaches the framework-agnostic autosave hook or a Server Action.
describe("toPlainTiptapDoc", () => {
  it("strips the null-prototype attrs Tiptap's getJSON() produces for default-valued attributes", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "hi" }],
          },
          {
            type: "codeBlock",
            attrs: { language: null },
            content: [{ type: "text", text: "x" }],
          },
        ],
      },
    });

    const raw = editor.getJSON();
    const rawHeadingAttrs = (raw.content?.[0] as { attrs?: object }).attrs;
    // Sanity check: the bug actually reproduces against the real library,
    // independent of environment (no browser needed).
    expect(Object.getPrototypeOf(rawHeadingAttrs)).not.toBe(Object.prototype);

    const plain = toPlainTiptapDoc(raw);

    for (const node of plain.content ?? []) {
      const attrs = (node as { attrs?: unknown }).attrs;
      if (attrs !== undefined && attrs !== null) {
        expect(Object.getPrototypeOf(attrs)).toBe(Object.prototype);
      }
    }
    expect(plain).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "hi" }],
        },
        {
          type: "codeBlock",
          attrs: { language: null },
          content: [{ type: "text", text: "x" }],
        },
      ],
    });
  });

  it("is a no-op for a document that is already plain JSON", () => {
    const doc = {
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text: "v1" }] }],
    };

    expect(toPlainTiptapDoc(doc)).toEqual(doc);
  });
});
