// Pure autosave state shape, framework-agnostic (no Tiptap, no React beyond
// the hook that consumes it — see application/use-autosave.ts).
// specs/editor/spec.md, "Autosave con debounce y actualización optimista" y
// "Reconciliación del conflicto de versión".
export type AutosaveStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

export interface AutosaveState {
  readonly status: AutosaveStatus;
}
