import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/shared/ui/utils";

// Design-system icon tile (figma-make-design-system.md CardsSection /
// Patterns "icon tile"): the pastel/semantic square that carries a lucide
// icon or a notebook emoji across notebook cards, stat cards, nav and
// empty-state icons.
//
// `size` is named after the figma spec's t-shirt scale (sm 28 / md 30 /
// lg 36 / xl 44 / 2xl 52-56) but keeps the literal pixel value as its key:
// the shipped screens actually use 7 distinct sizes (28, 30, 36, 40, 44,
// 52, 56), and this refactor pass is explicitly zero-visual-change, so a
// strict 5-step scale would have forced at least one screen off its
// current pixel size.
//
// `radius` is its own prop instead of being derived from `size`: real
// usage pairs size 36 with both `rounded-md` (create-notebook-trigger's
// dashed-tile icon) and `rounded-input` (the notebookId page-card icon),
// so radius cannot be inferred from size alone without changing one of them.
//
// "48" added for the Flashcards design preview (design/shell-look,
// studyplatform-flashcards-style.md §4 WorkspaceFlashcardCard's 48×48
// translucent icon tile) — the existing 44/52 steps were each a deliberate
// px value for their own screen, not close enough to approximate 48
// without a visible size change.
const iconTileVariants = cva("flex shrink-0 items-center justify-center", {
  variants: {
    size: {
      "28": "size-7",
      "30": "size-[30px]",
      "36": "size-9",
      "40": "size-10",
      "44": "size-11",
      "48": "size-12",
      "52": "size-[52px]",
      "56": "size-14",
    },
    radius: {
      md: "rounded-md",
      input: "rounded-input",
      tile: "rounded-tile",
      xl: "rounded-xl",
      // Round tile (Home review tiles, H2-T5m).
      full: "rounded-full",
    },
    tone: {
      // Notebook pastel swatches (notebook-swatches.ts) — keys match
      // NotebookColor exactly, so notebookToneFromColor can pass one straight
      // through.
      purple: "bg-pastel-purple text-pastel-purple-fg",
      pink: "bg-pastel-pink text-pastel-pink-fg",
      green: "bg-pastel-green text-pastel-green-fg",
      yellow: "bg-pastel-yellow text-pastel-yellow-fg",
      orange: "bg-pastel-orange text-pastel-orange-fg",
      blue: "bg-pastel-blue text-pastel-blue-fg",
      mint: "bg-pastel-mint text-pastel-mint-fg",
      // Semantic / status tones. "primary" is deliberately distinct from
      // the "purple" notebook swatch above — same hue family, different
      // hex pair (primary-100/600 vs pastel-purple/-fg) — collapsing them
      // would be a visual change for whichever screen lost its exact hex.
      primary: "bg-primary-100 text-primary-600",
      neutral: "bg-neutral-150 text-fg-secondary",
      success: "bg-success-100 text-success-600",
      warning: "bg-warning-100 text-warning-600",
      error: "bg-error-100 text-error-500",
      info: "bg-info-100 text-info-600",
      // Exams' brand tone (dashboard v2 technique-activity header tile) —
      // same `rose-500/10` + `rose-600` pair `Pill`'s `rose` tone already
      // uses (no `--color-rose-100` token exists), kept identical so the
      // technique's icon tile and its pills always match.
      rose: "bg-rose-500/10 text-rose-600",
    },
  },
  defaultVariants: {
    radius: "tile",
  },
});

export interface IconTileProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof iconTileVariants> {}

function IconTile({ className, size, radius, tone, ...props }: IconTileProps) {
  return (
    <span
      data-slot="icon-tile"
      className={cn(iconTileVariants({ size, radius, tone }), className)}
      {...props}
    />
  );
}

export { IconTile, iconTileVariants };
