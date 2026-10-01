// A local, editor/domain-owned copy of notebooks' pastel palette
// (notebooks/domain/notebook.ts's NotebookColor) — editor/domain must stay
// framework- and module-agnostic (see this file's own header comment below),
// so it can't import that type by value or reference. E2b scope C (mention
// popup restyle, "IconTile with the notebook's pastel tone"): the literal
// string union is duplicated intentionally, the same way IconTileProps'
// `tone` variant keys already are.
export type MentionNotebookColor =
  | "pink"
  | "green"
  | "yellow"
  | "purple"
  | "orange"
  | "blue"
  | "mint";

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
  // Null for a notebook created without a color (notebooks/domain/
  // notebook.ts, COLOR_PALETTE). mention-node.tsx falls back to the
  // neutral tile tone when null.
  notebookColor: MentionNotebookColor | null;
}

export interface MentionPort {
  // Resolves the current user's pages matching `query` (title or notebook
  // title), most-relevant first, already capped to a reasonable page size —
  // editor/ui/tiptap/mention-suggestion.tsx renders whatever comes back
  // as-is instead of re-slicing it.
  search(query: string): Promise<MentionCandidate[]>;
}
