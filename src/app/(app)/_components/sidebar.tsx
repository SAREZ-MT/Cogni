"use client";

import {
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  ClipboardList,
  Home,
  Layers,
  PanelLeft,
  Settings,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { PanelToggleButton } from "@/shared/ui/panel-toggle-button";
import { cn } from "@/shared/ui/utils";
import { Logo } from "./logo";
import { type NavEntry, resolveNavEntry } from "./nav-entries";
import { NavItem } from "./nav-item";
import {
  SIDEBAR_COLLAPSED,
  SIDEBAR_COOKIE,
  SIDEBAR_EXPANDED,
} from "./sidebar-cookie";
import { SidebarUserCard } from "./sidebar-user-card";

export { SIDEBAR_COOKIE } from "./sidebar-cookie";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

// Shared section-label styling (sentence case, no uppercase/tracking-wide —
// design/shell-look, studyplatform obs 140): used for the notebook tree's
// "Cuadernos" label (sidebar-tree-client.tsx replicates these classes
// locally to add its own "+" trigger) and every SECTIONS entry below.
// The label is set apart from the rows by weight, tone and space rather
// than size alone (impeccable typeset; user 2026-10-17: the 11px muted
// labels were barely visible): semibold, the primary ink, and a wider gap
// above each group.
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pt-5 pb-1.5 font-semibold text-[12px] text-fg tracking-[0.01em]">
      {children}
    </p>
  );
}

// Static nav content (design/shell-look, studyplatform obs 140 app shell):
// no module import needed, so it lives in Sidebar directly instead of being
// threaded in as a prop. An entry for a sample-data design preview would
// get a `preview` route, rendered as a disabled "pronto" row whenever
// design previews are disabled (nav-entries.ts); none is left. Dashboard
// (Phase 7 T4), Calendario, Flashcards, Exámenes and Active recall run on
// real data, so they are plain links.
// Consecutive rows that the product tour highlights as one block: they are
// wrapped in a `data-tour` element (step 4 shows Progreso and Calendario
// together, user 2026-10-18).
type NavGroup = { tourId: string; items: NavEntry[] };

type NavSection = {
  label: string;
  items: (NavEntry | NavGroup)[];
  tourId?: string;
};

function isGroup(item: NavEntry | NavGroup): item is NavGroup {
  return "items" in item;
}

const MAIN_SECTION: NavSection = {
  label: "Menú principal",
  items: [
    {
      href: "/inicio",
      icon: Home,
      label: "Inicio",
      isActive: (path) => path === "/inicio",
    },
    {
      href: "/notebooks",
      icon: BookOpen,
      label: "Cuadernos",
      tourId: "cuadernos",
      isActive: (path) => path.startsWith("/notebooks"),
    },
    {
      tourId: "avance",
      items: [
        {
          href: "/dashboard",
          icon: BarChart3,
          label: "Progreso",
          isActive: (path) => path.startsWith("/dashboard"),
        },
        {
          href: "/calendario",
          icon: Calendar,
          label: "Calendario",
          isActive: (path) => path.startsWith("/calendario"),
        },
      ],
    },
  ],
};

const TECNICAS_SECTION: NavSection = {
  label: "Técnicas",
  tourId: "tecnicas",
  items: [
    {
      href: "/flashcards",
      icon: Layers,
      label: "Flashcards",
      tone: "yellow",
      isActive: (path) => path.startsWith("/flashcards"),
    },
    {
      href: "/active-recall",
      icon: Brain,
      label: "Recordación activa",
      tone: "green",
      isActive: (path) => path.startsWith("/active-recall"),
    },
    {
      href: "/exams",
      icon: ClipboardList,
      label: "Exámenes",
      tone: "rose",
      isActive: (path) => path.startsWith("/exams"),
    },
  ],
};

const CONFIGURACION_SECTION: NavSection = {
  label: "General",
  items: [
    // Live since Phase 7 T2a: the time-zone setting.
    {
      href: "/configuracion",
      icon: Settings,
      label: "Configuración",
      isActive: (path) => path.startsWith("/configuracion"),
    },
  ],
};

const SECTIONS: NavSection[] = [
  MAIN_SECTION,
  TECNICAS_SECTION,
  CONFIGURACION_SECTION,
];

type SidebarProps = {
  initialCollapsed: boolean;
  user: { id: string; email: string | null };
  // Resolved on the server (shared/config/design-previews.ts) and passed
  // down: the env var it reads is not available to client components.
  previewsEnabled: boolean;
};

// design pass 2 (odd/tasks, user decision "Sidebar = navigation only"):
// the sidebar is exactly StudyPlatform's Sidebar.tsx anatomy — logo,
// collapse button, three nav sections, user footer — and nothing else.
// It no longer renders the notebook/page tree or a "Crear cuaderno" entry
// point; "Cuadernos" is a plain nav item to /notebooks, and notebook/page
// creation now lives on that route and on the notebook detail route
// instead. The tree components themselves (SidebarTree, NotebookItem,
// PageItem, CreateNotebookIconButton) are untouched and still exported from
// the notebooks module — only this shell stopped mounting them.
export function Sidebar({
  initialCollapsed,
  user,
  previewsEnabled,
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

  function renderEntry(entry: NavEntry) {
    const item = resolveNavEntry(entry, previewsEnabled, pathname ?? "/");
    return item.disabled ? (
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
        active={item.active}
        shortcut={item.shortcut}
        tone={item.tone}
        tourId={item.tourId}
        collapsed={collapsed}
      />
    );
  }

  return (
    <nav
      aria-label="Barra lateral"
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 flex h-[calc(100vh-16px)] shrink-0 flex-col rounded-xl border border-neutral-200/60 bg-card px-3 py-4 shadow-card transition-[width] duration-200 ease-default motion-reduce:transition-none",
        collapsed ? "w-(--sidebar-collapsed)" : "w-(--sidebar-width)",
      )}
    >
      <div
        className={cn(
          "flex border-neutral-200/50 border-b pt-1 pb-3.5",
          collapsed
            ? "flex-col items-center gap-2 px-1"
            : "items-center justify-between px-2",
        )}
      >
        <Logo collapsed={collapsed} />
        <PanelToggleButton
          icon={PanelLeft}
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "Expandir barra lateral" : "Contraer barra lateral"
          }
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-1">
        {SECTIONS.map((section) => (
          <div
            key={section.label}
            data-tour={section.tourId}
            className="flex flex-col gap-0.5"
          >
            {!collapsed && <SectionLabel>{section.label}</SectionLabel>}
            {section.items.map((entry) =>
              isGroup(entry) ? (
                <div
                  key={entry.tourId}
                  data-tour={entry.tourId}
                  className="flex flex-col gap-0.5"
                >
                  {entry.items.map(renderEntry)}
                </div>
              ) : (
                renderEntry(entry)
              ),
            )}
          </div>
        ))}
      </div>

      <SidebarUserCard user={user} collapsed={collapsed} />
    </nav>
  );
}
