import type * as React from "react";
import { cn } from "@/shared/ui/utils";

export interface DateBadgeProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  date: Date;
  // IANA zone the day is read in; omitted, the runtime's own zone (the
  // shell's other dates do the same until the profile zone is wired).
  timeZone?: string;
  // "brand" (the calendar header, Phase 8 H3): a Cogni-violet month
  // strip with white text, so the badge reads as a calendar icon.
  tone?: "neutral" | "brand";
  // "xl" (the calendar page header, Phase 8 H3): 88px wide and the full
  // height of its slot (the title + tabs stack).
  size?: "md" | "xl";
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
  tone = "neutral",
  size = "md",
  className,
  ...props
}: DateBadgeProps) {
  const { month, day, iso, long } = partsOf(date, timeZone);
  return (
    <span
      data-slot="date-badge"
      data-size={size}
      className={cn(
        "inline-flex shrink-0 flex-col overflow-hidden rounded-input border border-border-subtle bg-card text-center shadow-xs",
        size === "xl" ? "h-full w-[88px]" : "w-14",
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
        className={cn(
          "py-0.5 font-semibold tracking-wide",
          size === "xl" ? "py-1 text-xs" : "text-[10.5px]",
          tone === "brand"
            ? "bg-primary-600 text-white"
            : "bg-neutral-50 text-fg-muted",
        )}
      >
        {month}
      </span>
      <span
        aria-hidden="true"
        data-part="day"
        className={cn(
          "py-1 font-bold text-fg leading-tight",
          size === "xl"
            ? "flex flex-1 items-center justify-center text-[34px]"
            : "text-lg",
        )}
      >
        {day}
      </span>
    </span>
  );
}
