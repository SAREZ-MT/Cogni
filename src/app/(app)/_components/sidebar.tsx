"use client";

import {
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  Layers,
  Settings,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/shared/ui/utils";
import { Logo } from "./logo";
import { NavItem } from "./nav-item";
import {
  SIDEBAR_COLLAPSED,
  SIDEBAR_COOKIE,
  SIDEBAR_EXPANDED,
} from "./sidebar-cookie";
import { SidebarUserCard } from "./sidebar-user-card";

export { SIDEBAR_COOKIE } from "./sidebar-cookie";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

// Static nav content (comp-sidebar.html, ui_kits/app/Home Page.html
// 296-366): no module import needed, so it lives in Sidebar directly rather
// than being threaded in like `collapsedCreateAction` (which exists only to
// keep the notebooks module out of this generic component).
type NavEntry =
  | {
      href: string;
      icon: typeof Home;
      label: string;
      isActive: (path: string) => boolean;
    }
  | { icon: typeof Home; label: string; disabled: true; hint: string };

const MAIN_SECTION: { label: string; items: NavEntry[] } = {
  label: "Menú principal",
  items: [
    {
      href: "/",
      icon: Home,
      label: "Inicio",
      isActive: (path) => path === "/",
    },
    {
      href: "/",
      icon: BookOpen,
      label: "Cuadernos",
      isActive: (path) => path.startsWith("/notebooks"),
    },
  ],
};

const TECNICAS_SECTION: { label: string; items: NavEntry[] } = {
  label: "Técnicas",
  items: [
    { icon: Layers, label: "Flashcards", disabled: true, hint: "próximamente" },
    {
      icon: Brain,
      label: "Active recall",
      disabled: true,
      hint: "próximamente",
    },
    {
      icon: ClipboardList,
      label: "Exámenes",
      disabled: true,
      hint: "próximamente",
    },
  ],
};

const CUENTA_SECTION: { label: string; items: NavEntry[] } = {
  label: "Cuenta",
  items: [
    {
      icon: Settings,
      label: "Configuración",
      disabled: true,
      hint: "próximamente",
    },
  ],
};

const SECTIONS = [MAIN_SECTION, TECNICAS_SECTION, CUENTA_SECTION];

type SidebarProps = {
  initialCollapsed: boolean;
  // Icon-only "Crear cuaderno" trigger shown in the collapsed column
  // (notebooks/ui/create-notebook-icon-button.tsx, wired from layout.tsx):
  // Sidebar itself stays generic and never imports the notebooks module.
  collapsedCreateAction?: ReactNode;
  user: { id: string; email: string | null };
  children: ReactNode;
};

export function Sidebar({
  initialCollapsed,
  collapsedCreateAction,
  user,
  children,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pathname = usePathname();

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
        <Logo collapsed={collapsed} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        {SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            {!collapsed && (
              <p className="px-2.5 pt-3.5 pb-1 font-medium text-[11px] text-fg-muted uppercase tracking-wide">
                {section.label}
              </p>
            )}
            {section.items.map((item) =>
              "disabled" in item ? (
                <NavItem
                  key={item.label}
                  href="#"
                  icon={item.icon}
                  label={item.label}
                  disabled
                  hint={item.hint}
                  collapsed={collapsed}
                />
              ) : (
                <NavItem
                  key={item.label}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={item.isActive(pathname ?? "/")}
                  collapsed={collapsed}
                />
              ),
            )}
          </div>
        ))}

        {collapsed && collapsedCreateAction ? (
          <div className="flex flex-col items-center gap-2 py-2">
            {collapsedCreateAction}
          </div>
        ) : null}

        <div
          className={cn("flex min-h-0 flex-1 flex-col", collapsed && "hidden")}
        >
          {children}
        </div>
      </div>

      <SidebarUserCard user={user} collapsed={collapsed} />

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
