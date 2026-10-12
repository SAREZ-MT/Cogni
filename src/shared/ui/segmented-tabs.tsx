import Link from "next/link";
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
  "rounded-md px-3 py-1.5 font-semibold text-[13px] text-fg-muted transition-colors";

// Page-level segmented tabs (Phase 7, Untitled UI calendar "All events /
// Shared / …" row): server-rendered links, so the chosen view lives in the
// URL like ViewToggle/PeriodFilter. A view that does not exist yet renders
// as a disabled entry with its hint as tooltip.
export function SegmentedTabs<V extends string>({
  "aria-label": ariaLabel,
  items,
  value,
  className,
}: SegmentedTabsProps<V>) {
  return (
    <nav
      aria-label={ariaLabel}
      data-slot="segmented-tabs"
      className={cn(
        "flex w-fit items-center gap-0.5 rounded-input border border-border-subtle bg-neutral-100 p-1",
        className,
      )}
    >
      {items.map((item) =>
        item.disabled ? (
          <span
            key={item.value}
            aria-disabled="true"
            title={item.hint}
            className={cn(ITEM_CLASS, "cursor-not-allowed opacity-60")}
          >
            {item.label}
          </span>
        ) : (
          <Link
            key={item.value}
            href={item.href}
            aria-current={item.value === value ? "page" : undefined}
            className={cn(
              ITEM_CLASS,
              "hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              item.value === value && "bg-card text-fg shadow-xs",
            )}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
