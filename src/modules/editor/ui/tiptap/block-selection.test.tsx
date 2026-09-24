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

function findFirstNode(editor: Editor, typeName: string) {
  const node = editor.$node(typeName);
  return { pos: node?.pos ?? -1, size: node?.size ?? 0 };
}
// R3-container-drop-nodeselection-data-loss
function expectDropKeepsBlock(editor: Editor, typeName: string) {
  const { pos, size } = findFirstNode(editor, typeName);
  editor.commands.setNodeSelection(pos);
  collapseBlockSelection(editor);
  expect(editor.state.selection).toBeInstanceOf(TextSelection);
  const { from } = editor.state.selection;
  expect(from >= pos && from <= pos + size).toBe(true);
  editor.commands.insertContent("x");
  const json = editor.getJSON();
  expect(json.content?.some((n) => n.type === typeName)).toBe(true);
  expect(JSON.stringify(json)).toContain("x");
}
function toggledEditor(toggle: (e: Editor) => void) {
  const e = createHeadlessEditor("<p>hola</p>");
  e.commands.selectAll();
  toggle(e);
  return e;
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

  it.each<[string, () => Editor]>([
    ["bulletList", () => toggledEditor((e) => e.commands.toggleBulletList())],
    ["blockquote", () => toggledEditor((e) => e.commands.toggleBlockquote())],
    ["taskList", () => toggledEditor((e) => e.commands.toggleTaskList())],
    [
      "callout",
      () => createHeadlessEditor('<div data-type="callout"><p>h</p></div>'),
    ],
  ])("keeps a dropped %s, landing a TextSelection inside it", (typeName, build) => {
    editor = build();
    expectDropKeepsBlock(editor, typeName);
  });

  // Tables normalize setNodeSelection into a CellSelection; NodeRangeSelection is drag-handle's real shape.
  it("lands a TextSelection inside a dropped table, not a NodeSelection", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p></p>",
    });
    editor
      .chain()
      .insertTable({ rows: 1, cols: 1, withHeaderRow: false })
      .run();
    const { pos, size } = findFirstNode(editor, "table");
    const range = NodeRangeSelection.create(editor.state.doc, pos, pos + size);
    editor.view.dispatch(editor.state.tr.setSelection(range));

    collapseBlockSelection(editor);

    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    const { from } = editor.state.selection;
    expect(from >= pos && from <= pos + size).toBe(true);
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
