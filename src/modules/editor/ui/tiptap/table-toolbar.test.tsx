import { fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { describe, expect, it } from "vitest";
import { shouldShowBubbleToolbar } from "./bubble-toolbar";
import { createEditorExtensions } from "./extensions";
import { shouldShowTableToolbar, TableToolbarControls } from "./table-toolbar";

const TABLE_HTML =
  "<table><tbody><tr><th><p>a</p></th><th><p>b</p></th></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>";

function createTableEditor() {
  return new Editor({
    extensions: createEditorExtensions(),
    content: `${TABLE_HTML}<p>after</p>`,
  });
}

function cellPositions(editor: Editor): number[] {
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      positions.push(pos);
    }
    return true;
  });
  return positions;
}

function selectCaretInCell(editor: Editor, index: number) {
  const pos = cellPositions(editor)[index];
  const { doc, tr } = editor.state;
  editor.view.dispatch(tr.setSelection(TextSelection.create(doc, pos + 2)));
}

function selectCells(editor: Editor, from: number, to: number) {
  const positions = cellPositions(editor);
  const { doc, tr } = editor.state;
  editor.view.dispatch(
    tr.setSelection(
      new CellSelection(
        doc.resolve(positions[from]),
        doc.resolve(positions[to]),
      ),
    ),
  );
}

function rowTexts(editor: Editor): string[] {
  const rows: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "tableRow") rows.push(node.textContent);
    return true;
  });
  return rows;
}

function firstRowTexts(editor: Editor): string[] {
  const cells: string[] = [];
  editor.state.doc.firstChild?.firstChild?.forEach((cell) => {
    cells.push(cell.textContent);
  });
  return cells;
}

function rowCount(editor: Editor): number {
  let rows = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "tableRow") rows += 1;
    return true;
  });
  return rows;
}

function columnCount(editor: Editor): number {
  return editor.state.doc.firstChild?.firstChild?.childCount ?? 0;
}

