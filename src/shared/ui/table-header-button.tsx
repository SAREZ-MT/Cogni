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
        "flex cursor-pointer items-center gap-1 font-medium text-[11px] text-fg-muted uppercase tracking-wider transition-colors hover:text-fg",
        direction && "text-fg",
        className,
      )}
    >
      {children}
      <Icon aria-hidden="true" size={12} strokeWidth={2} />
    </button>
  );
}
