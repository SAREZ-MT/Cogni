// Public API of the "editor" module (cross-module-via-index in
// .dependency-cruiser.cjs forbids importing anything else from it).
// This slice (PR3a) exports only the framework-agnostic autosave state
// and hook; the Tiptap-backed `Editor` component is added in PR3b
// (design.md, "Tiptap y ProseMirror solo en editor/ui").

export type {
  UseAutosaveOptions,
  UseAutosaveResult,
} from "./application/use-autosave";
export { useAutosave } from "./application/use-autosave";
export type { AutosaveState, AutosaveStatus } from "./domain/autosave-state";
export type {
  SavePagePort,
  TiptapDoc,
  TiptapNode,
} from "./domain/save-page-port";
