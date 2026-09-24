// Shared "Convertir en" catalogue (E2: drag-handle block-context-menu.tsx
// + bubble-toolbar.tsx's "Convertir en" dropdown) — both surfaces apply
// the exact same set of commands to whatever block the CURRENT selection
// sits in. slash-command-items.ts keeps its own separate `run(editor,
// range)` shape (it always deletes a slash-menu text range first, which
// neither of these callers has — there's no "/texto" query to remove when
// converting an already-typed block), so this is a parallel, range-free
// catalogue instead of reusing that one.
import type { Editor } from "@tiptap/core";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Pilcrow,
  Quote,
} from "lucide-react";

export interface BlockKindItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

export const BLOCK_KIND_ITEMS: BlockKindItem[] = [
  {
    id: "paragraph",
    label: "Texto",
    icon: Pilcrow,
    isActive: (editor) => editor.isActive("paragraph"),
    run: (editor) => {
      editor.chain().setParagraph().run();
      editor.view.focus();
    },
  },
  {
    id: "heading-1",
    label: "Encabezado 1",
    icon: Heading1,
    isActive: (editor) => editor.isActive("heading", { level: 1 }),
    run: (editor) => {
      editor.chain().setNode("heading", { level: 1 }).run();
      editor.view.focus();
    },
  },
  {
    id: "heading-2",
    label: "Encabezado 2",
    icon: Heading2,
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
    run: (editor) => {
      editor.chain().setNode("heading", { level: 2 }).run();
      editor.view.focus();
    },
  },
  {
    id: "heading-3",
    label: "Encabezado 3",
    icon: Heading3,
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
    run: (editor) => {
      editor.chain().setNode("heading", { level: 3 }).run();
      editor.view.focus();
    },
  },
  {
    id: "bullet-list",
    label: "Lista con viñetas",
    icon: List,
    isActive: (editor) => editor.isActive("bulletList"),
    run: (editor) => {
      editor.chain().toggleBulletList().run();
      editor.view.focus();
    },
  },
  {
    id: "ordered-list",
    label: "Lista numerada",
    icon: ListOrdered,
    isActive: (editor) => editor.isActive("orderedList"),
    run: (editor) => {
      editor.chain().toggleOrderedList().run();
      editor.view.focus();
    },
  },
  {
    id: "task-list",
    label: "Lista de tareas",
    icon: ListChecks,
    isActive: (editor) => editor.isActive("taskList"),
    run: (editor) => {
      editor.chain().toggleTaskList().run();
      editor.view.focus();
    },
  },
  {
    id: "blockquote",
    label: "Cita",
    icon: Quote,
    isActive: (editor) => editor.isActive("blockquote"),
    run: (editor) => {
      editor.chain().toggleBlockquote().run();
      editor.view.focus();
    },
  },
  {
    id: "code-block",
    label: "Bloque de código",
    icon: Code2,
    isActive: (editor) => editor.isActive("codeBlock"),
    run: (editor) => {
      editor.chain().toggleCodeBlock().run();
      editor.view.focus();
    },
  },
];

// bubble-toolbar.tsx's "Convertir en" trigger shows the current block's
// name (Editor directive: match the template, which labels that dropdown
// with the active type instead of a generic "Convertir en" at rest).
// Falls back to "Texto" the same way slash-command-items.ts's own
// "paragraph" entry does — a fresh empty document's default block.
export function currentBlockKindLabel(editor: Editor): string {
  return (
    BLOCK_KIND_ITEMS.find((item) => item.isActive(editor))?.label ?? "Texto"
  );
}
