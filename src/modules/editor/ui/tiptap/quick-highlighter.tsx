"use client";

// H6-E6 (odd/tasks/phase-8-design-flows.md): the bubble toolbar's
// highlighter. The main button carries the last colour used as a tinted
// chip and applies it in one click (Mod+Shift+H does the same); the chevron
// opens a small swatch row of six palette colours plus "Quitar resaltado".
// A colour picked here, or in the "Color de texto" popover's highlight row,
// becomes the next one-click colour (quick-highlight.ts remembers it).
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { ChevronDown, Highlighter } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { focusEditorView } from "./focus-editor-view";
import type { HighlightColor } from "./highlight-palette";
import { PALETTE_LABELS } from "./highlight-picker-controls";
import {
  applyHighlight,
  HIGHLIGHTER_COLORS,
  quickHighlight,
  readLastHighlightColor,
} from "./quick-highlight";

// Literal class names for Tailwind's scanner (see highlight-palette.tsx).
const CHIP_CLASSES: Record<HighlightColor, string> = {
  pink: "bg-pastel-pink text-pastel-pink-fg",
  green: "bg-pastel-green text-pastel-green-fg",
  yellow: "bg-pastel-yellow text-pastel-yellow-fg",
  purple: "bg-pastel-purple text-pastel-purple-fg",
  orange: "bg-pastel-orange text-pastel-orange-fg",
  blue: "bg-pastel-blue text-pastel-blue-fg",
  mint: "bg-pastel-mint text-pastel-mint-fg",
};

export interface QuickHighlighterProps {
  editor: Editor;
}

export function QuickHighlighter({ editor }: QuickHighlighterProps) {
  const [open, setOpen] = useState(false);
  // Read on every editor transaction: applying a colour is a transaction,
  // so the chip follows a pick made anywhere in the toolbar.
  const { lastColor, activeColor } = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      lastColor: readLastHighlightColor(),
      activeColor: current.isActive("highlight")
        ? ((current.getAttributes("highlight").color as string | undefined) ??
          null)
        : null,
    }),
  });

  return (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Resaltar en ${PALETTE_LABELS[lastColor]}`}
            aria-pressed={activeColor === lastColor}
            data-testid="bubble-toolbar-highlight"
            className="flex size-8 items-center justify-center rounded-[3px] outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              quickHighlight(editor);
              focusEditorView(editor);
            }}
          >
            <span
              aria-hidden="true"
              className={`flex size-6 items-center justify-center rounded-[3px] ${CHIP_CLASSES[lastColor]}`}
            >
              <Highlighter size={15} strokeWidth={1.75} />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Resaltar · Mod+Shift+H</TooltipContent>
      </Tooltip>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Más colores de resaltado"
            data-testid="bubble-toolbar-highlight-more"
            className="flex h-8 w-4 items-center justify-center rounded-[3px] text-fg-muted outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown aria-hidden="true" size={12} strokeWidth={1.75} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto gap-1.5 rounded-[3px] p-1.5"
          // Picking a colour hands focus back to the text (focusEditorView);
          // Radix would otherwise move it to the chevron as the menu closes.
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <fieldset
            aria-label="Colores de resaltado"
            className="m-0 flex items-center gap-1 border-0 p-0"
          >
            {HIGHLIGHTER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                data-color={color}
                aria-label={`Resaltar en ${PALETTE_LABELS[color]}`}
                aria-pressed={activeColor === color}
                title={PALETTE_LABELS[color]}
                className={`flex size-7 items-center justify-center rounded-[3px] text-[13px] font-medium outline-none transition-shadow hover:ring-1 hover:ring-fg-muted focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-fg ${CHIP_CLASSES[color]}`}
                onClick={() => {
                  applyHighlight(editor, color);
                  focusEditorView(editor);
                  setOpen(false);
                }}
              >
                A
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            data-testid="bubble-toolbar-highlight-remove"
            className="rounded-[3px] px-2 py-1 text-left text-[13px] text-fg-secondary outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              editor.chain().unsetHighlight().run();
              focusEditorView(editor);
              setOpen(false);
            }}
          >
            Quitar resaltado
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
