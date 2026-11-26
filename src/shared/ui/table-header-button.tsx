import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/shared/ui/utils";

export type SortDirection = "asc" | "desc";

export interface TableHeaderButtonProps {
  children: React.ReactNode;
  // `undefined` when this column isn't the active sort key.
  direction?: SortDirection;
  onClick: () => void;
  className?: string;
}

// Sortable `<th>` header button (dashboard v2 "Calibración metacognitiva"
// table): a plain button so sort state stays keyboard/click accessible —
// the caller renders it inside a `<th aria-sort=…>` and owns the actual
// sort state (chart spec §Charts & Data: "client state, aria-sort").
export function TableHeaderButton({
  children,
  direction,
  onClick,
  className,
}: TableHeaderButtonProps) {
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/sort flex cursor-pointer items-center gap-1 font-semibold text-[12.5px] text-fg-secondary transition-colors hover:text-primary-700",
        direction && "text-primary-700",
        className,
      )}
    >
      {children}
      {/* Only the active column shows its arrow; the others hint it on
          hover or focus, so the header row stays calm. */}
      <Icon
        aria-hidden="true"
        size={13}
        strokeWidth={2.25}
        className={cn(
          "transition-opacity",
          !direction &&
            "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60",
        )}
      />
    </button>
  );
}
