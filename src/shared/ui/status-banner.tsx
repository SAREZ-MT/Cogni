import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import type * as React from "react";
import type { ReactNode } from "react";
import { IconTile } from "@/shared/ui/icon-tile";
import { cn } from "@/shared/ui/utils";

export type StatusBannerTone = "pending" | "success" | "error" | "rose";

const TONE_CONFIG: Record<
  StatusBannerTone,
  {
    panelClassName: string;
    // Only "rose" overrides the title color so far (pastel-pink-fg instead
    // of the default text-fg) — every other tone keeps the original plain
    // title color.
    titleClassName?: string;
    iconTone: "warning" | "success" | "error" | "pink";
    icon: ReactNode;
  }
> = {
  pending: {
    panelClassName: "border border-warning-500/30 bg-warning-50",
    iconTone: "warning",
    icon: (
      <Loader2
        aria-hidden="true"
        size={15}
        strokeWidth={2}
        className="animate-spin motion-reduce:animate-none"
      />
    ),
  },
  success: {
    panelClassName: "border border-success-500/30 bg-success-50",
    iconTone: "success",
    icon: <CheckCircle2 aria-hidden="true" size={15} strokeWidth={1.75} />,
  },
  error: {
    panelClassName: "border border-error-500/30 bg-error-50",
    iconTone: "error",
    icon: <AlertCircle aria-hidden="true" size={15} strokeWidth={1.75} />,
  },
  // Exams design preview (2026-09-24): the retake banner (hub + results
  // view) and the "in a retake session" notice both need the exam
  // technique's own rose/pink accent instead of the semantic warning/error
  // tones — reuses the existing `pink` IconTile tone (pastel-pink/-fg is
  // already an exact match for the style source's wine `#9B2C4A`) paired
  // with the new rose-500 border.
  rose: {
    panelClassName: "border border-rose-500/25 bg-pastel-pink/50",
    titleClassName: "text-pastel-pink-fg",
    iconTone: "pink",
    icon: <RotateCcw aria-hidden="true" size={15} strokeWidth={1.75} />,
  },
};

export interface StatusBannerProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  tone: StatusBannerTone;
  title: ReactNode;
  description: ReactNode;
  // Optional action slot below the description (exams design preview,
  // 2026-09-24: the retake banner's "Repetir examen" button) — absent by
  // default so every existing pending/success/error call site is unchanged.
  action?: ReactNode;
}

// Async-evaluation status banner (design/shell-look fix, 2026-09-24;
// documento-maestro §8.5: answers save first, the AI evaluation is async
// and retried on provider failure, and feedback only shows once every
// evaluation for the session has finished). Active recall's results view
// renders this in its `pending` tone for as long as that evaluation is in
// flight — this design preview has no backend, so it always renders
// pending. `success`/`error` are reserved for when a real evaluation
// pipeline lands. `rose` (exams design preview, 2026-09-24) covers the
// exam-specific retake notices, which need the exam accent rather than a
// semantic tone.
export function StatusBanner({
  tone,
  title,
  description,
  action,
  className,
  ...props
}: StatusBannerProps) {
  const config = TONE_CONFIG[tone];
  return (
    <div
      data-slot="status-banner"
      data-tone={tone}
      className={cn(
        "flex items-start gap-3 rounded-xl p-3.5 text-left",
        config.panelClassName,
        className,
      )}
      {...props}
    >
      <IconTile tone={config.iconTone} size="30" radius="md" className="mt-0.5">
        {config.icon}
      </IconTile>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-semibold text-[13px]",
            config.titleClassName ?? "text-fg",
          )}
        >
          {title}
        </p>
        <p className="mt-1 text-[12px] text-fg-muted">{description}</p>
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}
