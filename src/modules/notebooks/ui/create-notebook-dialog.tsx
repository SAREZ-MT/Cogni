"use client";

import { Plus } from "lucide-react";
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
          <DialogDescription>
            Uno por materia o tema: ahí se juntan sus páginas.
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
            Crear cuaderno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
