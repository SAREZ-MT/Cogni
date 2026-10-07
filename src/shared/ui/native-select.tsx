import type * as React from "react";
import { cn } from "@/shared/ui/utils";

// A native <select> with the Input atom's field chrome (height, radius,
// border, focus ring), for short pick lists such as "Crear examen"'s
// notebook and page. Native on purpose: keyboard, screen readers and
// mobile pickers work without a custom listbox.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-base text-fg outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
