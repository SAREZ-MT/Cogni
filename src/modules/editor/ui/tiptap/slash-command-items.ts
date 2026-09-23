import type { Editor, Range } from "@tiptap/core";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Lightbulb,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  StickyNote,
  Table as TableIcon,
  TriangleAlert,
} from "lucide-react";
import type { CommandMenuItem } from "../command-menu";

export interface SlashCommandItem extends CommandMenuItem {
  run: (editor: Editor, range: Range) => void;
}

// specs/editor/spec.md, "Menú de comandos `/`": all blocks already
// available in this slice (encabezados, párrafo, listas, tarea, cita,
// código, divisor). Table, image, highlight and callouts land in later
// slices per tasks.md's Phase 3b traceability note.
//
// S6a (odd/tasks/app-shell-restyle.md), Editor directive: each entry also
// declares an icon, a group ("Básicos"/"Listas"/"Bloques"/"Medios") and an
// optional description, rendered by the restyled command-menu.tsx as an
// icon tile + grouped heading, matching the Tiptap docs Notion-style
// editor. Grouped contiguously so command-menu.tsx's first-appearance
// grouping renders the four groups in this exact, documented order.
export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  // Básicos
  {
    id: "heading-1",
    label: "Encabezado 1",
    keywords: ["titulo", "h1"],
    icon: Heading1,
    group: "Básicos",
    description: "Título grande de sección",
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
    label: "Encabezado 2",
    keywords: ["titulo", "h2"],
    icon: Heading2,
    group: "Básicos",
    description: "Título mediano de sección",
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
    label: "Encabezado 3",
    keywords: ["titulo", "h3"],
    icon: Heading3,
    group: "Básicos",
    description: "Título pequeño de sección",
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
    label: "Párrafo",
    keywords: ["texto", "normal"],
    icon: Pilcrow,
    group: "Básicos",
    description: "Texto normal",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  // Listas
  {
    id: "bullet-list",
    label: "Lista con viñetas",
    keywords: ["lista", "viñetas", "bullets"],
    icon: List,
    group: "Listas",
    description: "Lista simple con viñetas",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "ordered-list",
    label: "Lista numerada",
    keywords: ["lista", "numeros"],
    icon: ListOrdered,
    group: "Listas",
    description: "Lista con numeración",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "task-list",
    label: "Lista de tareas",
    keywords: ["tarea", "checklist", "casilla"],
    icon: ListChecks,
    group: "Listas",
    description: "Lista con casillas de tarea",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  // Bloques
  {
    id: "blockquote",
    label: "Cita",
    keywords: ["quote"],
    icon: Quote,
    group: "Bloques",
    description: "Resalta una cita o fragmento",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "code-block",
    label: "Bloque de código",
    keywords: ["codigo", "code"],
    icon: Code2,
    group: "Bloques",
    description: "Fragmento de código con resaltado",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "divider",
    label: "Divisor",
    keywords: ["separador", "hr", "linea"],
    icon: Minus,
    group: "Bloques",
    description: "Línea separadora",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: "table",
    label: "Tabla",
    keywords: ["table", "filas", "columnas"],
    icon: TableIcon,
    group: "Bloques",
    description: "Tabla editable de filas y columnas",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
        .run(),
  },
  {
    id: "callout-idea",
    label: "Callout de idea",
    keywords: ["idea", "callout"],
    icon: Lightbulb,
    group: "Bloques",
    description: "Destaca una idea",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "callout",
          attrs: { kind: "idea" },
          content: [{ type: "paragraph" }],
        })
        .run(),
  },
  {
    id: "callout-note",
    label: "Callout de nota",
    keywords: ["nota", "note", "callout"],
    icon: StickyNote,
    group: "Bloques",
    description: "Agrega una nota",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "callout",
          attrs: { kind: "note" },
          content: [{ type: "paragraph" }],
        })
        .run(),
  },
  {
    id: "callout-warning",
    label: "Callout de advertencia",
    keywords: ["advertencia", "warning", "callout"],
    icon: TriangleAlert,
    group: "Bloques",
    description: "Agrega una advertencia",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "callout",
          attrs: { kind: "warning" },
          content: [{ type: "paragraph" }],
        })
        .run(),
  },
  // Medios
  {
    id: "image",
    label: "Imagen",
    keywords: ["imagen", "foto", "image"],
    icon: ImageIcon,
    group: "Medios",
    description: "Sube o pega una imagen",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "image",
          attrs: { assetId: null },
        })
        .run(),
  },
];
