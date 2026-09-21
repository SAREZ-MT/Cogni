import { Button } from "@/shared/ui/button";
import type { TiptapDoc } from "../domain/save-page-port";

export interface ConflictBannerProps {
  // The user's discarded local draft, still available to restore. `null`
  // means there is no conflict to reconcile, and the banner renders
  // nothing (specs/editor/spec.md, "Reconciliación del conflicto de
  // versión").
  conflictDraft: TiptapDoc | null;
  onRestore: () => void;
  onDiscard: () => void;
}

// Warns in Spanish "tú" that the page changed in another tab (the
// document already shown in the editor is the server's), and lets the
// user choose between reapplying their own draft or dropping it.
export function ConflictBanner({
  conflictDraft,
  onRestore,
  onDiscard,
}: ConflictBannerProps) {
  if (!conflictDraft) return null;

  return (
    <div
      role="alert"
      data-testid="conflict-banner"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-600"
    >
      <p>esta página cambió en otra pestaña</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRestore}>
          recuperar mi borrador
        </Button>
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          descartar
        </Button>
      </div>
    </div>
  );
}
