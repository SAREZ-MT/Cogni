"use client";

// Table floating toolbar (E2b scope E, editor pass): shown whenever the
// selection is inside a table — same chrome as bubble-toolbar.tsx's
// `BubbleToolbarControls` (role="toolbar", card/border/shadow, tooltipped
// icon buttons) so the two read as one family of floating controls,
// wrapping `@tiptap/extension-table`'s own commands (already installed,
// extensions/table.ts) instead of adding a new extension.
import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Columns3,
  type LucideIcon,
  Rows3,
  TableCellsMerge,
  TableCellsSplit,
  TableProperties,
  Trash2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { isTableCellSelection } from "./table-selection";

export interface TableToolbarProps {
  editor: Editor;
}

export interface ShouldShowTableToolbarArgs {
  editor: Editor;
  state: EditorState;
}

// Mutually exclusive with bubble-toolbar.tsx's own `shouldShowBubbleToolbar`
// (which excludes a CellSelection the same way this excludes a plain
// non-empty text selection): a caret resting in a cell, or a CellSelection
// spanning several, shows THIS toolbar; actually highlighting text inside
// one cell shows the regular inline-formatting bubble toolbar instead.
export function shouldShowTableToolbar({
  editor,
  state,
}: ShouldShowTableToolbarArgs): boolean {
  if (!editor.isActive("table")) return false;
  if (isTableCellSelection(state.selection)) return true;
  return state.selection.empty;
}

export function TableToolbar({ editor }: TableToolbarProps) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="cogni-table-toolbar"
      shouldShow={shouldShowTableToolbar}
    >
      <TableToolbarControls editor={editor} />
    </BubbleMenu>
  );
}

interface TableButtonConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  run: (editor: Editor) => void;
}

const ROW_COLUMN_BUTTONS: TableButtonConfig[] = [
  {
    id: "add-row-before",
    label: "Añadir fila arriba",
    icon: ArrowUpToLine,
    run: (editor) => {
      editor.chain().addRowBefore().run();
      editor.view.focus();
    },
  },
  {
    id: "add-row-after",
    label: "Añadir fila abajo",
    icon: ArrowDownToLine,
    run: (editor) => {
      editor.chain().addRowAfter().run();
      editor.view.focus();
    },
  },
  {
    id: "add-column-before",
    label: "Añadir columna izquierda",
    icon: ArrowLeftToLine,
    run: (editor) => {
      editor.chain().addColumnBefore().run();
      editor.view.focus();
    },
  },
  {
    id: "add-column-after",
    label: "Añadir columna derecha",
    icon: ArrowRightToLine,
    run: (editor) => {
      editor.chain().addColumnAfter().run();
      editor.view.focus();
    },
  },
];

const CELL_BUTTONS: TableButtonConfig[] = [
  {
    id: "merge-cells",
    label: "Combinar celdas",
    icon: TableCellsMerge,
    run: (editor) => {
      editor.chain().mergeCells().run();
      editor.view.focus();
    },
  },
  {
    id: "split-cell",
    label: "Separar celdas",
    icon: TableCellsSplit,
    run: (editor) => {
      editor.chain().splitCell().run();
      editor.view.focus();
    },
  },
  {
    id: "toggle-header-row",
    label: "Alternar fila de encabezado",
    icon: TableProperties,
    run: (editor) => {
      editor.chain().toggleHeaderRow().run();
      editor.view.focus();
    },
  },
];

const DELETE_BUTTONS: TableButtonConfig[] = [
  {
    id: "delete-row",
    label: "Eliminar fila",
    icon: Rows3,
    destructive: true,
    run: (editor) => {
      editor.chain().deleteRow().run();
      editor.view.focus();
    },
  },
  {
    id: "delete-column",
    label: "Eliminar columna",
    icon: Columns3,
    destructive: true,
    run: (editor) => {
      editor.chain().deleteColumn().run();
      editor.view.focus();
    },
  },
  {
    id: "delete-table",
    label: "Eliminar tabla",
    icon: Trash2,
    destructive: true,
    run: (editor) => {
      editor.chain().deleteTable().run();
      editor.view.focus();
    },
  },
];

const BUTTON_CLASS =
  "flex size-8 items-center justify-center rounded-md text-fg-secondary outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring";
const DESTRUCTIVE_BUTTON_CLASS =
  "flex size-8 items-center justify-center rounded-md text-fg-secondary outline-none transition-colors hover:bg-error-50 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-ring";

function ToolbarSeparator() {
  return (
    <span
      aria-hidden="true"
      className="bg-border-default mx-1 h-5 w-px shrink-0"
    />
  );
}

function TableToolbarButton({
  config,
  editor,
}: {
  config: TableButtonConfig;
  editor: Editor;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={config.label}
          data-testid={`table-toolbar-${config.id}`}
          className={
            config.destructive ? DESTRUCTIVE_BUTTON_CLASS : BUTTON_CLASS
          }
          onClick={() => config.run(editor)}
        >
          <config.icon aria-hidden="true" size={16} strokeWidth={1.75} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{config.label}</TooltipContent>
    </Tooltip>
  );
}

export interface TableToolbarControlsProps {
  editor: Editor;
}

export function TableToolbarControls({ editor }: TableToolbarControlsProps) {
  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label="Tabla"
        data-testid="table-toolbar"
        className="flex items-center gap-0.5 rounded-lg border border-border-default bg-card p-1 shadow-md"
      >
        {ROW_COLUMN_BUTTONS.map((config) => (
          <TableToolbarButton key={config.id} config={config} editor={editor} />
        ))}
        <ToolbarSeparator />
        {CELL_BUTTONS.map((config) => (
          <TableToolbarButton key={config.id} config={config} editor={editor} />
        ))}
        <ToolbarSeparator />
        {DELETE_BUTTONS.map((config) => (
          <TableToolbarButton key={config.id} config={config} editor={editor} />
        ))}
      </div>
    </TooltipProvider>
  );
}
