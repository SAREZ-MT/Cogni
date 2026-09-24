import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export type FeedbackBlockTone = "neutral" | "success";

const TONE_CLASSES: Record<
  FeedbackBlockTone,
  { panel: string; eyebrow: string }
> = {
  neutral: {
    panel: "border border-border-subtle bg-card",
    eyebrow: "text-fg-muted",
  },
  success: {
    panel: "border border-success-500/30 bg-success-50/50",
    eyebrow: "text-success-600",
  },
};

export interface FeedbackBlockProps {
  eyebrowLabel: string;
  tone?: FeedbackBlockTone;
  children: ReactNode;
  className?: string;
}

// Active recall's "Tu respuesta" card (design preview, documento-maestro
// §3.3: feedback only shows at the end of the session, never between
// questions — so the review step shows the student's own answer back to
// them, not an "expected answer" panel). `tone="success"` is reserved for a
// future use (e.g. a correct-answer callout) — the current session only
// needs `neutral`.
export function FeedbackBlock({
  eyebrowLabel,
  tone = "neutral",
  children,
  className,
}: FeedbackBlockProps) {
  const toneClass = TONE_CLASSES[tone];
  return (
    <div className={cn("rounded-xl p-5 text-left", toneClass.panel, className)}>
      <p
        className={cn(
          "font-medium text-[11px] uppercase tracking-[0.05em]",
          toneClass.eyebrow,
        )}
      >
        {eyebrowLabel}
      </p>
      <p className="mt-2 text-fg-secondary text-sm leading-[1.7]">{children}</p>
    </div>
  );
}
