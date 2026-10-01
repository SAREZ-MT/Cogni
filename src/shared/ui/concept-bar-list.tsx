import Link from "next/link";
import { cn } from "@/shared/ui/utils";

export interface ConceptBarItem {
  id: string;
  label: string;
  meta: string; // "{notebook} · {página}"
  percent: number; // 0-100
  href: string;
}

export interface ConceptBarListProps {
  items: readonly ConceptBarItem[];
  tone: "success" | "error";
  className?: string;
}

const TRACK_FILL_CLASS = {
  success: "bg-success-500",
  error: "bg-error-500",
} as const;

// "Fortalezas"/"Puntos débiles" concept ranking (chart spec §Widgets H):
// no Recharts — an ordered list with an inline 6px track bar per row. Each
// row links straight to the concept's page.
export function ConceptBarList({
  items,
  tone,
  className,
}: ConceptBarListProps) {
  return (
    <ol className={cn("flex flex-col gap-3", className)}>
      {items.map((item, index) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="group flex items-center gap-3 rounded-md px-1 py-0.5 -mx-1 transition-colors hover:bg-hover"
          >
            <span className="w-4 shrink-0 text-[11px] text-fg-muted tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-[13px] text-fg group-hover:text-fg">
                {item.label}
              </span>
              <span className="block truncate text-[11px] text-fg-muted">
                {item.meta}
              </span>
              <span
                className="mt-1.5 block h-1.5 overflow-hidden rounded-pill bg-neutral-150"
                role="img"
                aria-label={`${item.percent}%`}
              >
                <span
                  className={cn(
                    "block h-full rounded-pill",
                    TRACK_FILL_CLASS[tone],
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(0, item.percent))}%`,
                  }}
                />
              </span>
            </span>
            <span className="shrink-0 font-semibold text-[12.5px] text-fg tabular-nums">
              {item.percent}%
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
