import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

// Dashed, text-only preview of a section that will exist once the user has
// data (Home empty state "Lo que verás aquí", inicio-tour-y-empty-state.md
// §2.1). Deliberately static: no link, no button, no skeleton shimmer, so
// it never reads as something that is loading or clickable.
export interface FeaturePreviewCardProps {
  // Pre-built lucide icon; this atom only places it.
  icon: ReactNode;
  // Optional node at the right of the icon row (e.g. technique colour dots).
  adornment?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  className?: string;
}

export function FeaturePreviewCard({
  icon,
  adornment,
  title,
  description,
  className,
}: FeaturePreviewCardProps) {
  return (
    <div
      data-slot="feature-preview-card"
      className={cn(
        "flex h-full flex-col gap-2 rounded-xl border border-neutral-300 border-dashed bg-card px-5 py-4 text-left",
        className,
      )}
    >
      <div className="flex items-center justify-between text-fg-secondary">
        {icon}
        {adornment}
      </div>
      <h3 className="mt-1 font-medium text-[15px] text-fg">{title}</h3>
      <p className="text-fg-muted text-sm leading-normal">{description}</p>
    </div>
  );
}
