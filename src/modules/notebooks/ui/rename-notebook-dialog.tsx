"use client";

import { useId, useState } from "react";
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
import { FieldLabel } from "@/shared/ui/field-label";
import { Input } from "@/shared/ui/input";

interface RenameNotebookDialogProps {
  initialTitle: string;
  onRename: (title: string) => void;
  trigger: React.ReactNode;
  // Fires on every open/close, including the close after saving or
  // cancelling, so a host menu can close together with the dialog.
  onOpenChange?: (open: boolean) => void;
}

// Design pass 2: the /notebooks grid/list and Home's "Mis cuadernos" grid
// need a rename entry point now that the sidebar no longer shows the
// double-click-to-rename tree row (notebook-item.tsx). Same shape as
// CreateNotebookDialog, pre-filled with the current title instead of empty.
export function RenameNotebookDialog({
  initialTitle,
  onRename,
  trigger,
  onOpenChange,
}: RenameNotebookDialogProps) {
  const [open, setOpenState] = useState(false);

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }
  const [title, setTitle] = useState(initialTitle);
  const titleId = useId();

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === initialTitle) {
      setOpen(false);
      return;
    }
    onRename(trimmed);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTitle(initialTitle);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar cuaderno</DialogTitle>
          <DialogDescription>
            Cambia el nombre que ves en tus cuadernos y en el sidebar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={titleId}>Título</FieldLabel>
          <Input
            id={titleId}
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            className="h-11 rounded-input px-3.5"
            placeholder="Nombre del cuaderno"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="brand"
            onClick={submit}
            disabled={title.trim().length === 0}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
