import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createEditorExtensions } from "./extensions";

function lastBlockType(editor: Editor): string | undefined {
  return editor.state.doc.lastChild?.type.name;
}

describe("trailing node", () => {
  it("keeps an empty paragraph after a table inserted at the end of the document", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>hola</p>",
    });
    try {
      editor.commands.focus("end");
      editor.commands.insertTable({ rows: 1, cols: 1, withHeaderRow: false });
      expect(editor.state.doc.childCount).toBeGreaterThanOrEqual(2);
      expect(lastBlockType(editor)).toBe("paragraph");
      expect(editor.state.doc.lastChild?.content.size).toBe(0);
    } finally {
      editor.destroy();
    }
  });

  it("adds the paragraph again when a block that ends the doc is inserted", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>hola</p>",
    });
    try {
      editor.commands.insertContentAt(editor.state.doc.content.size, {
        type: "horizontalRule",
      });
      expect(lastBlockType(editor)).toBe("paragraph");
      expect(editor.state.doc.childCount).toBe(3);
    } finally {
      editor.destroy();
    }
  });

  it("does not duplicate the paragraph when one already ends the document", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>uno</p><p>dos</p>",
    });
    try {
      expect(editor.state.doc.childCount).toBe(2);
      expect(editor.state.doc.lastChild?.textContent).toBe("dos");
    } finally {
      editor.destroy();
    }
  });
});

describe("editor extensions", () => {
  // StarterKit already registers `trailingNode`; registering it a second
  // time makes Tiptap warn about duplicate names and runs its
  // appendTransaction twice per change.
  it("registers every extension name exactly once", () => {
    const editor = new Editor({ extensions: createEditorExtensions() });
    try {
      const resolved = editor.extensionManager.extensions.map((e) => e.name);
      expect(resolved.filter((n) => n === "trailingNode")).toHaveLength(1);
      expect(new Set(resolved).size).toBe(resolved.length);
    } finally {
      editor.destroy();
    }
  });
});
