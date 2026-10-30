import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/shared/ui/button";
import { Pill } from "@/shared/ui/pill";
import {
  TECHNIQUE_ACCENT_CLASS,
  type TechniqueTone,
} from "@/shared/ui/technique-card";
import { cn } from "@/shared/ui/utils";

// The technique pill takes the techniques panel's pastel pair.
const PILL_TONE = {
  yellow: "yellow",
  green: "mint",
  rose: "pink",
} as const satisfies Record<TechniqueTone, string>;

export interface TodayReviewRowProps {
  href: string;
  // Names the link; several rows share the visible "Repasar".
  "aria-label": string;
  tone: TechniqueTone;
  title: string;
  // "Desde ayer" over "1 día esperando" (due rows only).
  waitingTitle?: string;
  waitingDetail?: string;
  techniqueLabel: string;
  notebookTitle: string;
  // "8 tarjetas", "4 preguntas".
  amountLabel: string;
  // A later day's review (Phase 8 H3-T4 day navigation): not due yet, so
  // no wait column and no "Repasar"; a muted "Programado" marker instead.
  scheduled?: boolean;
  "data-testid"?: string;
  className?: string;
}

// Review-today row (Phase 8 H3-T4, the calendar's "Hoy"; user-approved
// mockup 2026-10-19): one link for the whole row — how long it has waited,
// a 4px bar in the technique's accent, the page title over its
// technique / notebook / amount pills, and a dark "Repasar" cue (a span
// styled like the primary Button, since the row is the link) with a
// chevron. Below md the wait sits above the title; below sm (phones) the
// cue moves under the pills so the title keeps the row's width. The
// `scheduled` mode (a later day) is the bar, the title and pills, and a
// muted "Programado" marker with the chevron.
export function TodayReviewRow({
  href,
  "aria-label": ariaLabel,
  tone,
  title,
  waitingTitle,
  waitingDetail,
  techniqueLabel,
  notebookTitle,
  amountLabel,
  scheduled = false,
  "data-testid": testId,
  className,
}: TodayReviewRowProps) {
  const chevron = (
    <ChevronRight
      aria-hidden="true"
      size={18}
      strokeWidth={1.75}
      className="text-fg-muted transition-transform duration-200 ease-out group-hover/row:translate-x-0.5"
    />
  );
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      data-slot="today-review-row"
      data-mode={scheduled ? "scheduled" : "due"}
      data-testid={testId}
      className={cn(
        "group/row grid items-center gap-x-3 gap-y-2 rounded-2xl border border-border-subtle bg-card p-4 no-underline outline-none transition-[border-color,box-shadow] duration-200 ease-out hover:border-border-default hover:shadow-card focus-visible:ring-3 focus-visible:ring-ring/50 md:gap-x-4 md:px-5",
        scheduled
          ? "grid-cols-[4px_minmax(0,1fr)_auto]"
          : "grid-cols-[4px_minmax(0,1fr)] sm:grid-cols-[4px_minmax(0,1fr)_auto] md:grid-cols-[140px_4px_minmax(0,1fr)_auto]",
        className,
      )}
    >
      {!scheduled && (
        <span
          data-part="waiting"
          className="col-start-2 row-start-1 flex flex-col md:col-start-1"
        >
          <span className="font-semibold text-fg text-sm">{waitingTitle}</span>
          <span className="text-fg-muted text-xs">{waitingDetail}</span>
        </span>
      )}
      <span
        aria-hidden="true"
        data-part="accent"
        className={cn(
          "col-start-1 row-start-1 w-1 self-stretch rounded-full",
          !scheduled && "row-span-3 sm:row-span-2 md:col-start-2 md:row-span-1",
          TECHNIQUE_ACCENT_CLASS[tone],
        )}
      />
      <span
        className={cn(
          "col-start-2 flex min-w-0 flex-col gap-2",
          scheduled
            ? "row-start-1"
            : "row-start-2 md:col-start-3 md:row-start-1",
        )}
      >
        <span className="line-clamp-2 break-words font-semibold text-[15px] text-fg leading-snug">
          {title}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Pill size="md" tone={PILL_TONE[tone]}>
            {techniqueLabel}
          </Pill>
          <Pill size="md" tone="neutral" className="max-w-full">
            <span className="truncate">{notebookTitle}</span>
          </Pill>
          <Pill size="md" tone="neutral">
            {amountLabel}
          </Pill>
        </span>
      </span>
      {scheduled ? (
        <span className="col-start-3 row-start-1 flex items-center gap-1">
          <span
            data-part="status"
            className="font-medium text-fg-muted text-xs"
          >
            Programado
          </span>
          {chevron}
        </span>
      ) : (
        <span className="col-start-2 row-start-3 flex items-center gap-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 md:col-start-4 md:row-span-1">
          <span
            data-part="action"
            className={buttonVariants({
              className:
                "pointer-events-none h-9 rounded-input px-4 text-[13px]",
            })}
          >
            Repasar
          </span>
          {chevron}
        </span>
      )}
    </Link>
  );
}
