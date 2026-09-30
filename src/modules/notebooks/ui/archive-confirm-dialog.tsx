"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

interface ArchiveConfirmDialogProps {
  itemLabel: string;
  onConfirm: () => void;
  trigger: React.ReactNode;
  // Fires on every open/close, including the programmatic close after
  // confirming or cancelling: a host that nests this dialog inside a menu
  // (notebook-card-actions.tsx) uses it to close that menu too.
  onOpenChange?: (open: boolean) => void;
}

// Archiving is not reversible from the UI (specs/notebooks/spec.md,
// "Archivado lógico sin restauración"), so every archive action asks for
// confirmation first (Scenario "Archivar desde el sidebar").
export function ArchiveConfirmDialog({
  itemLabel,
  onConfirm,
  trigger,
  onOpenChange,
}: ArchiveConfirmDialogProps) {
  const [open, setOpenState] = useState(false);

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archivar {itemLabel}</DialogTitle>
          <DialogDescription>
            No podrás deshacer esta acción desde aquí. {itemLabel} dejará de
            aparecer en el sidebar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            Archivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
