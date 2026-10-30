"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId } from "react";
import { cn } from "@/shared/ui/utils";

export type SegmentedTabItem<V extends string = string> = {
  value: V;
  label: string;
} & ({ href: string; disabled?: never } | { disabled: true; hint: string });

export interface SegmentedTabsProps<V extends string = string> {
  "aria-label": string;
  items: readonly SegmentedTabItem<V>[];
  value: V;
  className?: string;
}

const ITEM_CLASS =
  "relative rounded-md px-3 py-1.5 font-semibold text-[13px] text-fg-muted transition-colors";

// Solid Cogni violet "glass" pill (user review 2026-10-19): the fill stays
// solid; the glass is only light on its edges — an inset top highlight, a
// faint inner shade at the bottom, a thin translucent white ring and a soft
// diagonal sheen — plus a small violet drop shadow.
const PILL_CLASS =
  "absolute inset-0 rounded-md bg-primary-600 bg-[linear-gradient(135deg,rgb(255_255_255/0.22),transparent_45%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-1px_0_rgb(0_0_0/0.12),0_1px_3px_rgb(91_33_182/0.35)] ring-1 ring-white/25 ring-inset";

// Page-level segmented tabs (Phase 7, Untitled UI calendar "All events /
// Shared / …" row; Phase 8 H3 violet glass pill): links, so the chosen view
// lives in the URL like ViewToggle/PeriodFilter. The active item sits on a
// solid violet pill that slides between items with Motion (`layoutId`);
// under prefers-reduced-motion it jumps (duration 0). A view that does not
// exist yet renders as a disabled entry with its hint as tooltip.
export function SegmentedTabs<V extends string>({
  "aria-label": ariaLabel,
  items,
  value,
  className,
}: SegmentedTabsProps<V>) {
  const reduce = useReducedMotion() ?? false;
  const pillId = `segmented-tabs-pill-${useId()}`;
  return (
    <nav
      aria-label={ariaLabel}
      data-slot="segmented-tabs"
      className={cn(
        "flex w-fit items-center gap-0.5 rounded-input border border-border-subtle bg-neutral-100 p-1",
        className,
      )}
    >
      {items.map((item) => {
        if (item.disabled) {
          return (
            <span
              key={item.value}
              aria-disabled="true"
              title={item.hint}
              className={cn(ITEM_CLASS, "cursor-not-allowed opacity-60")}
            >
              {item.label}
            </span>
          );
        }
        const active = item.value === value;
        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              ITEM_CLASS,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-white" : "hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                aria-hidden="true"
                data-part="active-pill"
                layoutId={pillId}
                className={PILL_CLASS}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", bounce: 0, visualDuration: 0.3 }
                }
              />
            )}
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
