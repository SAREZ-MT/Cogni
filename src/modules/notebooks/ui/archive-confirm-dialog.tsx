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
}

// Archiving is not reversible from the UI (specs/notebooks/spec.md,
// "Archivado lógico sin restauración"), so every archive action asks for
// confirmation first (Scenario "Archivar desde el sidebar").
export function ArchiveConfirmDialog({
  itemLabel,
  onConfirm,
  trigger,
}: ArchiveConfirmDialogProps) {
  const [open, setOpen] = useState(false);

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
