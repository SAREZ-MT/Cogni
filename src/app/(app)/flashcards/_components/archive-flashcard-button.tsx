"use client";

import { Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveFlashcardAction } from "@/modules/flashcards";
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

const GENERIC_FAILURE = "No pudimos archivar la tarjeta. Intenta de nuevo.";

// Spanish copy per ActionError code of archiveFlashcardAction; anything else
// falls back to GENERIC_FAILURE.
const ERROR_COPY: Record<string, string> = {
  FLASHCARD_LAST_CARD:
    "Un mazo siempre conserva al menos una tarjeta. Agrega otra antes de archivar esta.",
  FLASHCARD_NOT_FOUND: "Esta tarjeta ya no está en el mazo.",
  FLASHCARDS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
};

export interface ArchiveFlashcardButtonProps {
  flashcardId: string;
}

// Per-card archive (logical delete) with a confirmation, since there is no
// undo yet. The server refuses the deck's last card (a deck is never
// empty); the dialog stays open and explains why.
export function ArchiveFlashcardButton({
  flashcardId,
}: ArchiveFlashcardButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) setError(null);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof archiveFlashcardAction>>;
      try {
        result = await archiveFlashcardAction({ flashcardId });
      } catch {
        setError(GENERIC_FAILURE);
        return;
      }
      if (!result.ok) {
        setError(ERROR_COPY[result.error.code] ?? GENERIC_FAILURE);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Archivar tarjeta"
          className="text-fg-muted"
          data-testid="archive-flashcard-button"
        >
          <Archive aria-hidden="true" size={14} strokeWidth={1.75} />
          Archivar
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="archive-flashcard-dialog">
        <DialogHeader>
          <DialogTitle>¿Archivar esta tarjeta?</DialogTitle>
          <DialogDescription>Sale del mazo y de tus repasos.</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => changeOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={pending}
          >
            {pending ? "Archivando…" : "Archivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
