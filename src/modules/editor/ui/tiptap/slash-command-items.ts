import type { Editor, Range } from "@tiptap/core";
import type { CommandMenuItem } from "../command-menu";

export interface SlashCommandItem extends CommandMenuItem {
  run: (editor: Editor, range: Range) => void;
}

// specs/editor/spec.md, "Menú de comandos `/`": all blocks already
// available in this slice (encabezados, párrafo, listas, tarea, cita,
// código, divisor). Table, image, highlight and callouts land in later
// slices per tasks.md's Phase 3b traceability note.
export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    id: "heading-1",
    label: "encabezado 1",
    keywords: ["titulo", "h1"],
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run(),
  },
  {
    id: "heading-2",
    label: "encabezado 2",
    keywords: ["titulo", "h2"],
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run(),
  },
  {
    id: "heading-3",
    label: "encabezado 3",
    keywords: ["titulo", "h3"],
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run(),
  },
  {
    id: "paragraph",
    label: "párrafo",
    keywords: ["texto", "normal"],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    id: "bullet-list",
    label: "lista con viñetas",
    keywords: ["lista", "viñetas", "bullets"],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "ordered-list",
    label: "lista numerada",
    keywords: ["lista", "numeros"],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "task-list",
    label: "lista de tareas",
    keywords: ["tarea", "checklist", "casilla"],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: "blockquote",
    label: "cita",
    keywords: ["quote"],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "code-block",
    label: "bloque de código",
    keywords: ["codigo", "code"],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "divider",
    label: "divisor",
    keywords: ["separador", "hr", "linea"],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];
