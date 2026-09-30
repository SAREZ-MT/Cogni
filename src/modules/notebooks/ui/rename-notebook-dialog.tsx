"use client";

import { useId, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

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
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor={titleId} className="text-fg-secondary text-sm">
            Título
          </label>
          <input
            id={titleId}
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            className="h-10 rounded-input border border-border-default bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="Nombre del cuaderno"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={title.trim().length === 0}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
