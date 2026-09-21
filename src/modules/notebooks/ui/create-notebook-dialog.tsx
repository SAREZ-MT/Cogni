"use client";

import { Plus } from "lucide-react";
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

interface CreateNotebookDialogProps {
  onCreate: (title: string) => void;
  trigger?: React.ReactNode;
}

// Scenarios "Reescritura de shell-empty-state.spec.ts" / "Crear y abrir una
// página" need a labelled control to create the first notebook.
export function CreateNotebookDialog({
  onCreate,
  trigger,
}: CreateNotebookDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const titleId = useId();

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setTitle("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            <Plus aria-hidden="true" size={16} />
            Crear cuaderno
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cuaderno</DialogTitle>
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
            Crear cuaderno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
