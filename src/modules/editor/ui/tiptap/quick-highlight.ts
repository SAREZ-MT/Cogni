// H6-E6 (odd/tasks/phase-8-design-flows.md): fast, prominent highlighting.
// The bubble toolbar's highlighter button applies the last colour used in
// one click, a small swatch row picks another one, and Mod+Shift+H does the
// same from the keyboard. It only drives the existing CogniHighlight mark
// (highlight-palette.tsx), already in the content catalogue, so nothing new
// reaches the stored document, the importer or the AI's plain text.
import { type Editor, Extension } from "@tiptap/core";
import { type HighlightColor, isHighlightColor } from "./highlight-palette";

// Six of the seven palette colours, yellow first like a real highlighter;
// mint sits too close to green to tell apart at swatch size. Every pair is
// the design system's pastel background with its `-fg` ink, AA on purpose.
// H7 follow-up (user reference highlight-ref.png): the reference's five
// pastels in its order. Orange and mint stay valid stored colours (they
// still render, globals.css) but are no longer offered here.
export const HIGHLIGHTER_COLORS: readonly HighlightColor[] = [
  "green",
  "blue",
  "pink",
  "purple",
  "yellow",
];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "yellow";

export const HIGHLIGHT_STORAGE_KEY = "cogni.editor.highlight.v1";

// Storage can be missing or throw (private windows, blocked site data):
// the in-memory copy keeps the last colour for this tab either way.
let lastColorInMemory: HighlightColor = DEFAULT_HIGHLIGHT_COLOR;

export function readLastHighlightColor(): HighlightColor {
  try {
    const stored = window.localStorage.getItem(HIGHLIGHT_STORAGE_KEY);
    if (stored === null) return lastColorInMemory;
    return isHighlightColor(stored) ? stored : DEFAULT_HIGHLIGHT_COLOR;
  } catch {
    return lastColorInMemory;
  }
}

export function rememberHighlightColor(color: HighlightColor): void {
  lastColorInMemory = color;
  try {
    window.localStorage.setItem(HIGHLIGHT_STORAGE_KEY, color);
  } catch {
    // Storage unavailable: the in-memory copy above still holds it.
  }
}

// Applies a colour to the selection and remembers it as the next one-click
// colour.
export function applyHighlight(editor: Editor, color: HighlightColor): boolean {
  rememberHighlightColor(color);
  return editor.chain().setHighlight({ color }).run();
}

// One click: highlight the selection with the last colour; a second click on
// text already in that colour removes it, like a highlighter's toggle.
export function quickHighlight(editor: Editor): boolean {
  if (editor.state.selection.empty) return false;
  const color = readLastHighlightColor();
  if (editor.isActive("highlight", { color })) {
    return editor.chain().unsetHighlight().run();
  }
  return editor.chain().setHighlight({ color }).run();
}

// Replaces @tiptap/extension-highlight's own Mod-Shift-H, which toggles a
// colourless highlight the closed palette cannot render.
export const QuickHighlightShortcut = Extension.create({
  name: "quickHighlightShortcut",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-h": () => quickHighlight(this.editor),
    };
  },
});
