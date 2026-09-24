"use client";

// Highlight picker controls (specs/editor/spec.md, "Paleta de resaltado de
// Cogni y callouts", Scenario "Resaltado por nombre"). Closes the gap left
// by 5a.4: the `CogniHighlight` mark existed but was not reachable from
// the UI. This is a plain presentational component (no BubbleMenu import)
// so it can apply the mark to the current selection directly, and so its
// swatch-click behaviour is testable without floating-ui's layout math —
// `highlight-picker.tsx` wraps it in a `BubbleMenu` for real usage.
import type { Editor } from "@tiptap/core";
import { HIGHLIGHT_PALETTE, type HighlightColor } from "./highlight-palette";

// Spanish labels for the seven Cogni palette colors (design.md, "Paleta de
// resaltado de Cogni"; specs/editor/spec.md never asks for English names).
const PALETTE_LABELS: Record<HighlightColor, string> = {
  pink: "rosa",
  green: "verde",
  yellow: "amarillo",
  purple: "morado",
  orange: "naranja",
  blue: "azul",
  mint: "menta",
};

const SWATCH_CLASSES: Record<HighlightColor, string> = {
  pink: "bg-pastel-pink",
  green: "bg-pastel-green",
  yellow: "bg-pastel-yellow",
  purple: "bg-pastel-purple",
  orange: "bg-pastel-orange",
  blue: "bg-pastel-blue",
  mint: "bg-pastel-mint",
};

export interface HighlightPickerControlsProps {
  editor: Editor;
}

export function HighlightPickerControls({
  editor,
}: HighlightPickerControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Resaltado"
      data-testid="highlight-picker"
      className="flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      {HIGHLIGHT_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Resaltar en ${PALETTE_LABELS[color]}`}
          data-testid={`highlight-swatch-${color}`}
          className={`size-6 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring ${SWATCH_CLASSES[color]}`}
          onClick={() => {
            editor.chain().setHighlight({ color }).run();
            editor.view.focus();
          }}
        />
      ))}
      <button
        type="button"
        aria-label="Quitar resaltado"
        data-testid="highlight-remove"
        className="rounded-md px-2 py-1 text-xs whitespace-nowrap text-fg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          editor.chain().unsetHighlight().run();
          editor.view.focus();
        }}
      >
        quitar resaltado
      </button>
    </div>
  );
}
