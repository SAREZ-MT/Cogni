import type * as React from "react";
import { cn } from "@/shared/ui/utils";

export interface DateBadgeProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  date: Date;
  // IANA zone the day is read in; omitted, the runtime's own zone (the
  // shell's other dates do the same until the profile zone is wired).
  timeZone?: string;
}

function partsOf(date: Date, timeZone: string | undefined) {
  const format = (options: Intl.DateTimeFormatOptions, locale = "es") =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
  return {
    month: format({ month: "short" }).replace(".", "").toUpperCase(),
    day: format({ day: "numeric" }),
    // en-CA formats as YYYY-MM-DD, the <time datetime> shape.
    iso: format({ year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA"),
    long: format({ weekday: "long", day: "numeric", month: "long" }),
  };
}

// Calendar card date badge (Phase 7, Untitled UI month calendar header): a
// small bordered tile with the abbreviated month over the day number.
export function DateBadge({
  date,
  timeZone,
  className,
  ...props
}: DateBadgeProps) {
  const { month, day, iso, long } = partsOf(date, timeZone);
  return (
    <span
      data-slot="date-badge"
      className={cn(
        "inline-flex w-14 shrink-0 flex-col overflow-hidden rounded-input border border-border-subtle bg-card text-center shadow-xs",
        className,
      )}
      {...props}
    >
      <time dateTime={iso} className="sr-only">
        {long}
      </time>
      <span
        aria-hidden="true"
        data-part="month"
        className="bg-neutral-50 py-0.5 font-semibold text-[10.5px] text-fg-muted tracking-wide"
      >
        {month}
      </span>
      <span
        aria-hidden="true"
        data-part="day"
        className="py-1 font-bold text-fg text-lg leading-tight"
      >
        {day}
      </span>
    </span>
  );
}
