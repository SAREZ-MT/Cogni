// Cogni highlight palette (specs/editor/spec.md, "Paleta de resaltado de
// Cogni y callouts"): the mark MUST store one of the seven Cogni palette
// color names, never a hex code, and MUST render with design-system tokens
// (H7: the highlighter tokens, see HIGHLIGHTER_CLASS below). `@tiptap/extension-highlight`'s own `multicolor`
// attribute (node_modules/@tiptap/extension-highlight) stores an arbitrary
// CSS color string and renders an inline `background-color` style — this
// extension replaces that attribute entirely with a closed palette and
// Tailwind utility classes instead of hex/inline styles (docs/design-
// system, "no hex values ever appear in a component").
import Highlight from "@tiptap/extension-highlight";
import {
  PALETTE_COLORS,
  type PaletteColor,
} from "@/shared/kernel/tiptap-catalogue";

// The palette is the content catalogue's (the import contract), so a colour
// the editor offers is always one imported content may carry.
export const HIGHLIGHT_PALETTE = PALETTE_COLORS;

export type HighlightColor = PaletteColor;

export function isHighlightColor(value: unknown): value is HighlightColor {
  return (
    typeof value === "string" &&
    (HIGHLIGHT_PALETTE as readonly string[]).includes(value)
  );
}

// H7 (editor polish round 2): the mark is painted as a marker-pen stroke
// by `.editor-content mark.cogni-highlighter[data-color=…]` in globals.css
// (highlighter tokens, uneven edges, `box-decoration-break: clone`), so the
// text keeps the editor's ink colour and the mark only carries the hook.
const HIGHLIGHTER_CLASS = "cogni-highlighter";

export const CogniHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-color");
          return isHighlightColor(value) ? value : null;
        },
        renderHTML: (attributes: { color?: unknown }) => {
          if (!isHighlightColor(attributes.color)) return {};
          return {
            "data-color": attributes.color,
            class: HIGHLIGHTER_CLASS,
          };
        },
      },
    };
  },
});
