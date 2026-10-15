import type * as React from "react";
import { cn } from "@/shared/ui/utils";

// Horizontal rule with a short centred label ("o" between two sign-in
// methods). The rules are decorative; the label is read as plain text.
function TextDivider({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="text-divider"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      <span aria-hidden="true" className="h-px flex-1 bg-border-default" />
      <span className="text-fg-secondary text-xs">{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-border-default" />
    </div>
  );
}

export { TextDivider };
