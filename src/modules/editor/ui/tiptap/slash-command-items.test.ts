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
    expect(item.label).toBe("Tabla");

    const editor = createHeadlessEditor();
    // destroy() must run even if an assertion throws, otherwise
    // ProseMirror's DOMObserver setTimeout flush can fire after Vitest has
    // torn down jsdom for this file, throwing "document is not defined".
    try {
      item.run(editor, { from: 1, to: 1 });

      const json = editor.getJSON();
      expect(json.content?.some((node) => node.type === "table")).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("includes the three callout kinds with Spanish labels", () => {
    const idea = findItem("callout-idea");
    const note = findItem("callout-note");
    const warning = findItem("callout-warning");
    expect(idea.label).toBe("Callout de idea");
    expect(note.label).toBe("Callout de nota");
    expect(warning.label).toBe("Callout de advertencia");

    const editor = createHeadlessEditor();
    // See the destroy() note above: must run on every path.
    try {
      warning.run(editor, { from: 1, to: 1 });

      const json = editor.getJSON();
      const callout = json.content?.find((node) => node.type === "callout");
      // E2: callout is also in extensions/index.ts's UNIQUE_ID_TYPES, so it
      // now carries a `blockId` (@tiptap/extension-unique-id) alongside its
      // own `kind` attr.
      expect(callout?.attrs).toEqual({
        kind: "warning",
        blockId: expect.any(String),
      });
    } finally {
      editor.destroy();
    }
  });

  // E1 template block set: each "/" entry replaces the typed "/xyz" range
  // and inserts its block (or trigger character) in its place.
  describe("template block entries", () => {
    function runOnTypedCommand(id: string, typed: string) {
      const editor = new Editor({
        extensions: createEditorExtensions(),
        content: `<p>${typed}</p>`,
      });
      findItem(id).run(editor, { from: 1, to: 1 + typed.length });
      return editor;
    }

    it("toc inserts a table-of-contents block and removes the typed command", () => {
      const editor = runOnTypedCommand("toc", "/toc");
      try {
        const json = editor.getJSON();
        expect(json.content?.some((node) => node.type === "tocBlock")).toBe(
          true,
        );
        expect(editor.getText()).not.toContain("/toc");
      } finally {
        editor.destroy();
      }
    });

    it("emoji types the ':' trigger so the emoji popup takes over", () => {
      const editor = runOnTypedCommand("emoji", "/emoji");
      try {
        expect(editor.getText()).toBe(":");
      } finally {
        editor.destroy();
      }
    });

    it("mention types the '@' trigger so the mention popup takes over", () => {
      const editor = runOnTypedCommand("mention", "/mencion");
      try {
        expect(editor.getText()).toBe("@");
      } finally {
        editor.destroy();
      }
    });

    it("image inserts an empty image block awaiting an upload", () => {
      const editor = runOnTypedCommand("image", "/imagen");
      try {
        const image = editor
          .getJSON()
          .content?.find((node) => node.type === "image");
        expect(image?.attrs?.assetId).toBeNull();
      } finally {
        editor.destroy();
      }
    });
  });

  // S6a (odd/tasks/app-shell-restyle.md), Editor directive: the restyled
  // "/" menu renders an icon tile and a group heading per item (command-
  // menu.tsx), so every entry here must declare both.
  it("gives every item an icon and a group", () => {
    for (const item of SLASH_COMMAND_ITEMS) {
      expect(item.icon, `missing icon on "${item.id}"`).toBeTruthy();
      expect(item.group, `missing group on "${item.id}"`).toBeTruthy();
    }
  });

  // E1 (editor pass, goal doc §2): regrouped to mirror the Tiptap Notion-
  // like template — "Estilo" (text-level blocks), "Listas", "Contenido"
  // (media/inserts) and "Callouts" — replacing the earlier "Básicos" /
  // "Bloques" / "Medios" naming.
  it("keeps the four documented groups in a stable, first-appearance order", () => {
    const order: string[] = [];
    for (const item of SLASH_COMMAND_ITEMS) {
      if (item.group && !order.includes(item.group)) order.push(item.group);
    }
    expect(order).toEqual(["Estilo", "Listas", "Contenido", "Callouts"]);
  });

  it("puts every heading, the paragraph, the quote and the code block in Estilo", () => {
    for (const id of [
      "heading-1",
      "heading-2",
      "heading-3",
      "paragraph",
      "blockquote",
      "code-block",
    ]) {
      expect(findItem(id).group).toBe("Estilo");
    }
  });

  it("puts the three list types in Listas", () => {
    for (const id of ["bullet-list", "ordered-list", "task-list"]) {
      expect(findItem(id).group).toBe("Listas");
    }
  });

  it("puts image, table, divider, math, toc, emoji and mention in Contenido", () => {
    for (const id of [
      "image",
      "table",
      "divider",
      "math-block",
      "toc",
      "emoji",
      "mention",
    ]) {
      expect(findItem(id).group).toBe("Contenido");
    }
  });

  // S6a defect fix (docs/design-system SKILL.md, Notion style: "Heading 1"):
  // every label must be sentence case, matching the Notion-style slash menu.
  // `keywords` stay lowercase on purpose (filterItems in slash-command.tsx
  // lowercases both the query and the haystack before comparing, so
  // lowercase keywords keep "/cita"/"/tabla"/"/advertencia" matching).
  it("gives every item a sentence-case label", () => {
    const expected: Record<string, string> = {
      "heading-1": "Encabezado 1",
      "heading-2": "Encabezado 2",
      "heading-3": "Encabezado 3",
      paragraph: "Texto",
      "bullet-list": "Lista con viñetas",
      "ordered-list": "Lista numerada",
      "task-list": "Lista de tareas",
      blockquote: "Cita",
      "code-block": "Bloque de código",
      divider: "Divisor",
      table: "Tabla",
      "math-block": "Fórmula matemática",
      toc: "Tabla de contenidos",
      emoji: "Emoji",
      mention: "Mención",
      "callout-idea": "Callout de idea",
      "callout-note": "Callout de nota",
      "callout-warning": "Callout de advertencia",
      image: "Imagen",
    };

    for (const item of SLASH_COMMAND_ITEMS) {
      expect(item.label, `label for "${item.id}"`).toBe(expected[item.id]);
    }
  });

  it("keeps every keyword lowercase for filtering", () => {
    for (const item of SLASH_COMMAND_ITEMS) {
      for (const keyword of item.keywords ?? []) {
        expect(keyword, `keyword on "${item.id}"`).toBe(keyword.toLowerCase());
      }
    }
  });
});
