import type * as React from "react";
import { cn } from "@/shared/ui/utils";

export interface FormMessageProps extends React.ComponentProps<"div"> {
  // "error" is an alert (red, `role="alert"`); "info" a calm neutral note.
  tone?: "error" | "info";
}

const TONE: Record<NonNullable<FormMessageProps["tone"]>, string> = {
  error: "border-error-100 bg-error-50 text-destructive",
  info: "border-border-default bg-neutral-50 text-fg-secondary",
};

// A dialog form's feedback line (Phase 8 H12, user 2026-10-29): a soft,
// rounded box for an error (an alert) or a notice, so every dialog shows
// feedback the same way. Children may hold a follow-up link.
function FormMessage({
  tone = "error",
  className,
  children,
  ...props
}: FormMessageProps) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      data-slot="form-message"
      data-tone={tone}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border px-3.5 py-2.5 text-[13px] leading-snug",
        TONE[tone],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { FormMessage };
