import Link from "next/link";
import type * as React from "react";
import { cn } from "@/shared/ui/utils";

// Inline text link: violet, medium weight, underline on hover, focus ring.
// Use inside running copy ("¿No tienes cuenta? Crea una") so the action
// reads as a link, not as more grey text.
function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      data-slot="text-link"
      className={cn(
        "rounded-sm font-medium text-fg-active underline-offset-4 outline-none transition-colors hover:text-primary-800 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

export { TextLink };
