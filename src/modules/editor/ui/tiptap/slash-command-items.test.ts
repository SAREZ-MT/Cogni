import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createEditorExtensions } from "./extensions";
import { SLASH_COMMAND_ITEMS } from "./slash-command-items";

// specs/editor/spec.md, "Menú de comandos `/`" and "Conjunto completo de
// bloques de §3.2": table and the three callout kinds MUST be reachable
// from the "/" menu with Spanish labels.
function createHeadlessEditor() {
  return new Editor({
    extensions: createEditorExtensions(),
    content: "<p></p>",
  });
}

function findItem(id: string) {
  const item = SLASH_COMMAND_ITEMS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`missing slash command item: ${id}`);
  return item;
}

describe("SLASH_COMMAND_ITEMS", () => {
  it("includes a Spanish-labeled table entry that inserts a table", () => {
    const item = findItem("table");
    expect(item.label).toBe("tabla");

    const editor = createHeadlessEditor();
    item.run(editor, { from: 1, to: 1 });

    const json = editor.getJSON();
    expect(json.content?.some((node) => node.type === "table")).toBe(true);
    editor.destroy();
  });

  it("includes the three callout kinds with Spanish labels", () => {
    const idea = findItem("callout-idea");
    const note = findItem("callout-note");
    const warning = findItem("callout-warning");
    expect(idea.label).toBe("callout de idea");
    expect(note.label).toBe("callout de nota");
    expect(warning.label).toBe("callout de advertencia");

    const editor = createHeadlessEditor();
    warning.run(editor, { from: 1, to: 1 });

    const json = editor.getJSON();
    const callout = json.content?.find((node) => node.type === "callout");
    expect(callout?.attrs).toEqual({ kind: "warning" });
    editor.destroy();
  });
});
