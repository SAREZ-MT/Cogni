import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { describe, expect, it } from "vitest";
import { createEditorExtensions } from "./extensions";
import { isTableCellSelection } from "./table-selection";

const TABLE_HTML =
  "<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>";

function cellPositions(editor: Editor): number[] {
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "tableCell") positions.push(pos);
    return true;
  });
  return positions;
}

describe("isTableCellSelection", () => {
  it("is true for a CellSelection spanning several cells", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: TABLE_HTML,
    });
    try {
      const [first, , , last] = cellPositions(editor);
      const { doc, tr } = editor.state;
      editor.view.dispatch(
        tr.setSelection(
          new CellSelection(doc.resolve(first), doc.resolve(last)),
        ),
      );
      expect(isTableCellSelection(editor.state.selection)).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("is false for a plain text selection that merely sits inside a cell", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: TABLE_HTML,
    });
    try {
      const [first] = cellPositions(editor);
      const { doc, tr } = editor.state;
      editor.view.dispatch(
        tr.setSelection(TextSelection.create(doc, first + 2)),
      );
      expect(editor.isActive("table")).toBe(true);
      expect(isTableCellSelection(editor.state.selection)).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});
