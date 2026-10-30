import type { TiptapDoc } from "@/modules/editor";

// Phase 8 V9: the latest document each page saved in this browser session.
// The App Router reuses a page's cached payload on browser back/forward
// (glossary, "Client Cache"), so a page left after editing comes back with
// the content and version it was first rendered with. PageEditor records
// every successful save here and, when a payload arrives older than the
// last save, opens the saved document instead (and asks the router for a
// fresh payload). A full load starts from an empty record: nothing here
// outlives the client cache it corrects.
interface SavedPage {
  content: TiptapDoc;
  version: number;
}

const saved = new Map<string, SavedPage>();

export function rememberSavedPage(
  pageId: string,
  content: TiptapDoc,
  version: number,
): void {
  const known = saved.get(pageId);
  if (known && known.version >= version) return;
  saved.set(pageId, { content, version });
}

// The page's freshest known document: the payload's own unless a save in
// this session is newer. `stale` tells the caller the payload was outdated.
export function freshestPage(
  pageId: string,
  content: TiptapDoc,
  version: number,
): SavedPage & { stale: boolean } {
  const known = saved.get(pageId);
  if (known && known.version > version) return { ...known, stale: true };
  return { content, version, stale: false };
}

// Drops every record (tests: each one starts from a fresh session).
export function forgetSavedPages(): void {
  saved.clear();
}
