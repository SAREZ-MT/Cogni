import { Editor } from "@tiptap/core";
import { NodeRangeSelection } from "@tiptap/extension-node-range";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { collapseBlockSelection } from "./block-selection";
import { createEditorExtensions } from "./extensions";

// S6b defect 1 (data loss, odd/tasks/app-shell-restyle.md): after a block
// drag-and-drop, @tiptap/extension-drag-handle's own `appendTransaction`
// (`buildRestoreTransaction` in the package's dist bundle) restores a
// `NodeRangeSelection` over the dropped blocks. Left in place, ProseMirror's
// default "typing over a node/node-range selection replaces it" behaviour
// means the very next keystroke destroys the moved block instead of
// inserting a character — reproduced by the orchestrator in Chromium.
// `collapseBlockSelection` is the pure fix: it turns any leftover block
// selection into a plain caret, matching the Tiptap docs Notion-style
// editor's own post-drop behaviour.
function createHeadlessEditor(content: string) {
  return new Editor({ extensions: createEditorExtensions(), content });
}

describe("collapseBlockSelection", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("turns a NodeSelection on a paragraph into a TextSelection at its content start", () => {
    editor = createHeadlessEditor("<p>primero</p><p>segundo</p>");
    editor.commands.setNodeSelection(0);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);

    collapseBlockSelection(editor);

    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.empty).toBe(true);
  });

  it("turns a NodeRangeSelection over two blocks into a TextSelection at the first block's content start", () => {
    editor = createHeadlessEditor("<p>primero</p><p>segundo</p><p>tercero</p>");
    const { doc } = editor.state;
    const nodeRangeSelection = NodeRangeSelection.create(
      doc,
      0,
      doc.content.size,
    );
    editor.view.dispatch(editor.state.tr.setSelection(nodeRangeSelection));
    expect(editor.state.selection).toBeInstanceOf(NodeRangeSelection);

    collapseBlockSelection(editor);

    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.from).toBe(1);
  });

  it("leaves a plain TextSelection untouched", () => {
    editor = createHeadlessEditor("<p>hola cogni</p>");
    editor.commands.setTextSelection(3);
    const before = editor.state.selection;

    collapseBlockSelection(editor);

    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.eq(before)).toBe(true);
  });

  it("does not throw for an atom node (image block) and leaves a valid selection", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "a" }] },
          { type: "image", attrs: { assetId: null } },
        ],
      } as unknown as Record<string, unknown>,
    });
    let imagePos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "image") imagePos = pos;
    });
    editor.commands.setNodeSelection(imagePos);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);

    expect(() => collapseBlockSelection(editor)).not.toThrow();
    expect(editor.state.selection.from).toBe(imagePos);
  });
});
