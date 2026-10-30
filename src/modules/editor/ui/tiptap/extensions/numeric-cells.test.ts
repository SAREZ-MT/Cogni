import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { isNumericCellText } from "./numeric-cells";
import { createTableExtensions } from "./table";

// H7 (editor polish round 2): cells that hold only a number align right
// through a view decoration — no new attribute, so the stored document and
// the content catalogue stay unchanged.
describe("isNumericCellText", () => {
  it.each([
    "18",
    "0,25",
    "1.200",
    "1.200,25",
    "-3.5",
    "+12",
    "45 %",
    "$ 1,000.50",
    "12 €",
  ])("treats %s as a number", (text) => {
    expect(isNumericCellText(text)).toBe(true);
  });

  it.each([
    "",
    "  ",
    "Fase",
    "12 tarjetas",
    "v2",
    "1-2",
    "—",
  ])("does not treat %j as a number", (text) => {
    expect(isNumericCellText(text)).toBe(false);
  });
});

describe("numeric table cells (createTableExtensions)", () => {
  function createEditor() {
    return new Editor({
      extensions: [StarterKit, ...createTableExtensions()],
      content:
        "<table><tr><th>Fase</th><th>ATP</th></tr><tr><td>Luminosa</td><td>18</td></tr></table>",
    });
  }

  it("marks only the numeric cells with is-numeric, outside the JSON", () => {
    const editor = createEditor();
    try {
      const cells = [...editor.view.dom.querySelectorAll("th, td")];
      const numeric = cells.map((cell) =>
        cell.classList.contains("is-numeric"),
      );
      expect(numeric).toEqual([false, false, false, true]);
      expect(JSON.stringify(editor.getJSON())).not.toContain("is-numeric");
    } finally {
      editor.destroy();
    }
  });

  it("follows edits: a cell that stops being a number loses the class", () => {
    const editor = createEditor();
    try {
      const cell = () => editor.view.dom.querySelectorAll("td")[1];
      expect(cell().classList.contains("is-numeric")).toBe(true);
      let pos = -1;
      editor.state.doc.descendants((node, p) => {
        if (node.isText && node.text === "18") pos = p;
      });
      editor.commands.insertContentAt(pos + 2, " tarjetas");
      expect(cell().classList.contains("is-numeric")).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});
