import type { AutosaveStatus } from "../domain/autosave-state";

// specs/editor/spec.md, "Autosave con debounce y actualización optimista":
// visible status copy, Spanish "tú", sentence case, no emoji
// (.agents/skills/cogni-design/SKILL.md). Extracted from editor/ui/tiptap/
// editor.tsx (PR4) so the status indicator is a plain, framework-agnostic
// component testable without mounting Tiptap.
const STATUS_COPY: Record<AutosaveStatus, string> = {
  idle: "",
  pending: "guardando…",
  saving: "guardando…",
  saved: "guardado",
  error: "no se pudo guardar, reintentando…",
  conflict: "la página cambió en otra pestaña",
};

export interface SaveStatusProps {
  status: AutosaveStatus;
}

// role="status" + aria-live="polite": announces the save transition to
// assistive tech without moving focus or interrupting the user's typing.
export function SaveStatus({ status }: SaveStatusProps) {
  return (
    <output
      data-testid="autosave-status"
      aria-live="polite"
      className="text-fg-secondary text-xs"
    >
      {STATUS_COPY[status]}
    </output>
  );
}
