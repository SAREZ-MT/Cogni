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

    describe("inside a container block", () => {
      function setup(html: string): Editor {
        const e = new Editor({
          extensions: createEditorExtensions(),
          content: html,
        });
        return e;
      }

      // Position of the first character of the first text node whose content
      // starts with `needle` (the caret at the very start of that textblock).
      function startOf(e: Editor, needle: string): number {
        let found = -1;
        e.state.doc.descendants((node, pos) => {
          if (found < 0 && node.isText && node.text?.startsWith(needle)) {
            found = pos;
          }
        });
        return found;
      }

      it("deletes only the current bullet list item, not the whole list", () => {
        const e = setup("<ul><li><p>uno</p></li><li><p>dos</p></li></ul>");
        e.commands.setTextSelection(startOf(e, "dos"));

        expect(press(e, { key: "Backspace" })).toBe(true);

        expect(e.state.doc.textContent).toBe("uno");
        expect(e.state.doc.child(0).type.name).toBe("bulletList");
        expect(e.state.doc.child(0).childCount).toBe(1);
        e.destroy();
      });

      it("deletes the whole list once its last item is the one removed", () => {
        const e = setup("<ul><li><p>solo</p></li></ul><p>fin</p>");
        e.commands.setTextSelection(startOf(e, "solo"));

        expect(press(e, { key: "Backspace" })).toBe(true);

        expect(texts(e)).toEqual(["fin"]);
        e.destroy();
      });

      it("deletes only the current task item", () => {
        const e = setup(
          '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>a</p></li><li data-type="taskItem" data-checked="false"><p>b</p></li></ul>',
        );
        e.commands.setTextSelection(startOf(e, "a"));

        expect(press(e, { key: "Backspace" })).toBe(true);

        expect(e.state.doc.child(0).type.name).toBe("taskList");
        expect(e.state.doc.child(0).childCount).toBe(1);
        expect(e.state.doc.textContent).toBe("b");
        e.destroy();
      });

      it("deletes the item with its nested sublist, keeping its siblings", () => {
        const e = setup(
          "<ul><li><p>uno</p><ul><li><p>hijo</p></li></ul></li><li><p>dos</p></li></ul>",
        );
        e.commands.setTextSelection(startOf(e, "uno"));

        expect(press(e, { key: "Backspace" })).toBe(true);

        expect(e.state.doc.textContent).toBe("dos");
        e.destroy();
      });

      it("deletes only the current paragraph inside a blockquote", () => {
        const e = setup("<blockquote><p>uno</p><p>dos</p></blockquote>");
        e.commands.setTextSelection(startOf(e, "dos"));

        expect(press(e, { key: "Backspace" })).toBe(true);

        expect(e.state.doc.child(0).type.name).toBe("blockquote");
        expect(e.state.doc.child(0).childCount).toBe(1);
        expect(e.state.doc.textContent).toBe("uno");
        e.destroy();
      });

      it("deletes only the current paragraph inside a callout", () => {
        const e = setup(
          '<div data-type="callout"><p>uno</p><p>dos</p></div><p>fuera</p>',
        );
        e.commands.setTextSelection(startOf(e, "dos"));

        expect(press(e, { key: "Backspace" })).toBe(true);

        expect(e.state.doc.child(0).type.name).toBe("callout");
        expect(e.state.doc.child(0).childCount).toBe(1);
        expect(texts(e)).toEqual(["uno", "fuera"]);
        e.destroy();
      });

      it("removes the container when its only child is deleted", () => {
        const e = setup("<blockquote><p>solo</p></blockquote><p>fin</p>");
        e.commands.setTextSelection(startOf(e, "solo"));

        expect(press(e, { key: "Backspace" })).toBe(true);

        expect(texts(e)).toEqual(["fin"]);
        e.destroy();
      });

      it("leaves a table cell alone instead of deleting the table", () => {
        const e = setup(
          "<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>",
        );
        e.commands.setTextSelection(startOf(e, "b"));

        expect(press(e, { key: "Backspace" })).toBe(false);

        expect(e.state.doc.child(0).type.name).toBe("table");
        e.destroy();
      });
    });
  });
});
