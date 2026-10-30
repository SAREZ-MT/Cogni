import type { NotebookColor } from "@/modules/notebooks";
import type { IconTileProps } from "@/shared/ui/icon-tile";

// design-system atoms pass: notebook-card.tsx, notebook-list-row.tsx and
// notebookId/page.tsx used to each import a NOTEBOOK_SWATCH_CLASSES class
// map to color their <IconTile>. NotebookColor's keys ("pink" | "green" |
// ... | "mint") already match IconTile's pastel tone keys 1:1 (icon-
// tile.tsx), so the map added nothing IconTile's own `tone` variants don't
// already give it — this helper only keeps the "legacy notebooks with no
// stored color fall back to violet" decision (user decision, design pass
// 2) in one shared place instead of three `?? "purple"` fallbacks.
export function notebookToneFromColor(
  color: NotebookColor | null,
): NonNullable<IconTileProps["tone"]> {
  return color ?? "purple";
}

// Solid dot color (recent-pages/ready-to-review 8px dots, figma-make-
// design-system.md PAGE_DOT_COLORS): the saturated `-fg` tone reads better
// than the pastel tint at 8px. Not an IconTile (no background tile, just a
// solid dot), so it stays its own small map.
export const NOTEBOOK_DOT_CLASSES: Record<NotebookColor, string> = {
  pink: "bg-pastel-pink-fg",
  green: "bg-pastel-green-fg",
  yellow: "bg-pastel-yellow-fg",
  purple: "bg-pastel-purple-fg",
  orange: "bg-pastel-orange-fg",
  blue: "bg-pastel-blue-fg",
  mint: "bg-pastel-mint-fg",
};
