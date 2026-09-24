// E2 (block context menu + bubble toolbar "Colores" > "Fondo"): a block-
// level background tint, independent of `CogniHighlight` (highlight-
// palette.tsx, an inline TEXT mark for a run of characters). This is a
// plain attribute-only extension (no node/NodeView of its own) added as a
// global attribute to every block type the "Fondo" row can target —
// paragraph, heading, the three list containers and blockquote, per the
// E2 brief. Reuses the same 7-color pastel palette as CogniHighlight
// (`HIGHLIGHT_PALETTE`/`HighlightColor`) instead of inventing a second
// palette, so "no hex values ever appear in a component" (docs/design-
// system) still holds and both pickers show the exact same 7 swatches.
import { Extension } from "@tiptap/core";
import { type HIGHLIGHT_PALETTE, isHighlightColor } from "../highlight-palette";

// Tailwind v4 needs literal class names to keep them in the generated CSS
// (a template-interpolated `bg-pastel-${color}` string is invisible to its
// scanner) — same record-of-literals convention as highlight-palette.tsx's
// own HIGHLIGHT_CLASSES.
const NODE_BACKGROUND_CLASSES: Record<
  (typeof HIGHLIGHT_PALETTE)[number],
  string
> = {
  pink: "bg-pastel-pink",
  green: "bg-pastel-green",
  yellow: "bg-pastel-yellow",
  purple: "bg-pastel-purple",
  orange: "bg-pastel-orange",
  blue: "bg-pastel-blue",
  mint: "bg-pastel-mint",
};

// The block types the E2 brief names for "Colores" > "Fondo": paragraph,
// heading, the three list containers (a background on the list itself,
// not per-item) and blockquote.
export const NODE_BACKGROUND_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
] as const;

export const NodeBackground = Extension.create({
  name: "nodeBackground",

  addGlobalAttributes() {
    return [
      {
        types: [...NODE_BACKGROUND_TYPES],
        attributes: {
          nodeBackground: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const value = element.getAttribute("data-node-background");
              return isHighlightColor(value) ? value : null;
            },
            renderHTML: (attributes: { nodeBackground?: unknown }) => {
              const value = attributes.nodeBackground;
              if (!isHighlightColor(value)) return {};
              return {
                "data-node-background": value,
                // globals.css, ".editor-content [data-node-background]":
                // the negative margin/padding/radius that make the tint
                // read as a block-wide card instead of a flush rectangle
                // lives there (one shared rule for every color), so this
                // only ever contributes the color utility itself.
                class: NODE_BACKGROUND_CLASSES[value],
              };
            },
          },
        },
      },
    ];
  },
});
