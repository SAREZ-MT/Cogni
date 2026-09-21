"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/shared/ui/utils";
import {
  SIDEBAR_COLLAPSED,
  SIDEBAR_COOKIE,
  SIDEBAR_EXPANDED,
} from "./sidebar-cookie";

export { SIDEBAR_COOKIE } from "./sidebar-cookie";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

type SidebarProps = {
  initialCollapsed: boolean;
  children: ReactNode;
};

export function Sidebar({ initialCollapsed, children }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    const value = next ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
    // biome-ignore lint/suspicious/noDocumentCookie: cookieStore is missing in jsdom and older Safari
    document.cookie = `${SIDEBAR_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
  }

  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft;

  return (
    <nav
      aria-label="Barra lateral"
      data-collapsed={collapsed}
      className={cn(
        "relative flex h-full shrink-0 flex-col bg-sidebar transition-[width] duration-200 ease-default motion-reduce:transition-none",
        collapsed ? "w-(--sidebar-collapsed)" : "w-(--sidebar-width)",
      )}
    >
      <div className="flex h-(--topbar-height) items-center px-5">
        <span className="font-semibold text-base text-fg">
          {collapsed ? "C" : "Cogni"}
        </span>
      </div>

      <div
        className={cn("flex min-h-0 flex-1 flex-col", collapsed && "hidden")}
      >
        {children}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={
          collapsed ? "Expandir barra lateral" : "Contraer barra lateral"
        }
        className="-right-5 absolute top-16 flex size-11 items-center justify-center rounded-full text-fg-secondary hover:text-fg"
      >
        <span className="flex size-6 items-center justify-center rounded-full border border-border-default bg-card shadow-xs">
          <ToggleIcon aria-hidden="true" size={14} strokeWidth={1.75} />
        </span>
      </button>
    </nav>
  );
}
