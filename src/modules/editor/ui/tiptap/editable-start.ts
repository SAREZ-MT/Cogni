// H6-E1 (odd/tasks/phase-8-design-flows.md): a brand-new page is stored as
// `{ type: "doc", content: [] }` (notebooks' EMPTY_DOC). ProseMirror finds no
// text position in a document without blocks, so it starts the editor with
// an AllSelection; the schema then fills in the required empty paragraph,
// the AllSelection grows to span it, and the bubble toolbar (which only
// hides for an empty selection) floated over a page nobody had touched.
// Handing Tiptap one empty paragraph up front gives it a real caret instead.
// Only the editor's starting content changes: the stored document stays as
// it is until the first real edit, which sends the whole live document.
export interface EditableDoc {
  type: string;
  content?: unknown[];
}

export function withEditableStart<T extends EditableDoc>(doc: T): T {
  if (doc.content && doc.content.length > 0) return doc;
  return { ...doc, content: [{ type: "paragraph" }] };
}
