import type { NotebookColor } from "@/modules/notebooks";

// Tailwind (v4) needs literal class names to keep them in the generated CSS;
// a template-interpolated `bg-${color}` string is invisible to its scanner
// (same constraint noted in notebooks/ui/notebook-item.tsx and the former
// home/notebook-grid.tsx, both of which duplicated this map locally).
// Design pass 2 centralizes it here so every app-level card/list/dot that
// needs a notebook's pastel color (notebook-card.tsx, notebook-list-row.tsx,
// recent-pages.tsx, ready-to-review.tsx) shares one source of truth.
export const NOTEBOOK_SWATCH_CLASSES: Record<NotebookColor, string> = {
  pink: "bg-pastel-pink text-pastel-pink-fg",
  green: "bg-pastel-green text-pastel-green-fg",
  yellow: "bg-pastel-yellow text-pastel-yellow-fg",
  purple: "bg-pastel-purple text-pastel-purple-fg",
  orange: "bg-pastel-orange text-pastel-orange-fg",
  blue: "bg-pastel-blue text-pastel-blue-fg",
  mint: "bg-pastel-mint text-pastel-mint-fg",
};

// Solid dot color (recent-pages/ready-to-review 8px dots, figma-make-
// design-system.md PAGE_DOT_COLORS): the saturated `-fg` tone reads better
// than the pastel tint at 8px.
export const NOTEBOOK_DOT_CLASSES: Record<NotebookColor, string> = {
  pink: "bg-pastel-pink-fg",
  green: "bg-pastel-green-fg",
  yellow: "bg-pastel-yellow-fg",
  purple: "bg-pastel-purple-fg",
  orange: "bg-pastel-orange-fg",
  blue: "bg-pastel-blue-fg",
  mint: "bg-pastel-mint-fg",
};

export const NEUTRAL_SWATCH_CLASS = "bg-neutral-150 text-fg-secondary";
export const NEUTRAL_DOT_CLASS = "bg-neutral-300";
