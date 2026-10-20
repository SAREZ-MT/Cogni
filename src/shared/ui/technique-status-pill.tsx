import type { ReactNode } from "react";
import {
  TECHNIQUE_ACCENT_CLASS,
  TECHNIQUE_PAIR_CLASS,
  type TechniqueTone,
} from "@/shared/ui/technique-card";
import { cn } from "@/shared/ui/utils";

export interface TechniqueStatusPillProps {
  tone: TechniqueTone;
  // "sm": 11px, no vertical padding, for tight rows.
  size?: "md" | "sm";
  children: ReactNode;
  className?: string;
}

// Technique status pill (Phase 8 H3, reference "● Pendiente / ● Conectado
// / ● Error"): the technique's pastel pair (TECHNIQUE_PAIR_CLASS — pale
// background, dark text in the same hue, ≥ 5.9:1) with a small dot in its
// accent. Names a technique in the week's metric cards.
export function TechniqueStatusPill({
  tone,
  size = "md",
  children,
  className,
}: TechniqueStatusPillProps) {
  return (
    <span
      data-slot="technique-status-pill"
      data-tone={tone}
      data-size={size}
      className={cn(
        "inline-flex w-fit min-w-0 shrink-0 items-center gap-1.5 rounded-full font-medium leading-tight",
        size === "sm" ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-xs",
        TECHNIQUE_PAIR_CLASS[tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-part="dot"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          TECHNIQUE_ACCENT_CLASS[tone],
        )}
      />
      <span className="truncate">{children}</span>
    </span>
  );
}
