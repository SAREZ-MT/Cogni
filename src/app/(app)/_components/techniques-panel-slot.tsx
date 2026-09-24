// S? (design/shell-look): stable id for the empty portal target the
// page-editor route's client TechniquesPanel (notebooks/[notebookId]/
// pages/[pageId]/_components/techniques-panel.tsx) portals into — same
// pattern as PAGE_STATUS_SLOT_ID (page-header.tsx) and
// statusPortalId/Editor's own portal. Exported so both ends share one
// source of truth instead of a repeated string literal.
export const TECHNIQUES_PANEL_SLOT_ID = "techniques-panel-slot";

// Rendered by AppLayout as a sibling after the content card, at the same
// flex level as <Sidebar/>, so a portaled panel becomes a real third
// floating card in that row. `display: contents` (via the `contents`
// utility) makes this wrapper itself take no box/space: on every route
// other than the page editor, nothing portals into it and it is fully
// invisible; on the page editor route, TechniquesPanel's <aside> portals
// in after mount and participates directly in the parent flex row's
// layout, as if it were a Sidebar sibling. Because portaling only happens
// client-side after hydration, the page-editor route accepts one brief
// reflow on first paint instead of plumbing route detection into the
// layout just to reserve width server-side.
export function TechniquesPanelSlot() {
  return <div id={TECHNIQUES_PANEL_SLOT_ID} className="contents" />;
}
