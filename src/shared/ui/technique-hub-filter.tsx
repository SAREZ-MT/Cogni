import Link from "next/link";
import { notebookDotClass } from "@/shared/ui/notebook-dot";
import { cn } from "@/shared/ui/utils";

export interface TechniqueHubFilterChip {
  key: string;
  label: string;
  count: number;
  href: string;
  active: boolean;
  // A notebook's stored colour (a dot); null for "Todos" (no dot).
  tone: string | null;
}

// The technique hubs' notebook filter (Phase 8 H17, user-approved flat
// hubs 2026-10-29): a row of 34px pill links — "Todos n" and one per
// notebook with its colour dot and count — under the hub header. The
// active chip takes the technique's soft colours (inside a
// `data-technique-theme`) and `aria-current="page"`. On a narrow screen
// the row scrolls sideways instead of wrapping.
export function TechniqueHubFilter({
  chips,
  className,
}: {
  chips: readonly TechniqueHubFilterChip[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Filtrar por cuaderno"
      data-slot="technique-hub-filter"
      className={cn(
        "-mx-0.5 flex gap-2 overflow-x-auto p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-current={chip.active ? "page" : undefined}
          className={cn(
            "inline-flex h-[34px] flex-none items-center gap-[7px] whitespace-nowrap rounded-pill border px-3 font-medium text-[13px] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
            chip.active
              ? "border-(--theme-soft-edge) bg-(--theme-soft) text-(--theme-ink-deep)"
              : "border-border-subtle bg-card text-fg-secondary hover:bg-neutral-50",
          )}
        >
          {chip.tone !== null ? (
            <span
              aria-hidden="true"
              className={cn(
                "size-2 shrink-0 rounded-full",
                notebookDotClass(chip.tone),
              )}
            />
          ) : null}
          {chip.label}
          <span
            className={cn(
              "text-xs tabular-nums",
              chip.active ? "text-(--theme-ink)" : "text-fg-muted",
            )}
          >
            {chip.count}
          </span>
        </Link>
      ))}
    </nav>
  );
}
