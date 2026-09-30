import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { BLOCK_KIND_ITEMS, currentBlockKindLabel } from "./block-kind";
import { createEditorExtensions } from "./extensions";

function kind(id: string) {
  const item = BLOCK_KIND_ITEMS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`missing block kind: ${id}`);
  return item;
}

describe("block kinds", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  function create(content = "<p>hola</p>") {
    editor = new Editor({ extensions: createEditorExtensions(), content });
    editor.commands.setTextSelection(2);
    return editor;
  }

  it("offers the nine convertible kinds in a stable order with Spanish labels", () => {
    expect(BLOCK_KIND_ITEMS.map((item) => [item.id, item.label])).toEqual([
      ["paragraph", "Texto"],
      ["heading-1", "Encabezado 1"],
      ["heading-2", "Encabezado 2"],
      ["heading-3", "Encabezado 3"],
      ["bullet-list", "Lista con viñetas"],
      ["ordered-list", "Lista numerada"],
      ["task-list", "Lista de tareas"],
      ["blockquote", "Cita"],
      ["code-block", "Bloque de código"],
    ]);
  });

  it.each([
    ["heading-1", "heading", { level: 1 }],
    ["heading-2", "heading", { level: 2 }],
    ["heading-3", "heading", { level: 3 }],
    ["bullet-list", "bulletList", undefined],
    ["ordered-list", "orderedList", undefined],
    ["task-list", "taskList", undefined],
    ["blockquote", "blockquote", undefined],
    ["code-block", "codeBlock", undefined],
  ] as const)("converts the current block with %s", (id, nodeName, attrs) => {
    create();

    kind(id).run(editor);

    expect(editor.isActive(nodeName, attrs)).toBe(true);
    expect(kind(id).isActive(editor)).toBe(true);
    expect(editor.state.doc.textContent).toBe("hola");
  });

  it("converts a heading back to plain text", () => {
    create("<h2>hola</h2>");
    expect(kind("paragraph").isActive(editor)).toBe(false);

    kind("paragraph").run(editor);

    expect(kind("paragraph").isActive(editor)).toBe(true);
    expect(editor.isActive("heading")).toBe(false);
  });

  it("toggles a list off when it is already active", () => {
    create();
    kind("bullet-list").run(editor);
    kind("bullet-list").run(editor);
    expect(editor.isActive("bulletList")).toBe(false);
  });

  it("distinguishes heading levels in isActive", () => {
    create("<h2>hola</h2>");
    expect(kind("heading-2").isActive(editor)).toBe(true);
    expect(kind("heading-1").isActive(editor)).toBe(false);
  });

  describe("currentBlockKindLabel", () => {
    it("names the block the selection sits in", () => {
      create("<h3>hola</h3>");
      expect(currentBlockKindLabel(editor)).toBe("Encabezado 3");
    });

    it("falls back to Texto for a block that is not in the catalogue", () => {
      create("<hr><p>x</p>");
      editor.commands.setNodeSelection(0);
      expect(currentBlockKindLabel(editor)).toBe("Texto");
    });
  });
});
