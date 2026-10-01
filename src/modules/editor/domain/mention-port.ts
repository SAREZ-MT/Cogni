// Structural port over notebooks' page list (design.md, "notebooks como
// único puerto de persistencia hacia el editor"), mirroring ImageUploadPort/
// SavePagePort's pattern: editor/domain stays framework- and module-
// agnostic, and the app composition root (the page route's client wrapper)
// injects the real implementation, backed by notebooks' listPagesForMention
// Server Action, as a prop — never imported by value inside editor/ui.
export interface MentionCandidate {
  id: string;
  title: string;
  notebookId: string;
  notebookTitle: string;
}

export interface MentionPort {
  // Resolves the current user's pages matching `query` (title or notebook
  // title), most-relevant first, already capped to a reasonable page size —
  // editor/ui/tiptap/mention-suggestion.tsx renders whatever comes back
  // as-is instead of re-slicing it.
  search(query: string): Promise<MentionCandidate[]>;
}
