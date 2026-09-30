import type * as React from "react";
import { cn } from "@/shared/ui/utils";

// The ⌘H-style shortcut keycap (docs/design-system/preview/comp-sidebar.html
// .shortcut, NavigationSection "Topbar search"): a tiny bordered chip used
// by NavItem's shortcut hint. Extracted because NavItem renders one per key
// in a shortcut array — two identical spans per row today ("⌘" and "H").
function Keycap({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="keycap"
      className={cn(
        "rounded-[5px] border border-neutral-200/60 bg-neutral-200/50 px-[5px] py-[2px] font-medium text-[10px] text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Keycap };
