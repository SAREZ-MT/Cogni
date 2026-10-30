import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

type NotebookCoverSize = "sm" | "lg";

// Per-size geometry of the drawing. "lg" fills its parent (the empty-state
// fan sizes each book); "sm" is the fixed 58×70 hub header badge, a 52×64
// cover with the page edge peeking 6px out.
const SIZES: Record<
  NotebookCoverSize,
  {
    box: string;
    radius: string;
    face: string;
    pages: string;
    backCover: string;
    spine: string;
    ribbon: string;
    shadow: string;
  }
> = {
  lg: {
    box: "size-full",
    // Rounded like a bound book: tight at the spine, soft at the fore edge.
    radius: "rounded-[8px_16px_16px_8px]",
    face: "size-[calc(100%-8px)]",
    pages: "top-2 left-2",
    backCover: "top-1 left-1",
    spine: "w-3.5",
    ribbon: "-top-0.5 right-[26px] h-[46px] w-3.5",
    // Layered depth like `TechniqueFan`'s cards: a tight contact shadow
    // plus a soft, offset ambient one, never a glow.
    shadow:
      "shadow-[0_1px_2px_rgb(0_0_0/0.05),0_12px_28px_-12px_rgb(0_0_0/0.2)]",
  },
  sm: {
    box: "h-[70px] w-[58px]",
    radius: "rounded-[5px_11px_11px_5px]",
    face: "size-[calc(100%-6px)]",
    pages: "top-1.5 left-1.5",
    backCover: "top-[3px] left-[3px]",
    spine: "w-2",
    ribbon: "-top-px right-[9px] h-[22px] w-2",
    // Same two layers, scaled down, the ambient one tinted violet so the
    // small badge still lifts off the white header.
    shadow:
      "shadow-[0_1px_2px_rgb(0_0_0/0.05),0_10px_20px_-10px_rgb(109_40_217/0.5)]",
  },
};

export interface NotebookCoverProps {
  size?: NotebookCoverSize;
  // Cover palette: border plus the 160deg gradient stops. Defaults to the
  // violet "new notebook".
  cover?: string;
  // Bookmark ribbon fill. Defaults to the flashcards yellow.
  ribbon?: string;
  className?: string;
  // Printed on the cover (the fan's sample names and icon tiles).
  children?: ReactNode;
}

// One closed notebook seen from the front (Phase 8 H4-T4, extracted from
// `NotebookFan`, user decision 2026-10-20): page-edge thickness — a striped
// block of pages, then the back cover — offset behind a gradient cover with
// a darker spine strip and a notched bookmark ribbon. Shared by the fan's
// books and the notebooks hub header's badge so both stay one drawing.
// Decorative: hidden from assistive technology.
export function NotebookCover({
  size = "lg",
  cover = "border-primary-700 from-primary-500 to-primary-700",
  ribbon = "bg-technique-flashcards-accent",
  className,
  children,
}: NotebookCoverProps) {
  const look = SIZES[size];
  return (
    <span
      aria-hidden="true"
      data-slot="notebook-cover"
      className={cn("relative block shrink-0", look.box, className)}
    >
      <span
        data-part="pages"
        className={cn(
          "absolute border border-border-default bg-[repeating-linear-gradient(90deg,var(--color-neutral-0)_0_2px,var(--color-neutral-150)_2px_3px)]",
          look.pages,
          look.face,
          look.radius,
        )}
      />
      <span
        data-part="pages"
        className={cn(
          "absolute border border-border-default bg-neutral-50",
          look.backCover,
          look.face,
          look.radius,
        )}
      />
      <span
        data-part="cover"
        className={cn(
          "absolute top-0 left-0 overflow-hidden border bg-linear-160",
          look.face,
          look.radius,
          look.shadow,
          cover,
        )}
      >
        <span
          data-part="spine"
          className={cn("absolute inset-y-0 left-0 bg-black/7", look.spine)}
        />
        <span
          data-part="ribbon"
          className={cn(
            "absolute [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)]",
            look.ribbon,
            ribbon,
          )}
        />
        {children}
      </span>
    </span>
  );
}
