import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEditorExtensions } from "./index";

// Tiptap's input rules run from the view's `handleTextInput` prop, the same
// path a real keystroke takes; typing one character at a time lets
// Typography's smart-quote rule turn `"` into `“` first, as it does live.
function type(editor: Editor, text: string) {
  for (const char of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp("handleTextInput", (handler) =>
      handler(editor.view, from, to, char, () => editor.state.tr),
    );
    if (!handled) editor.commands.insertContent(char);
  }
}

function topLevelTypes(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.forEach((node) => {
    out.push(node.type.name);
  });
  return out;
}

// H6-E5 (odd/tasks/phase-8-design-flows.md): Notion's markdown shortcuts.
// `>` + space opens a toggle (the `details` block), `"` + space a quote.
describe("MarkdownShortcuts", () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p></p>",
    });
    editor.commands.setTextSelection(1);
  });

  afterEach(() => {
    editor.destroy();
  });

  it("turns '> ' at the start of an empty paragraph into a toggle with the caret in its title", () => {
    type(editor, "> ");

    expect(topLevelTypes(editor)[0]).toBe("details");
    expect(editor.state.selection.$from.parent.type.name).toBe(
      "detailsSummary",
    );
    expect(editor.getText()).not.toContain(">");

    type(editor, "Título");
    expect(editor.state.doc.child(0).child(0).textContent).toBe("Título");
  });

  it("no longer turns '> ' into a quote", () => {
    type(editor, "> ");

    expect(topLevelTypes(editor)).not.toContain("blockquote");
  });

  it("turns '\" ' at the start of a paragraph into a quote", () => {
    type(editor, '" ');

    expect(topLevelTypes(editor)[0]).toBe("blockquote");
    expect(editor.getText()).not.toMatch(/["“]/);
  });

  it("keeps '> ' as text inside a list item", () => {
    editor.commands.setContent("<ul><li><p></p></li></ul>");
    editor.commands.setTextSelection(3);
    type(editor, "> ");

    expect(topLevelTypes(editor)[0]).toBe("bulletList");
    expect(topLevelTypes(editor)).not.toContain("details");
    expect(editor.state.doc.child(0).firstChild?.childCount).toBe(1);
    expect(editor.getText()).toContain(">");
  });

  it("leaves a quote mark in the middle of a sentence alone", () => {
    type(editor, 'dijo " ');

    expect(topLevelTypes(editor)[0]).toBe("paragraph");
  });
});
