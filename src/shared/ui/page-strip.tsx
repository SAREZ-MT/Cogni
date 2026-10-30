import { Plus } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { NotebookCoverTone } from "@/shared/ui/notebook-cover-card";
import { PAGE_SHEET_TONES } from "@/shared/ui/page-sheet";
import { cn } from "@/shared/ui/utils";

export interface PageStripRowProps {
  href: string;
  title: string;
  // Already formatted date ("29 oct").
  dateLabel?: string;
  // Words before the date ("Actualizada"), shown from 360px wide only;
  // below 240px (the pre-existing sidebar can squeeze the column) the date
  // hides and only the title and the actions remain.
  datePrefix?: string;
  // The notebook's pastel colour; null/undefined falls back to violet.
  tone?: NotebookCoverTone | null;
  // Interactive controls (the archive button), above the stretched link,
  // always visible.
  actions?: ReactNode;
  className?: string;
}

// One page of the notebook page's list view as a thin paper strip (Phase
// 8 H5-T2, user request 2026-10-29), the row version of `PageSheetCard`: a
// white strip with a fine border and a soft contact shadow, a short index
// tab on its left edge and a faint margin rule in the notebook's colour,
// the title sitting on a `neutral-100` ruled baseline, a muted date and the
// actions always visible. The title link is stretched over the strip. On
// hover it lifts 1px and its border darkens; it never moves under reduced
// motion.
export function PageStripRow({
  href,
  title,
  dateLabel,
  datePrefix,
  tone,
  actions,
  className,
}: PageStripRowProps) {
  const toneKey = tone ?? "purple";
  const colour = PAGE_SHEET_TONES[toneKey];

  return (
    <article
      data-slot="page-strip-row"
      data-tone={toneKey}
      className={cn(
        "@container/strip relative flex h-14 items-center gap-3 rounded-[10px] border border-border-default bg-card pr-2.5 pl-8 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[translate,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-px hover:border-neutral-300 hover:shadow-[0_1px_2px_rgb(0_0_0/0.05),0_8px_18px_-10px_rgb(0_0_0/0.16)] motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-part="tab"
        className={cn(
          "absolute top-3 -left-[3px] h-8 w-1 rounded-l-[2px]",
          colour.tab,
        )}
      />
      <span
        aria-hidden="true"
        data-part="margin"
        className={cn("absolute inset-y-0 left-5 w-px", colour.margin)}
      />
      <span
        aria-hidden="true"
        data-part="rule"
        className="absolute right-0 bottom-[20px] left-5 h-px bg-neutral-100"
      />
      <Link
        href={href}
        className="min-w-0 flex-1 rounded-[10px] outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
      >
        <span className="block truncate font-semibold text-[14px] text-fg">
          {title}
        </span>
      </Link>
      <span className="hidden shrink-0 font-medium text-[12px] text-fg-muted @[240px]/strip:inline">
        {datePrefix !== undefined ? (
          <span
            data-part="date-prefix"
            className="hidden @[360px]/strip:inline"
          >
            {`${datePrefix} `}
          </span>
        ) : null}
        {dateLabel}
      </span>
      {actions !== undefined ? (
        <span className="relative z-10 shrink-0 text-fg-muted">{actions}</span>
      ) : null}
    </article>
  );
}

export interface PageStripCreateRowProps
  extends Omit<ComponentProps<"button">, "children"> {
  // Visible label and accessible name ("Nueva página").
  label: string;
  // Short line beside the label, from 360px wide; below 160px only the
  // plus disc remains (the accessible name stays the label).
  hint?: string;
}

// The first row of the notebook page's list view (Phase 8 H5-T2, user
// request 2026-10-29): a "new page" strip in the create tiles' violet
// language — `primary-50` fill, a 2px dashed `primary-300` border, a
// `primary-600` plus disc, a violet label and hint. Same height and radius
// as a page strip; on hover it lifts 1px and deepens its tint, never moving
// under reduced motion. A plain button: the caller wraps it in the create
// form (`type="submit"`).
export function PageStripCreateRow({
  label,
  hint,
  className,
  type = "button",
  ...props
}: PageStripCreateRowProps) {
  return (
    <button
      type={type}
      aria-label={label}
      data-slot="page-strip-create-row"
      className={cn(
        "@container/strip flex h-14 w-full items-center gap-3 rounded-[10px] border-2 border-primary-300 border-dashed bg-primary-50 px-3.5 text-left outline-none transition-[translate,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-px hover:border-primary-400 hover:bg-primary-100 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <span
        data-part="plus"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-[0_6px_14px_-6px_rgb(109_40_217/0.55)]"
      >
        <Plus aria-hidden="true" size={16} strokeWidth={2} />
      </span>
      <span className="hidden font-semibold text-primary-700 text-sm @[160px]/strip:inline">
        {label}
      </span>
      {hint !== undefined ? (
        <span className="hidden min-w-0 truncate text-[12.5px] text-primary-600/80 @[360px]/strip:inline">
          {hint}
        </span>
      ) : null}
    </button>
  );
}
