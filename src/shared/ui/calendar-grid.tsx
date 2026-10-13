import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export interface CalendarGridProps {
  "aria-label": string;
  // Seven short weekday names, Monday first.
  weekdays: readonly string[];
  // Week layout: in a narrow grid the days stack in one column (each cell
  // shows its weekday) instead of seven narrow columns.
  stackWhenNarrow?: boolean;
  className?: string;
  children: ReactNode;
}

// Calendar day grid (Phase 7 T2, the Untitled UI month calendar body): a
// weekday header row over seven Monday-first columns of CalendarDayCell
// list items, hairline borders between cells. Seven equal minmax(0, 1fr)
// columns never overflow the page. The frame is a container: "narrow" means
// the grid itself is under 42rem (@max-2xl), whatever the viewport — the
// app shell's sidebar can leave a wide screen with a narrow content area.
export function CalendarGrid({
  "aria-label": ariaLabel,
  weekdays,
  stackWhenNarrow = false,
  className,
  children,
}: CalendarGridProps) {
  return (
    <div
      data-slot="calendar-grid-frame"
      className={cn("@container w-full", className)}
    >
      <div
        aria-hidden="true"
        data-testid="calendar-weekdays"
        className={cn(
          "grid grid-cols-7 border-border-subtle border-b bg-neutral-50",
          stackWhenNarrow && "@max-2xl:hidden",
        )}
      >
        {weekdays.map((weekday) => (
          <span
            key={weekday}
            className="truncate px-1 py-2.5 text-center font-semibold text-fg-muted text-xs"
          >
            {weekday}
          </span>
        ))}
      </div>
      <ul
        aria-label={ariaLabel}
        data-slot="calendar-grid"
        className={cn(
          "-mb-px grid grid-cols-7 @2xl:[&>li:nth-child(7n)]:border-r-0",
          stackWhenNarrow
            ? "@max-2xl:grid-cols-1 @max-2xl:[&>li]:border-r-0"
            : "@max-2xl:[&>li:nth-child(7n)]:border-r-0",
        )}
      >
        {children}
      </ul>
    </div>
  );
}

export interface CalendarDayCellProps {
  // ISO day, "YYYY-MM-DD".
  day: string;
  dayNumber: number;
  // Long day name for assistive tech ("lunes, 12 de octubre").
  label: string;
  // Short weekday shown next to the number only where the grid stacks
  // (CalendarGrid stackWhenNarrow in a narrow grid).
  weekday?: string;
  isToday?: boolean;
  // A day of the previous/next month shown to complete the first/last week.
  outside?: boolean;
  // Events that did not fit: "N más…" linking to where all are listed.
  more?: { count: number; href: string };
  className?: string;
  children?: ReactNode;
}

// One day of CalendarGrid: number top-left (today's in a dark circle),
// greyed when outside the shown month, then its event chips and an
// optional "N más…" link. In a narrow grid the chips wrap in a row
// (TechniqueChip collapse="dot-when-narrow" turns them into dots).
export function CalendarDayCell({
  day,
  dayNumber,
  label,
  weekday,
  isToday = false,
  outside = false,
  more,
  className,
  children,
}: CalendarDayCellProps) {
  return (
    <li
      data-slot="calendar-day"
      data-day={day}
      data-today={isToday ? "true" : undefined}
      data-outside={outside ? "true" : undefined}
      className={cn(
        "flex min-h-[72px] min-w-0 flex-col gap-1 border-border-subtle border-r border-b p-1.5 @2xl:min-h-[128px] @2xl:p-2",
        outside && "bg-neutral-50",
        className,
      )}
    >
      <span className="flex items-center gap-1.5">
        {weekday && (
          <span
            aria-hidden="true"
            className="font-semibold text-fg-muted text-xs @2xl:hidden"
          >
            {weekday}
          </span>
        )}
        <time
          dateTime={day}
          aria-hidden="true"
          data-part="number"
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center font-semibold text-xs tabular-nums",
            isToday
              ? "rounded-full bg-fg text-card"
              : outside
                ? "text-fg-muted"
                : "text-fg",
          )}
        >
          {dayNumber}
        </time>
        <span className="sr-only">
          {label}
          {isToday && " (hoy)"}
        </span>
      </span>
      <div className="flex min-w-0 flex-col gap-1 @max-2xl:flex-row @max-2xl:flex-wrap">
        {children}
      </div>
      {more && (
        <Link
          href={more.href}
          aria-label={`${more.count} más el ${label}`}
          className="w-fit rounded-sm px-1 font-semibold text-fg-muted text-xs hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="@max-2xl:hidden">{more.count} más…</span>
          <span aria-hidden="true" className="@2xl:hidden">
            +{more.count}
          </span>
        </Link>
      )}
    </li>
  );
}
