// Shared "Colores" catalogue (E2: block-context-menu.tsx's "Colores"
// submenu + bubble-toolbar.tsx's color popover) — two swatch rows, "Texto"
// (an inline `Color`/`TextStyle` mark, extensions/index.ts) and "Fondo" (the
// `nodeBackground` block attribute, extensions/node-background.ts).
//
// The E2 brief names the "Texto" row as "default + violet/rose/green/amber/
// blue/orange/pink" — Cogni's design system has no separate token set under
// those exact English names, only the existing 7-color pastel palette
// CogniHighlight already uses (whose hues already cover the same set:
// morado/rosa/verde/amarillo/azul/naranja/menta), so this reuses those
// tokens' accessible `-fg` pair as the applied text color instead of
// introducing a second, undocumented palette (docs/design-system, "no hex
// values ever appear in a component").
import type { Editor } from "@tiptap/core";
import type { BlockRef } from "./block-actions";
import { NODE_BACKGROUND_TYPES } from "./extensions/node-background";
import { HIGHLIGHT_PALETTE, type HighlightColor } from "./highlight-palette";

export interface ColorSwatch {
  id: "default" | HighlightColor;
  label: string;
  swatchClass: string;
}

const TEXT_COLOR_LABELS: Record<HighlightColor, string> = {
  purple: "Morado",
  pink: "Rosa",
  green: "Verde",
  yellow: "Ámbar",
  blue: "Azul",
  orange: "Naranja",
  mint: "Menta",
};

const BACKGROUND_COLOR_LABELS: Record<HighlightColor, string> = {
  pink: "Rosa",
  green: "Verde",
  yellow: "Amarillo",
  purple: "Morado",
  orange: "Naranja",
  blue: "Azul",
  mint: "Menta",
};

// Tailwind v4 needs literal class names (a template-interpolated
// `bg-pastel-${color}-fg` string is invisible to its scanner) — same
// record-of-literals convention as highlight-palette.tsx's own
// HIGHLIGHT_CLASSES.
const TEXT_SWATCH_CLASSES: Record<HighlightColor, string> = {
  purple: "bg-pastel-purple-fg",
  pink: "bg-pastel-pink-fg",
  green: "bg-pastel-green-fg",
  yellow: "bg-pastel-yellow-fg",
  blue: "bg-pastel-blue-fg",
  orange: "bg-pastel-orange-fg",
  mint: "bg-pastel-mint-fg",
};

const BACKGROUND_SWATCH_CLASSES: Record<HighlightColor, string> = {
  pink: "bg-pastel-pink",
  green: "bg-pastel-green",
  yellow: "bg-pastel-yellow",
  purple: "bg-pastel-purple",
  orange: "bg-pastel-orange",
  blue: "bg-pastel-blue",
  mint: "bg-pastel-mint",
};

const TEXT_COLOR_VALUES: Record<HighlightColor, string> = {
  purple: "var(--color-pastel-purple-fg)",
  pink: "var(--color-pastel-pink-fg)",
  green: "var(--color-pastel-green-fg)",
  yellow: "var(--color-pastel-yellow-fg)",
  blue: "var(--color-pastel-blue-fg)",
  orange: "var(--color-pastel-orange-fg)",
  mint: "var(--color-pastel-mint-fg)",
};

export const TEXT_COLOR_SWATCHES: ColorSwatch[] = [
  { id: "default", label: "Predeterminado", swatchClass: "bg-fg-muted" },
  ...HIGHLIGHT_PALETTE.map((color) => ({
    id: color,
    label: TEXT_COLOR_LABELS[color],
    swatchClass: TEXT_SWATCH_CLASSES[color],
  })),
];

export const BACKGROUND_COLOR_SWATCHES: ColorSwatch[] = [
  {
    id: "default",
    label: "Sin fondo",
    swatchClass: "border border-border-default bg-card",
  },
  ...HIGHLIGHT_PALETTE.map((color) => ({
    id: color,
    label: BACKGROUND_COLOR_LABELS[color],
    swatchClass: BACKGROUND_SWATCH_CLASSES[color],
  })),
];

// Applies to a text SELECTION (bubble-toolbar.tsx's popover, where the
// selection is already whatever text the user highlighted) — never resets
// the selection itself, unlike the block-scoped variant below.
export function applySelectionTextColor(
  editor: Editor,
  swatch: ColorSwatch["id"],
): void {
  const chain = editor.chain();
  if (swatch === "default") chain.unsetColor();
  else chain.setColor(TEXT_COLOR_VALUES[swatch]);
  chain.run();
  editor.view.focus();
}

// Applies to a whole BLOCK (block-context-menu.tsx's "Colores" > "Texto"):
// re-derives the block from `pos` (see block-actions.ts's staleness
// comment), then selects its full content range before applying the mark.
export function applyBlockTextColor(
  editor: Editor,
  ref: BlockRef,
  swatch: ColorSwatch["id"],
): void {
  const from = ref.pos + 1;
  const to = ref.pos + ref.node.nodeSize - 1;
  const chain = editor.chain().setTextSelection({ from, to });
  if (swatch === "default") chain.unsetColor();
  else chain.setColor(TEXT_COLOR_VALUES[swatch]);
  chain.run();
  editor.view.focus();
}

export function applyBlockBackground(
  editor: Editor,
  ref: BlockRef,
  swatch: ColorSwatch["id"],
): void {
  const typeName = ref.node.type.name;
  if (!(NODE_BACKGROUND_TYPES as readonly string[]).includes(typeName)) return;
  editor
    .chain()
    .setNodeSelection(ref.pos)
    .updateAttributes(typeName, {
      nodeBackground: swatch === "default" ? null : swatch,
    })
    .run();
  editor.view.focus();
}
