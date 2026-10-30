"use client";

import Link from "next/link";
import type { KeyboardEvent } from "react";
import { cn } from "@/shared/ui/utils";

export interface DaySelectLinkProps {
  href: string;
  "aria-label": string;
  // "date" on the selected day.
  "aria-current"?: "date";
  className?: string;
}

// The cover link that selects a calendar day (Phase 8 H3, the month grid):
// a plain link (the selection lives in the URL) that keeps the scroll
// position and, like a button, also activates with Space.
export function DaySelectLink({
  href,
  "aria-label": ariaLabel,
  "aria-current": ariaCurrent,
  className,
}: DaySelectLinkProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== " ") return;
    event.preventDefault();
    event.currentTarget.click();
  };
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      data-part="select"
      onKeyDown={onKeyDown}
      className={cn(
        "absolute inset-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className,
      )}
    />
  );
}
