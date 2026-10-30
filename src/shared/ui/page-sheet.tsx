import {
  type NotebookCoverTone,
  notebookToneKey,
} from "@/shared/ui/notebook-cover-card";
import { cn } from "@/shared/ui/utils";

type PageSheetSize = "sm" | "lg";

// Per-size geometry. "lg" fills its parent (a page card sizes it); "sm" is
// the fixed 58×70 badge of the notebook page's header, the same box as the
// hub's `NotebookCover` badge so both headers line up.
const SIZES: Record<
  PageSheetSize,
  {
    box: string;
    face: string;
    stackBack: string;
    stackMid: string;
    radius: string;
    fold: string;
    clip: string;
    tab: string;
    margin: string;
    shadow: string;
    ruled: string;
  }
> = {
  lg: {
    box: "@container/page size-full",
    face: "size-[calc(100%-8px)]",
    stackBack: "top-2 left-2",
    stackMid: "top-1 left-1",
    radius: "rounded-[10px]",
    fold: "size-[22px]",
    // The face's top-right corner is cut where the fold sits.
    clip: "[clip-path:polygon(0_0,calc(100%-22px)_0,100%_22px,100%_100%,0_100%)]",
    tab: "-top-[5px] left-5 h-[6px] w-12 rounded-t-[3px]",
    // Below 150px wide (the pre-existing sidebar can squeeze the column)
    // the rule hides so the narrow card's text keeps the width.
    margin: "inset-y-0 left-[18px] hidden w-px @[150px]/page:block",
    // drop-shadow, not box-shadow: it follows the clipped outline.
    shadow:
      "drop-shadow-[0_1px_1px_rgb(0_0_0/0.06)] drop-shadow-[0_12px_16px_rgb(0_0_0/0.11)]",
    // Ruled paper: a hairline every 22px from 36px down, so a 22px title
    // line laid at 16px sits on the rules. The image starts 15px down and
    // never tiles upward; it stops 56px short of the bottom to leave the
    // date row clean.
    ruled:
      "bg-[repeating-linear-gradient(to_bottom,transparent_0_21px,var(--color-neutral-100)_21px_22px)] bg-[position:0_15px] bg-[size:100%_calc(100%-71px)] bg-no-repeat",
  },
  sm: {
    box: "h-[70px] w-[58px]",
    face: "size-[calc(100%-6px)]",
    stackBack: "top-1.5 left-1.5",
    stackMid: "top-[3px] left-[3px]",
    radius: "rounded-[6px]",
    fold: "size-3",
    clip: "[clip-path:polygon(0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%)]",
    tab: "-top-[3px] left-2 h-1 w-5 rounded-t-[2px]",
    margin: "inset-y-0 left-[9px] w-px",
    shadow:
      "drop-shadow-[0_1px_1px_rgb(0_0_0/0.06)] drop-shadow-[0_6px_8px_rgb(0_0_0/0.12)]",
    // The badge prints its own three rules instead.
    ruled: "",
  },
};

// The notebook's colour on the sheet: the index tab and the margin rule,
// in the same 400 step as the hub covers' gradient ends.
// Shared with the list view's `PageStripRow`, so strips and sheets agree.
export const PAGE_SHEET_TONES: Record<
  NotebookCoverTone,
  { tab: string; margin: string }
> = {
  pink: { tab: "bg-pink-400", margin: "bg-pink-400/45" },
  green: { tab: "bg-emerald-400", margin: "bg-emerald-400/45" },
  yellow: { tab: "bg-amber-400", margin: "bg-amber-400/45" },
  purple: { tab: "bg-primary-500", margin: "bg-primary-500/45" },
  orange: { tab: "bg-orange-400", margin: "bg-orange-400/45" },
  blue: { tab: "bg-blue-400", margin: "bg-blue-400/45" },
  mint: { tab: "bg-teal-400", margin: "bg-teal-400/45" },
};

export interface PageSheetProps {
  size?: PageSheetSize;
  // The notebook's pastel colour; null/undefined falls back to violet.
  tone?: NotebookCoverTone | null;
  className?: string;
}

// One page of a notebook as a paper sheet (Phase 8 H5-T1, user request
// 2026-10-29), the sibling of `NotebookCover`: two sheets stacked behind a
// white face with a folded top-right corner, a short index tab on the top
// edge and a faint margin rule, both in the notebook's colour. `lg` is
// ruled paper (a hairline every 22px); the `sm` badge prints three short
// rules instead so it still reads as a page at 58px.
// Decorative: hidden from assistive technology.
export function PageSheet({ size = "lg", tone, className }: PageSheetProps) {
  const look = SIZES[size];
  const toneKey = notebookToneKey(tone);
  const colour = PAGE_SHEET_TONES[toneKey];

  return (
    <span
      aria-hidden="true"
      data-slot="page-sheet"
      data-tone={toneKey}
      className={cn("relative block shrink-0", look.box, className)}
    >
      <span
        data-part="stack"
        className={cn(
          "absolute border border-border-default bg-neutral-100",
          look.stackBack,
          look.face,
          look.radius,
        )}
      />
      <span
        data-part="stack"
        className={cn(
          "absolute border border-border-default bg-neutral-50",
          look.stackMid,
          look.face,
          look.radius,
        )}
      />
      <span
        data-part="tab"
        className={cn("absolute z-0", look.tab, colour.tab)}
      />
      <span className={cn("absolute top-0 left-0", look.face, look.shadow)}>
        <span
          data-part="face"
          className={cn(
            "absolute inset-0 overflow-hidden border border-border-default bg-card",
            look.radius,
            look.clip,
            look.ruled,
          )}
        >
          <span
            data-part="margin"
            className={cn("absolute", look.margin, colour.margin)}
          />
          {size === "sm" ? (
            <>
              <span
                data-part="rule"
                className="absolute top-[22px] right-2 left-[14px] h-[2px] rounded-full bg-neutral-200"
              />
              <span
                data-part="rule"
                className="absolute top-[31px] right-2 left-[14px] h-[2px] rounded-full bg-neutral-200"
              />
              <span
                data-part="rule"
                className="absolute top-[40px] right-4 left-[14px] h-[2px] rounded-full bg-neutral-200"
              />
            </>
          ) : null}
        </span>
        {/* The folded corner: the underside of the paper, a triangle with
            its own hairline along the crease. */}
        <span
          data-part="fold"
          className={cn(
            "absolute top-0 right-0 rounded-bl-[4px] border-border-default border-b border-l bg-neutral-100 [clip-path:polygon(0_0,0_100%,100%_100%)]",
            look.fold,
          )}
        />
      </span>
    </span>
  );
}
