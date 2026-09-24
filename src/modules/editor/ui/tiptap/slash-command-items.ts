import type { Editor, Range } from "@tiptap/core";
import {
  AtSign,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Lightbulb,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  Minus,
  Pilcrow,
  Quote,
  SmilePlus,
  StickyNote,
  Table as TableIcon,
  TriangleAlert,
} from "lucide-react";
import type { CommandMenuItem } from "../command-menu";

export interface SlashCommandItem extends CommandMenuItem {
  run: (editor: Editor, range: Range) => void;
}

// specs/editor/spec.md, "Menú de comandos `/`", and E1 (editor pass,
// goal doc §2): every block reachable from Tiptap's Notion-like template
// that this pass ships, grouped and labeled to mirror that template —
// "Estilo" (text-level blocks), "Listas", "Contenido" (media/inserts) and
// "Callouts", in this exact documented order. Each entry declares an icon,
// a group and an optional description, rendered by command-menu.tsx as an
// icon tile + grouped heading. `keywords` stay lowercase (filterItems in
// slash-command.tsx lowercases both the query and the haystack) and add an
// English alias alongside the Spanish one so both "/cita" and "/quote"
// resolve. Grouped contiguously so command-menu.tsx's first-appearance
// grouping renders the four groups in this exact order — an injected extra
// item (editor.tsx's `extraSlashItems`, e.g. the composition root's
// "Importar PDF") does not need to preserve that contiguity: command-
// menu.tsx buckets by `group` regardless of position (S6a follow-up
// R3-grouped-order-divergence), so it still lands inside "Contenido"
// wherever it's appended.
export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  // Estilo
  {
    id: "paragraph",
    label: "Texto",
    keywords: ["texto", "parrafo", "p", "text", "normal"],
    icon: Pilcrow,
    group: "Estilo",
    description: "Texto normal",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    id: "heading-1",
    label: "Encabezado 1",
    keywords: ["titulo", "h1"],
    icon: Heading1,
    group: "Estilo",
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
    group: "Estilo",
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
    group: "Estilo",
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
    id: "blockquote",
    label: "Cita",
    keywords: ["quote", "blockquote"],
    icon: Quote,
    group: "Estilo",
    description: "Resalta una cita o fragmento",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "code-block",
    label: "Bloque de código",
    keywords: ["codigo", "code"],
    icon: Code2,
    group: "Estilo",
    description: "Fragmento de código con resaltado",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  // Listas
  {
    id: "bullet-list",
    label: "Lista con viñetas",
    keywords: ["lista", "viñetas", "bullets", "bullet"],
    icon: List,
    group: "Listas",
    description: "Lista simple con viñetas",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "ordered-list",
    label: "Lista numerada",
    keywords: ["lista", "numeros", "ordered", "numbered"],
    icon: ListOrdered,
    group: "Listas",
    description: "Lista con numeración",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "task-list",
    label: "Lista de tareas",
    keywords: ["tarea", "checklist", "casilla", "todo", "task", "check"],
    icon: ListChecks,
    group: "Listas",
    description: "Lista con casillas de tarea",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  // Contenido
  {
    id: "image",
    label: "Imagen",
    keywords: ["imagen", "foto", "image", "photo"],
    icon: ImageIcon,
    group: "Contenido",
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
  {
    id: "table",
    label: "Tabla",
    keywords: ["table", "filas", "columnas"],
    icon: TableIcon,
    group: "Contenido",
    description: "Tabla editable de filas y columnas",
    // E3 #2 (goal doc §2, Tiptap-template parity): 3×3 with a header row —
    // matches the Notion-style template's own default table size, a more
    // useful starting point than a bare 2×2.
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    id: "divider",
    label: "Divisor",
    keywords: ["separador", "hr", "linea", "divider"],
    icon: Minus,
    group: "Contenido",
    description: "Línea separadora",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: "toc",
    label: "Tabla de contenidos",
    keywords: ["toc", "indice"],
    icon: ListTree,
    group: "Contenido",
    description: "Índice de los encabezados de la página",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "tocBlock" })
        .run(),
  },
  {
    id: "emoji",
    label: "Emoji",
    keywords: ["emoji"],
    icon: SmilePlus,
    group: "Contenido",
    description: "Inserta un emoji",
    // Types the trigger character itself instead of guessing an emoji: the
    // already-registered ":" popup (emoji-suggestion.ts) takes over from
    // there, exactly like Notion's own slash "Emoji" entry.
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent(":").run(),
  },
  {
    id: "mention",
    label: "Mención",
    keywords: ["mention", "@"],
    icon: AtSign,
    group: "Contenido",
    description: "Menciona una página",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent("@").run(),
  },
  // Callouts
  {
    id: "callout-idea",
    label: "Callout de idea",
    keywords: ["idea", "callout"],
    icon: Lightbulb,
    group: "Callouts",
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
    group: "Callouts",
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
    group: "Callouts",
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
];
