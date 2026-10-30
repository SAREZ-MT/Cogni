"use client";

// H6-E6 (odd/tasks/phase-8-design-flows.md): the bubble toolbar's
// highlighter. The main button carries the last colour used as a tinted
// chip and applies it in one click (Mod+Shift+H does the same); the chevron
// opens a small swatch row of five pastel colours plus "Quitar resaltado"
// (H7 follow-up: circular swatches, a divider and a circle-slash icon).
// A colour picked here, or in a highlight palette elsewhere,
// becomes the next one-click colour (quick-highlight.ts remembers it).
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Ban, ChevronDown, Highlighter } from "lucide-react";
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
// Swatches: the pastel fill with a thin border in the same hue.
const SWATCH_CLASSES: Record<HighlightColor, string> = {
  pink: "bg-highlighter-pink border-highlighter-pink-edge",
  green: "bg-highlighter-green border-highlighter-green-edge",
  yellow: "bg-highlighter-yellow border-highlighter-yellow-edge",
  purple: "bg-highlighter-purple border-highlighter-purple-edge",
  orange: "bg-highlighter-orange border-highlighter-orange-edge",
  blue: "bg-highlighter-blue border-highlighter-blue-edge",
  mint: "bg-highlighter-mint border-highlighter-mint-edge",
};

const CHIP_CLASSES: Record<HighlightColor, string> = {
  pink: "bg-highlighter-pink text-fg",
  green: "bg-highlighter-green text-fg",
  yellow: "bg-highlighter-yellow text-fg",
  purple: "bg-highlighter-purple text-fg",
  orange: "bg-highlighter-orange text-fg",
  blue: "bg-highlighter-blue text-fg",
  mint: "bg-highlighter-mint text-fg",
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
            className="flex size-8 items-center justify-center rounded-sm outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              quickHighlight(editor);
              focusEditorView(editor);
            }}
          >
            <span
              aria-hidden="true"
              className={`flex size-6 items-center justify-center rounded-sm ${CHIP_CLASSES[lastColor]}`}
            >
              <Highlighter size={15} strokeWidth={1.75} />
            </span>
          </button>
        </TooltipTrigger>
        {/* H8-4: same "label · shortcut" form as every toolbar button. */}
        <TooltipContent>Resaltar · ⇧⌘H</TooltipContent>
      </Tooltip>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Más colores de resaltado"
                data-testid="bubble-toolbar-highlight-more"
                className="flex h-8 w-4 items-center justify-center rounded-sm text-fg-muted outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown aria-hidden="true" size={12} strokeWidth={1.75} />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Colores de resaltado</TooltipContent>
        </Tooltip>
        <PopoverContent
          align="start"
          className="editor-surface flex w-auto flex-row items-center gap-1 px-2 py-1.5"
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
                className="flex size-8 items-center justify-center rounded-full outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-active"
                onClick={() => {
                  applyHighlight(editor, color);
                  focusEditorView(editor);
                  setOpen(false);
                }}
              >
                <span
                  aria-hidden="true"
                  className={`size-6 rounded-full border ${SWATCH_CLASSES[color]}`}
                />
              </button>
            ))}
          </fieldset>
          <hr
            aria-orientation="vertical"
            className="mx-1 h-6 w-px shrink-0 border-0 bg-border-default"
          />
          <button
            type="button"
            aria-label="Quitar resaltado"
            title="Quitar resaltado"
            data-testid="bubble-toolbar-highlight-remove"
            className="flex size-8 items-center justify-center rounded-full text-fg-secondary outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              editor.chain().unsetHighlight().run();
              focusEditorView(editor);
              setOpen(false);
            }}
          >
            <Ban aria-hidden="true" size={18} strokeWidth={1.75} />
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
