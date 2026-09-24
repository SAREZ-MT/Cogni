import { LayoutGrid, List as ListIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/shared/ui/utils";

export type ViewToggleValue = "grid" | "list";

interface ViewToggleOption {
  value: ViewToggleValue;
  icon: typeof LayoutGrid;
  label: string;
}

const VIEW_TOGGLE_OPTIONS: ViewToggleOption[] = [
  { value: "grid", icon: LayoutGrid, label: "Ver como cuadrícula" },
  { value: "list", icon: ListIcon, label: "Ver como lista" },
];

interface ViewToggleProps {
  value: ViewToggleValue;
  hrefFor: (view: ViewToggleValue) => string;
  className?: string;
}

// Segmented grid/list control (extracted from notebooks/page.tsx, design
// pass 2): server-rendered `Link`s instead of client state, so the choice
// persists in the `?view=` URL param and survives a full page reload with
// no JS. Reused by notebooks/[notebookId]/page.tsx for its page list.
export function ViewToggle({ value, hrefFor, className }: ViewToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 self-start rounded-input border border-border-subtle bg-neutral-100 p-1",
        className,
      )}
    >
      {VIEW_TOGGLE_OPTIONS.map(({ value: optionValue, icon: Icon, label }) => (
        <Link
          key={optionValue}
          href={hrefFor(optionValue)}
          aria-label={label}
          aria-current={value === optionValue ? "true" : undefined}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors",
            value === optionValue && "bg-card text-fg shadow-xs",
          )}
        >
          <Icon aria-hidden="true" size={15} strokeWidth={1.75} />
        </Link>
      ))}
    </div>
  );
}
