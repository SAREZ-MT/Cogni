import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export interface SidePanelProps {
  collapsed: boolean;
  // Reference anatomy (studyplatform StudyPanel.tsx): 264 expanded / 52
  // collapsed. Kept as props (not hardcoded) so a future left-side or
  // narrower panel can reuse this shell.
  width?: number;
  collapsedWidth?: number;
  side?: "left" | "right";
  // Raw header content — already built for the current collapsed/expanded
  // state by the caller (e.g. title+subtitle block plus a toggle button
  // when expanded, just the toggle button when collapsed). The shell only
  // owns the row's alignment/padding/border, not its content, so it stays
  // reusable for a future panel with a different header.
  header: ReactNode;
  collapsedContent: ReactNode;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

// Design-system floating collapsible side panel (design/shell-look,
// studyplatform StudyPanel.tsx style reference): a third shell card,
// sibling to the main Sidebar and the content card, that shrinks to an
// icon rail instead of unmounting its content when collapsed. Reuses the
// exact card chrome classes the main Sidebar/content-area already use
// (`rounded-xl`, `border-neutral-200/60`, `bg-card`, `shadow-card`) so it
// reads as the same design system, not a one-off.
export function SidePanel({
  collapsed,
  width = 264,
  collapsedWidth = 52,
  side = "right",
  header,
  collapsedContent,
  children,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: SidePanelProps) {
  const currentWidth = collapsed ? collapsedWidth : width;

  return (
    <aside
      aria-label={ariaLabel}
      data-testid={testId}
      data-collapsed={collapsed}
      data-side={side}
      style={{ width: currentWidth, minWidth: currentWidth }}
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-xl border border-neutral-200/60 bg-card shadow-card transition-[width,min-width] duration-[220ms] ease-default",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center border-border-subtle border-b",
          collapsed
            ? "justify-center px-0 py-3"
            : "justify-between px-3.5 pt-[13px] pb-2.5",
        )}
      >
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {collapsed ? collapsedContent : children}
      </div>
    </aside>
  );
}