describe("shouldShowTableToolbar", () => {
  it("is false when the selection is outside a table", () => {
    const editor = createTableEditor();
    try {
      editor.commands.setTextSelection(editor.state.doc.content.size - 2);
      expect(editor.isActive("table")).toBe(false);
      expect(shouldShowTableToolbar({ editor, state: editor.state })).toBe(
        false,
      );
    } finally {
      editor.destroy();
    }
  });

  it("is true for a caret resting in a cell", () => {
    const editor = createTableEditor();
    try {
      selectCaretInCell(editor, 2);
      expect(shouldShowTableToolbar({ editor, state: editor.state })).toBe(
        true,
      );
    } finally {
      editor.destroy();
    }
  });

  it("is true for a CellSelection and the bubble toolbar yields to it", () => {
    const editor = createTableEditor();
    try {
      selectCells(editor, 0, 3);
      expect(shouldShowTableToolbar({ editor, state: editor.state })).toBe(
        true,
      );
      const { from, to } = editor.state.selection;
      expect(
        shouldShowBubbleToolbar({ editor, state: editor.state, from, to }),
      ).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("is false for highlighted text inside a cell, where the bubble toolbar takes over", () => {
    const editor = createTableEditor();
    try {
      const pos = cellPositions(editor)[2];
      editor.commands.setTextSelection({ from: pos + 2, to: pos + 3 });
      expect(editor.isActive("table")).toBe(true);
      expect(shouldShowTableToolbar({ editor, state: editor.state })).toBe(
        false,
      );
      const { from, to } = editor.state.selection;
      expect(
        shouldShowBubbleToolbar({ editor, state: editor.state, from, to }),
      ).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});

describe("TableToolbarControls", () => {
  function setup() {
    const editor = createTableEditor();
    selectCaretInCell(editor, 2);
    render(<TableToolbarControls editor={editor} />);
    return editor;
  }

  it("exposes a labelled toolbar with every row, column, cell and delete action", () => {
    const editor = setup();
    try {
      expect(
        screen.getByRole("toolbar", { name: "Tabla" }),
      ).toBeInTheDocument();
      for (const id of [
        "add-row-before",
        "add-row-after",
        "add-column-before",
        "add-column-after",
        "merge-cells",
        "split-cell",
        "toggle-header-row",
        "delete-row",
        "delete-column",
        "delete-table",
      ]) {
        expect(screen.getByTestId(`table-toolbar-${id}`)).toBeInTheDocument();
      }
    } finally {
      editor.destroy();
    }
  });

  it("adds a row above and below the current one", () => {
    const editor = setup();
    try {
      expect(rowCount(editor)).toBe(2);
      fireEvent.click(screen.getByTestId("table-toolbar-add-row-before"));
      expect(rowCount(editor)).toBe(3);
      fireEvent.click(screen.getByTestId("table-toolbar-add-row-after"));
      expect(rowCount(editor)).toBe(4);
    } finally {
      editor.destroy();
    }
  });

  it("puts the new row above or below the caret's row, not elsewhere", () => {
    const editor = setup();
    try {
      // The caret sits in "c" (second row).
      fireEvent.click(screen.getByTestId("table-toolbar-add-row-before"));
      expect(rowTexts(editor)).toEqual(["ab", "", "cd"]);
    } finally {
      editor.destroy();
    }
  });

  it("puts a row added below right after the caret's row", () => {
    const editor = createTableEditor();
    selectCaretInCell(editor, 0);
    render(<TableToolbarControls editor={editor} />);
    try {
      fireEvent.click(screen.getByTestId("table-toolbar-add-row-after"));
      expect(rowTexts(editor)).toEqual(["ab", "", "cd"]);
    } finally {
      editor.destroy();
    }
  });

  it("puts the new column to the left or right of the caret's column", () => {
    const editor = createTableEditor();
    selectCaretInCell(editor, 1);
    render(<TableToolbarControls editor={editor} />);
    try {
      fireEvent.click(screen.getByTestId("table-toolbar-add-column-before"));
      expect(firstRowTexts(editor)).toEqual(["a", "", "b"]);
    } finally {
      editor.destroy();
    }
  });

  it("puts a column added to the right right after the caret's column", () => {
    const editor = createTableEditor();
    selectCaretInCell(editor, 0);
    render(<TableToolbarControls editor={editor} />);
    try {
      fireEvent.click(screen.getByTestId("table-toolbar-add-column-after"));
      expect(firstRowTexts(editor)).toEqual(["a", "", "b"]);
    } finally {
      editor.destroy();
    }
  });

  it("adds a column before and after the current one", () => {
    const editor = setup();
    try {
      expect(columnCount(editor)).toBe(2);
      fireEvent.click(screen.getByTestId("table-toolbar-add-column-before"));
      expect(columnCount(editor)).toBe(3);
      fireEvent.click(screen.getByTestId("table-toolbar-add-column-after"));
      expect(columnCount(editor)).toBe(4);
    } finally {
      editor.destroy();
    }
  });

  it("deletes the current row and the current column", () => {
    const editor = setup();
    try {
      fireEvent.click(screen.getByTestId("table-toolbar-delete-row"));
      expect(rowCount(editor)).toBe(1);
      fireEvent.click(screen.getByTestId("table-toolbar-delete-column"));
      expect(columnCount(editor)).toBe(1);
    } finally {
      editor.destroy();
    }
  });

  it("deletes the whole table", () => {
    const editor = setup();
    try {
      fireEvent.click(screen.getByTestId("table-toolbar-delete-table"));
      expect(editor.isActive("table")).toBe(false);
      expect(rowCount(editor)).toBe(0);
    } finally {
      editor.destroy();
    }
  });

  it("merges a selected cell range into one cell and splits it back", () => {
    const editor = createTableEditor();
    selectCells(editor, 2, 3);
    render(<TableToolbarControls editor={editor} />);
    try {
      fireEvent.click(screen.getByTestId("table-toolbar-merge-cells"));
      const lastRow = editor.state.doc.firstChild?.lastChild;
      expect(lastRow?.childCount).toBe(1);
      expect(lastRow?.firstChild?.attrs.colspan).toBe(2);

      fireEvent.click(screen.getByTestId("table-toolbar-split-cell"));
      expect(editor.state.doc.firstChild?.lastChild?.childCount).toBe(2);
    } finally {
      editor.destroy();
    }
  });

  it("toggles the header row", () => {
    const editor = setup();
    try {
      const firstCellType = () =>
        editor.state.doc.firstChild?.firstChild?.firstChild?.type.name;
      expect(firstCellType()).toBe("tableHeader");
      fireEvent.click(screen.getByTestId("table-toolbar-toggle-header-row"));
      expect(firstCellType()).toBe("tableCell");
    } finally {
      editor.destroy();
    }
  });
});
