import Link from "next/link";
import type { ReactNode } from "react";
import type { NotebookCoverTone } from "@/shared/ui/notebook-cover-card";
import { PageSheet } from "@/shared/ui/page-sheet";
import { cn } from "@/shared/ui/utils";

export interface PageSheetCardProps {
  href: string;
  title: string;
  // Already formatted bottom-row date ("29 oct").
  dateLabel?: string;
  // Words before the date ("Actualizada"), shown from 190px wide only so a
  // narrow sheet keeps the date itself whole.
  datePrefix?: string;
  // Optional plain meta text for the top corner; omitted, the title starts
  // the sheet.
  meta?: string;
  // The notebook's pastel colour; null/undefined falls back to violet.
  tone?: NotebookCoverTone | null;
  // Interactive controls (the archive button), stacked above the stretched
  // link and never inside it.
  actions?: ReactNode;
  className?: string;
}

// One page of the notebook page's grid as a paper sheet (Phase 8 H5-T1,
// user request 2026-10-29), in the family of the hub's `NotebookCoverCard`:
// a `PageSheet` drawing in portrait proportion with the readable content
// laid over its face — optional meta in the top corner, the title
// prominent and clamped, the date and the actions at the bottom. The title
// link is stretched over the whole sheet. On hover the sheet lifts 4px and
// tilts 0.4deg (transform only), presses to 0.98, and never moves under
// reduced motion. The title's 22px lines sit on the sheet's rules. Like
// the covers, below 150px wide only a smaller title and the actions remain
// and from 280px the type steps up.
export function PageSheetCard({
  href,
  title,
  dateLabel,
  datePrefix,
  meta,
  tone,
  actions,
  className,
}: PageSheetCardProps) {
  const toneKey = tone ?? "purple";

  return (
    <article
      data-slot="page-sheet-card"
      data-tone={toneKey}
      className={cn(
        "group/sheet @container/sheet relative aspect-[4/5] w-full",
        className,
      )}
    >
      <div
        data-part="sheet"
        className="relative size-full transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] group-hover/sheet:-translate-y-1 group-hover/sheet:rotate-[0.4deg] motion-reduce:transform-none motion-reduce:transition-none"
      >
        <PageSheet tone={toneKey} />
        {/* Same box as the face (100% − the 8px stack); the left padding
            clears the margin rule; the title keeps clear of the folded corner
            on its own, so the bottom row gets the full width. */}
        <div className="absolute top-0 left-0 flex size-[calc(100%-8px)] flex-col pt-2.5 pr-2 pb-1 pl-3 @[150px]/sheet:pt-4 @[150px]/sheet:pr-2.5 @[150px]/sheet:pb-2 @[150px]/sheet:pl-7 @[280px]/sheet:pr-4 @[280px]/sheet:pb-3 @[280px]/sheet:pl-9">
          {meta !== undefined ? (
            <span
              data-part="meta"
              className="mb-1.5 truncate font-medium text-[11px] text-fg-muted @[280px]/sheet:text-[13px]"
            >
              {meta}
            </span>
          ) : null}
          <Link
            href={href}
            className="min-w-0 rounded-[10px] outline-none @[150px]/sheet:mr-3.5 @[280px]/sheet:mr-4 after:absolute after:inset-0 after:rounded-[10px] after:transition-shadow focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            <span className="line-clamp-3 wrap-anywhere font-semibold text-[11px] text-fg leading-[15px] @[150px]/sheet:line-clamp-4 @[150px]/sheet:text-[15px] @[150px]/sheet:leading-[22px] @[280px]/sheet:text-lg">
              {title}
            </span>
          </Link>
          <div className="mt-auto flex min-h-7 items-center justify-end gap-2 @[150px]/sheet:justify-between">
            <span className="hidden min-w-0 truncate font-medium text-[11px] text-fg-muted @[150px]/sheet:inline @[280px]/sheet:text-[13px]">
              {datePrefix !== undefined ? (
                <span
                  data-part="date-prefix"
                  className="hidden @[190px]/sheet:inline"
                >
                  {`${datePrefix} `}
                </span>
              ) : null}
              {dateLabel}
            </span>
            {actions !== undefined ? (
              <span className="relative z-10 shrink-0 text-fg-muted">
                {actions}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
