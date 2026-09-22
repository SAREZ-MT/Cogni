import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { createTableExtensions } from "./table";

// specs/editor/spec.md, "Conjunto completo de bloques de §3.2", Scenario
// "Tabla editable": insert a table, add a row and a column, type in a
// cell, then confirm the serialized JSON keeps the new dimensions and
// text. Headless `@tiptap/core` Editor, no DOM rendering needed (same
// pattern as extensions/marks.test.tsx).
function createHeadlessEditor() {
  return new Editor({
    extensions: [StarterKit, ...createTableExtensions()],
    content: "<p></p>",
  });
}

interface TableNodeJSON {
  type: string;
  content?: Array<{ type: string; content?: unknown[] }>;
}

function findTable(json: { content?: unknown[] }): TableNodeJSON | undefined {
  return (json.content as TableNodeJSON[] | undefined)?.find(
    (node) => node.type === "table",
  );
}

describe("table extension", () => {
  it("inserts a 2x2 table with a header row", () => {
    const editor = createHeadlessEditor();
    // destroy() must run even if an assertion throws, otherwise
    // ProseMirror's DOMObserver setTimeout flush can fire after Vitest has
    // torn down jsdom for this file, throwing "document is not defined".
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

      const table = findTable(editor.getJSON());
      expect(table).toBeDefined();
      expect(table?.content).toHaveLength(2);
      expect(table?.content?.[0].content).toHaveLength(2);
    } finally {
      editor.destroy();
    }
  });

  it("adds a row and a column, then types in a cell and keeps the new dimensions and text after serializing", () => {
    const editor = createHeadlessEditor();
    // See the destroy() note above: must run on every path.
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

      // Place the cursor in the first cell before growing the table.
      editor.commands.setTextSelection(4);
      editor.commands.addRowAfter();
      editor.commands.addColumnAfter();
      editor.commands.insertContent("hola");

      const json = editor.getJSON();
      const table = findTable(json);
      expect(table?.content).toHaveLength(3);
      expect(table?.content?.[0].content).toHaveLength(3);

      const serializedText = JSON.stringify(json);
      expect(serializedText).toContain("hola");
    } finally {
      editor.destroy();
    }
  });
});
