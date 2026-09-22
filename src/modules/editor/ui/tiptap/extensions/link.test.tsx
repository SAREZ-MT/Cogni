import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createEditorExtensions } from "./index";

// specs/editor/spec.md, "Marcas de texto", Scenario "Enlace con esquema no
// permitido": a `javascript:` link must be rejected and the text must stay
// unmarked. Uses Tiptap's headless `Editor` (no React render needed) per
// the sdd-apply instructions for this batch.
function createHeadlessEditor() {
  return new Editor({
    extensions: createEditorExtensions(),
    content: "<p>click me</p>",
  });
}

describe("link extension", () => {
  it("rejects a javascript: URL and leaves the text unmarked", () => {
    const editor = createHeadlessEditor();
    // destroy() must run even if an assertion throws, otherwise
    // ProseMirror's DOMObserver setTimeout flush can fire after Vitest has
    // torn down jsdom for this file, throwing "document is not defined".
    try {
      editor.commands.selectAll();

      const applied = editor.commands.setLink({ href: "javascript:alert(1)" });

      expect(applied).toBe(false);
      const json = editor.getJSON();
      const textNode = json.content?.[0]?.content?.[0];
      expect(textNode?.marks ?? []).toHaveLength(0);
    } finally {
      editor.destroy();
    }
  });

  it("accepts an https URL and applies the mark with the required rel/target", () => {
    const editor = createHeadlessEditor();
    // See the destroy() note above: must run on every path.
    try {
      editor.commands.selectAll();

      const applied = editor.commands.setLink({ href: "https://cogni.app" });

      expect(applied).toBe(true);
      const html = editor.getHTML();
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('target="_blank"');
      expect(html).not.toContain("nofollow");
    } finally {
      editor.destroy();
    }
  });

  it("accepts a mailto URL", () => {
    const editor = createHeadlessEditor();
    // See the destroy() note above: must run on every path.
    try {
      editor.commands.selectAll();

      const applied = editor.commands.setLink({ href: "mailto:tu@cogni.app" });

      expect(applied).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});
