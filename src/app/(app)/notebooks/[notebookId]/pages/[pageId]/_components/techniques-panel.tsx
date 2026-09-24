"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PanelToggleButton } from "@/shared/ui/panel-toggle-button";
import { SidePanel } from "@/shared/ui/side-panel";
import { TechniqueCard, TechniqueIconStrip } from "@/shared/ui/technique-card";
import {
  TECHNIQUES_PANEL_COLLAPSED,
  TECHNIQUES_PANEL_COOKIE,
  TECHNIQUES_PANEL_EXPANDED,
} from "../../../../../_components/techniques-panel-cookie";
import { TECHNIQUES_PANEL_SLOT_ID } from "../../../../../_components/techniques-panel-slot";
import { TECHNIQUES } from "./techniques";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export interface TechniquesPanelProps {
  initialCollapsed: boolean;
}

// design/shell-look: the page-editor route's only consumer of the
// "Técnicas" side panel. Portals into TechniquesPanelSlot (rendered by
// AppLayout as a sibling after the content card) instead of rendering
// inline, since only this route knows it needs the panel — same pattern as
// Editor's autosave status portaling into PAGE_STATUS_SLOT_ID. `collapsed`
// starts from the server-read cookie (page.tsx) so a returning visitor's
// first paint already matches their last choice once the portal mounts.
export function TechniquesPanel({ initialCollapsed }: TechniquesPanelProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // The slot element (rendered by AppLayout) doesn't exist as a portal
  // target concept until this component looks it up after mount —
  // `createPortal` needs a real, already-committed DOM node (same
  // resolve-after-mount pattern as Editor's statusPortalNode).
  const [slotNode, setSlotNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlotNode(document.getElementById(TECHNIQUES_PANEL_SLOT_ID));
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    const value = next ? TECHNIQUES_PANEL_COLLAPSED : TECHNIQUES_PANEL_EXPANDED;
    // biome-ignore lint/suspicious/noDocumentCookie: cookieStore is missing in jsdom and older Safari
    document.cookie = `${TECHNIQUES_PANEL_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
  }

  if (!slotNode) return null;

  const toggleButton = (
    <PanelToggleButton
      icon={collapsed ? PanelRightClose : PanelRightOpen}
      size={12}
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-label={
        collapsed ? "Expandir panel de técnicas" : "Colapsar panel de técnicas"
      }
      data-testid="techniques-panel-toggle"
    />
  );

  return createPortal(
    <SidePanel
      collapsed={collapsed}
      width={264}
      collapsedWidth={52}
      side="right"
      className="hidden lg:flex"
      aria-label="Técnicas de estudio"
      data-testid="techniques-panel"
      header={
        collapsed ? (
          toggleButton
        ) : (
          <>
            <div>
              <p className="font-semibold text-[12.5px] text-fg">Técnicas</p>
              <p className="mt-0.5 text-[10px] text-fg-muted">
                Genera contenido de estudio desde esta página
              </p>
            </div>
            {toggleButton}
          </>
        )
      }
      collapsedContent={
        <div className="flex flex-col items-center gap-[5px] py-2.5">
          {TECHNIQUES.map((t) => (
            <TechniqueIconStrip
              key={t.id}
              icon={t.icon}
              tone={t.tone}
              title={t.name}
            />
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-[7px] p-2.5 pb-3.5">
        {TECHNIQUES.map((t) => (
          <TechniqueCard
            key={t.id}
            icon={t.icon}
            tone={t.tone}
            name={t.name}
            description={t.description}
            meta={t.meta}
            actionLabel={t.actionLabel}
            href={t.href}
          />
        ))}
      </div>
    </SidePanel>,
    slotNode,
  );
}
