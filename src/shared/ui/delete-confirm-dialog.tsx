"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { FormMessage } from "@/shared/ui/form-message";

const READ_FAILURE =
  "No pudimos revisar qué se eliminará. Cierra e inténtalo de nuevo.";
const DELETE_FAILURE = "No pudimos eliminarlo. Inténtalo de nuevo.";

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // "¿Eliminar el cuaderno «Biología»?"
  title: string;
  // The destructive button, e.g. "Eliminar cuaderno".
  confirmLabel: string;
  // Reads, on the server, what the delete removes and returns the cascade
  // line ("Se eliminarán 4 páginas y 2 mazos."); null when nothing below
  // the item is counted (then `emptySummary` shows). A throw is a failed
  // read: the delete stays disabled.
  loadSummary: () => Promise<string | null>;
  emptySummary: string;
  // Runs the delete; resolves to null on success or to the Spanish reason
  // it failed (the dialog stays open with it). A throw is a generic failure.
  onConfirm: () => Promise<string | null>;
  // After a successful delete, once the dialog closed: refresh or leave.
  onDeleted: () => void;
  testId?: string;
}

type Summary =
  | { state: "loading" }
  | { state: "ready"; text: string }
  | { state: "failed" };

// Phase 8 H19: the one confirmation of every hard delete (notebook, page,
// deck, recall set, exam set). Controlled, so a kebab menu item can open it
// from outside the menu (it survives the menu closing). Opening it reads
// the cascade counts from the server right then, so the numbers are the
// ones the delete will remove; the destructive button (H18 "Salir sin
// guardar" styling) stays disabled until they are in.
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  loadSummary,
  emptySummary,
  onConfirm,
  onDeleted,
  testId,
}: DeleteConfirmDialogProps) {
  const [summary, setSummary] = useState<Summary>({ state: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Read once per opening; `loadSummary` is a fresh closure every render,
  // so it is deliberately left out of the dependencies.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!open) return;
    let current = true;
    setSummary({ state: "loading" });
    setError(null);
    loadSummary().then(
      (text) => {
        if (current) setSummary({ state: "ready", text: text ?? emptySummary });
      },
      () => {
        if (current) setSummary({ state: "failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [open]);

  async function confirm() {
    setError(null);
    setPending(true);
    let reason: string | null;
    try {
      reason = await onConfirm();
    } catch {
      reason = DELETE_FAILURE;
    }
    setPending(false);
    if (reason !== null) {
      setError(reason);
      return;
    }
    onOpenChange(false);
    onDeleted();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent data-testid={testId} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
          <DialogDescription className="flex flex-col gap-1">
            {summary.state !== "failed" && (
              <span
                data-slot="deletion-summary"
                aria-live="polite"
                className="font-medium text-fg"
              >
                {summary.state === "ready"
                  ? summary.text
                  : "Revisando qué se eliminará…"}
              </span>
            )}
            <span>Esta acción no se puede deshacer.</span>
          </DialogDescription>
        </DialogHeader>
        {summary.state === "failed" && (
          <FormMessage>{READ_FAILURE}</FormMessage>
        )}
        {error && <FormMessage>{error}</FormMessage>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            aria-label={confirmLabel}
            disabled={pending || summary.state !== "ready"}
            onClick={confirm}
          >
            {pending ? "Eliminando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
