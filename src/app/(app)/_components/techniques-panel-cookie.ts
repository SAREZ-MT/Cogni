// Shared by the page-editor route (reads, server-side) and the client
// TechniquesPanel (writes) — mirrors sidebar-cookie.ts exactly, so the
// "Técnicas" panel persists its collapsed state the same way the main
// Sidebar does. Lives outside "use client" so the constant is a plain
// value on both sides.
export const TECHNIQUES_PANEL_COOKIE = "cogni-techniques-panel";
export const TECHNIQUES_PANEL_COLLAPSED = "collapsed";
export const TECHNIQUES_PANEL_EXPANDED = "expanded";
