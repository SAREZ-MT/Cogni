import type { TiptapDoc } from "../../domain/save-page-port";

// Tiptap/ProseMirror's `editor.getJSON()` returns a node's `attrs` as a
// null-prototype object (`Object.create(null)`) whenever the node's
// attributes come from schema defaults — heading level, taskItem checked,
// codeBlock language, among others. `JSON.stringify`/`console.log` treat
// such a value as an ordinary object (they don't look at the prototype),
// but Next.js Server Actions serialize their arguments through React's
// RSC/Flight protocol, which does not: a null-prototype `attrs` value
// deserializes on the server as a function instead of a plain record, and
// Zod's `attrs: z.record(...)` schema then rejects the entire save. This
// is the confirmed root cause of the autosave failing on every request for
// a document containing any block with default-valued attributes (heading,
// task list, code block).
//
// Round-tripping through JSON.stringify/JSON.parse rebuilds every object
// in the tree with a plain Object.prototype, which is exactly what a
// TiptapDoc already is meant to be (design.md's plain-AST domain type) —
// this only strips a Tiptap/ProseMirror implementation detail that never
// belonged in the document's serialized shape.
export function toPlainTiptapDoc(json: unknown): TiptapDoc {
  return JSON.parse(JSON.stringify(json)) as TiptapDoc;
}
