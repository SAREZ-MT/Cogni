import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type * as React from "react";
import type { ReactNode } from "react";
import { IconTile } from "@/shared/ui/icon-tile";
import { cn } from "@/shared/ui/utils";

export type StatusBannerTone = "pending" | "success" | "error";

const TONE_CONFIG: Record<
  StatusBannerTone,
  {
    panelClassName: string;
    iconTone: "warning" | "success" | "error";
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
};

export interface StatusBannerProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  tone: StatusBannerTone;
  title: ReactNode;
  description: ReactNode;
}

// Async-evaluation status banner (design/shell-look fix, 2026-09-24;
// documento-maestro §8.5: answers save first, the AI evaluation is async
// and retried on provider failure, and feedback only shows once every
// evaluation for the session has finished). Active recall's results view
// renders this in its `pending` tone for as long as that evaluation is in
// flight — this design preview has no backend, so it always renders
// pending. `success`/`error` are reserved for when a real evaluation
// pipeline lands.
export function StatusBanner({
  tone,
  title,
  description,
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
        <p className="font-semibold text-[13px] text-fg">{title}</p>
        <p className="mt-1 text-[12px] text-fg-muted">{description}</p>
      </div>
    </div>
  );
}
