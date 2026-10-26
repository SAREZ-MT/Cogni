// Cogni highlight palette (specs/editor/spec.md, "Paleta de resaltado de
// Cogni y callouts"): the mark MUST store one of the seven Cogni palette
// color names, never a hex code, and MUST render with the design-system
// `-fg` token pair. `@tiptap/extension-highlight`'s own `multicolor`
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

// Same pattern as src/modules/notebooks/ui/notebook-item.tsx's
// SWATCH_CLASSES: Tailwind v4 needs literal class names to keep them in
// the generated CSS, so a template-interpolated `bg-pastel-${color}`
// string would be invisible to its scanner.
const HIGHLIGHT_CLASSES: Record<HighlightColor, string> = {
  pink: "bg-pastel-pink text-pastel-pink-fg",
  green: "bg-pastel-green text-pastel-green-fg",
  yellow: "bg-pastel-yellow text-pastel-yellow-fg",
  purple: "bg-pastel-purple text-pastel-purple-fg",
  orange: "bg-pastel-orange text-pastel-orange-fg",
  blue: "bg-pastel-blue text-pastel-blue-fg",
  mint: "bg-pastel-mint text-pastel-mint-fg",
};

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
            class: HIGHLIGHT_CLASSES[attributes.color],
          };
        },
      },
    };
  },
});
