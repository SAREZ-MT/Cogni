import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createEditorExtensions } from "./index";

// S6b (odd/tasks/app-shell-restyle.md), Editor directive: the free
// `@tiptap/extension-node-range` decorates a Shift/Ctrl multi-block
// selection with `ProseMirror-selectednoderange` (styled in globals.css
// with Cogni tokens), matching the Tiptap docs Notion-style editor's
// block-selection affordance. Unlike the React `DragHandle` component
// (which needs no extension registered — see block-handle.tsx), `NodeRange`
// is a standalone ProseMirror extension and must be registered here to run
// at all.
describe("NodeRange extension", () => {
  it("is registered in the editor extension set", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>hola</p>",
    });
    try {
      expect(
        editor.extensionManager.extensions.some(
          (extension) => extension.name === "nodeRange",
        ),
      ).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});
