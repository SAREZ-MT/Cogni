import type { ReactNode } from "react";
import { Card } from "@/shared/ui/card";
import { IconTile } from "@/shared/ui/icon-tile";
import { ProgressBar } from "@/shared/ui/progress-bar";
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
  // Design pass 2 (figma-make-design-system.md Progress "streak gradient"):
  // overrides the default solid violet fill, e.g. "gradient-streak".
  progressClassName?: string;
  // Design pass 2 (Home study-metrics decisions): a "Repasar →"/"Ajustar"
  // link or a disabled "pronto" affordance in the header row.
  action?: ReactNode;
  // "Repasos pendientes hoy" renders at reduced opacity until Flashcards
  // ships (Home study-metrics decisions).
  muted?: boolean;
  // "Índice de constancia"'s 14-dot streak row (streak-dots.tsx), rendered
  // below the progress bar.
  footer?: ReactNode;
}

// ui_kits/app/Home Page.html .stat-card, figma-make-design-system.md
// CardsSection "Metric card": white 16px-radius card, 30px pastel icon
// circle, big value, optional hint, optional action, optional thin
// progress bar.
export function StatCard({
  label,
  icon,
  iconBgClass,
  value,
  hint,
  progress,
  progressClassName,
  action,
  muted = false,
  footer,
}: StatCardProps) {
  return (
    <Card
      padding="none"
      className={cn("flex flex-1 flex-col p-[18px]", muted && "opacity-70")}
    >
      <div className="mb-3 flex items-center gap-2">
        <IconTile size="30" radius="md" className={iconBgClass}>
          {icon}
        </IconTile>
        <span className="font-medium text-fg-muted text-xs">{label}</span>
        {action && <span className="ml-auto shrink-0">{action}</span>}
      </div>
      <p className="font-bold text-[26px] text-fg leading-tight">{value}</p>
      {hint && <p className="mt-1 text-[11.5px] text-fg-muted">{hint}</p>}
      {progress != null && (
        <ProgressBar
          value={progress}
          className="mt-3"
          fillClassName={progressClassName}
        />
      )}
      {footer}
    </Card>
  );
}
