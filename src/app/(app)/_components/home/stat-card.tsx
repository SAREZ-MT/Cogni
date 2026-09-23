import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

interface StatCardProps {
  label: string;
  icon: ReactNode;
  // Pastel icon circle background + foreground (Cogni's pastel palette,
  // src/app/globals.css "--color-pastel-*"), e.g.
  // "bg-pastel-purple text-pastel-purple-fg". Icons use lucide-react's
  // default `currentColor` stroke, so this class also colors the icon.
  iconBgClass: string;
  value: ReactNode;
  hint?: string;
  // A real ratio (0-100), or omitted entirely when none exists (Product
  // decision 1: never an invented metric/progress).
  progress?: number;
}

// ui_kits/app/Home Page.html .stat-card: white 16px-radius card, 30px
// pastel icon circle, big value, optional hint, optional thin progress bar.
export function StatCard({
  label,
  icon,
  iconBgClass,
  value,
  hint,
  progress,
}: StatCardProps) {
  return (
    <div className="flex flex-1 flex-col rounded-xl border border-border-subtle bg-card p-[18px] shadow-xs">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "flex size-[30px] shrink-0 items-center justify-center rounded-md",
            iconBgClass,
          )}
        >
          {icon}
        </span>
        <span className="font-medium text-fg-muted text-xs">{label}</span>
      </div>
      <p className="font-bold text-[26px] text-fg leading-tight">{value}</p>
      {hint && <p className="mt-1 text-[11.5px] text-fg-muted">{hint}</p>}
      {progress != null && (
        <div
          data-slot="progress-bar"
          className="mt-3 h-[5px] overflow-hidden rounded-pill bg-neutral-200/60"
        >
          <div
            data-slot="progress-fill"
            className="h-full rounded-pill bg-primary-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
