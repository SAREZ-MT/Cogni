import { Plus } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/ui/utils";

export interface PageSheetCreateTileProps
  extends Omit<ComponentProps<"button">, "children"> {
  // Visible label and accessible name ("Nueva página").
  label: string;
  // Short line under the label, hidden below 150px wide.
  hint?: string;
}

// The first item of the notebook page's sheet grid (Phase 8 H5-T2, user
// request 2026-10-29): a "new page" button the size of a `PageSheetCard`
// (`aspect-[4/5]`, a face the cell minus the sheets' 8px stack, the sheets'
// 10px radius), in the hub create tile's violet language — `primary-50`
// fill, a 2px dashed `primary-300` border, a `primary-600` plus disc, a
// violet label and hint. It lifts 4px and deepens its tint on hover,
// presses to 0.98 and never moves under reduced motion. It is a plain
// button: the caller wraps it in the create form (`type="submit"`).
export function PageSheetCreateTile({
  label,
  hint,
  className,
  type = "button",
  ...props
}: PageSheetCreateTileProps) {
  return (
    <button
      type={type}
      aria-label={label}
      data-slot="page-sheet-create-tile"
      className={cn(
        "group/new @container/new relative block aspect-[4/5] w-full rounded-[10px] outline-none focus-visible:[&>[data-part=face]]:ring-3 focus-visible:[&>[data-part=face]]:ring-ring/50",
        className,
      )}
      {...props}
    >
      <span
        data-part="face"
        className="absolute top-0 left-0 flex size-[calc(100%-8px)] flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-primary-300 border-dashed bg-primary-50 px-1.5 text-center transition-[translate,scale,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/new:-translate-y-1 group-hover/new:border-primary-400 group-hover/new:bg-primary-100 group-active/new:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none @[150px]/new:gap-3 @[150px]/new:px-4 @[280px]/new:gap-4 @[280px]/new:px-6"
      >
        <span
          data-part="plus"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-[0_8px_18px_-8px_rgb(109_40_217/0.55)] @[150px]/new:size-12 @[280px]/new:size-14"
        >
          <Plus aria-hidden="true" size={22} strokeWidth={2} />
        </span>
        <span className="flex flex-col gap-1">
          <span className="font-semibold text-[11px] text-primary-700 @[150px]/new:text-sm @[280px]/new:text-lg">
            {label}
          </span>
          {hint !== undefined ? (
            <span className="hidden text-balance text-[11.5px] text-primary-600/80 leading-snug @[150px]/new:block @[280px]/new:text-[13px]">
              {hint}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
