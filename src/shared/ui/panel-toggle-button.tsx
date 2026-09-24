import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/shared/ui/utils";

export interface PanelToggleButtonProps
  extends Omit<React.ComponentProps<"button">, "children" | "type"> {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
}

// design/shell-look: the 26x26 bordered collapse/expand button, extracted
// from Sidebar (sidebar.tsx originally inlined this exact markup for its
// own PanelLeft toggle) so the techniques panel's PanelRightOpen/
// PanelRightClose toggle reuses the same chrome instead of duplicating it.
// Zero-visual-change for Sidebar: same classes, same DOM shape, only the
// icon/aria attributes now come in as props.
function PanelToggleButton({
  icon: Icon,
  size = 15,
  strokeWidth = 1.75,
  className,
  ...props
}: PanelToggleButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex size-[26px] shrink-0 items-center justify-center rounded-md border border-neutral-200/70 bg-neutral-0/60 text-fg-muted transition-colors duration-200 ease-default hover:bg-neutral-0/90 hover:text-fg-secondary",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" size={size} strokeWidth={strokeWidth} />
    </button>
  );
}

export { PanelToggleButton };
