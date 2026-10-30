import type * as React from "react";
import { cn } from "@/shared/ui/utils";

// A form field's visible label (Phase 8 H12): 13px medium secondary ink,
// the one label style of every dialog form. Pass `htmlFor` (a native
// control or a `SelectTrigger` id).
function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor
    <label
      data-slot="field-label"
      className={cn("font-medium text-[13px] text-fg-secondary", className)}
      {...props}
    />
  );
}

export { FieldLabel };
