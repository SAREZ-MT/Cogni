import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorExtensions } from "./index";

// ProseMirror's keymap runs from the view's `handleKeyDown` prop; `Mod` is
// Ctrl outside macOS (jsdom reports no platform).
function press(editor: Editor, init: KeyboardEventInit): boolean {
  const event = new KeyboardEvent("keydown", {
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  return Boolean(
    editor.view.someProp("handleKeyDown", (handler) =>
      handler(editor.view, event),
    ),
  );
}

function texts(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.forEach((node) => {
    out.push(node.textContent);
  });
  return out;
}

describe("BlockShortcuts", () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>uno</p><p>dos</p>",
    });
  });

  afterEach(() => {
    editor.destroy();
    vi.unstubAllGlobals();
  });

  describe("Mod-D", () => {
    it("duplicates the block under the cursor and claims the key", () => {
      editor.commands.setTextSelection(2);

      const handled = press(editor, { key: "d" });

      expect(handled).toBe(true);
      expect(texts(editor)).toEqual(["uno", "uno", "dos"]);
    });
  });

  describe("Mod-Shift-C", () => {
    it("copies the block under the cursor and claims the key", () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 2);

      const handled = press(editor, { key: "C", keyCode: 67, shiftKey: true });

      expect(handled).toBe(true);
      expect(writeText).toHaveBeenCalledWith("dos");
    });
  });

  describe("Mod-Backspace", () => {
    it("deletes the block when the caret sits at the very start of its content", () => {
      editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 1);

      const handled = press(editor, { key: "Backspace" });

      expect(handled).toBe(true);
      expect(texts(editor)).toEqual(["uno"]);
    });

    it("lets the default word-delete run when the caret is mid-block", () => {
      editor.commands.setTextSelection(3);

      const handled = press(editor, { key: "Backspace" });

      expect(handled).toBe(false);
      expect(texts(editor)).toEqual(["uno", "dos"]);
    });

    it("never removes the whole block when a range is selected", () => {
      editor.commands.setTextSelection({ from: 1, to: 3 });

      press(editor, { key: "Backspace" });

      expect(texts(editor)).toHaveLength(2);
      expect(texts(editor)[1]).toBe("dos");
    });
  });
});
