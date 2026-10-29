"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  createFlashcardAction,
  MAX_FLASHCARD_SIDE_LENGTH,
} from "@/modules/flashcards";
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
import { FormMessage } from "@/shared/ui/form-message";
import { PixelTile } from "@/shared/ui/pixel-tile";
import { TECHNIQUE_THEME } from "@/shared/ui/technique-theme";
import { Textarea } from "@/shared/ui/textarea";

const GENERIC_FAILURE = "No pudimos guardar la tarjeta. Intenta de nuevo.";

// Spanish copy per ActionError code of createFlashcardAction; anything else
// falls back to GENERIC_FAILURE.
const ERROR_COPY: Record<string, string> = {
  FLASHCARD_EMPTY: "Escribe el anverso y el reverso.",
  FLASHCARD_TOO_LONG: `Cada lado admite hasta ${MAX_FLASHCARD_SIDE_LENGTH} caracteres.`,
  FLASHCARDS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
  PAGE_NOT_FOUND: "Esta página ya no existe.",
};

export interface NewFlashcardDialogProps {
  pageId: string;
}

// "Nueva tarjeta" on a page's deck (one deck per page; there is no
// notebook-level entry). Composes Cogni's Dialog, Textarea and Button atoms,
// same pattern as QuestionFormDialog. The card lands at the end of the deck
// and, when the page had none, starts it; the route refreshes to show it.
export function NewFlashcardDialog({ pageId }: NewFlashcardDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const frontId = useId();
  const backId = useId();

  const canSave = front.trim() !== "" && back.trim() !== "" && !pending;

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setFront("");
      setBack("");
      setError(null);
    }
  }

  function submit() {
    if (!canSave) return;
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createFlashcardAction>>;
      try {
        result = await createFlashcardAction({ pageId, front, back });
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
        <Button type="button" data-testid="new-flashcard-button">
          <Plus aria-hidden="true" size={16} strokeWidth={2} />
          Nueva tarjeta
        </Button>
      </DialogTrigger>
      <DialogContent
        data-testid="new-flashcard-dialog"
        data-technique-theme="flashcards"
        className="sm:max-w-lg"
      >
        <DialogHeader
          icon={
            <PixelTile
              tone={TECHNIQUE_THEME.flashcards.tone}
              icon={TECHNIQUE_THEME.flashcards.icon}
              size={48}
            />
          }
        >
          <DialogTitle>Nueva tarjeta</DialogTitle>
          <DialogDescription>
            Se agrega al mazo de esta página y entra hoy a tus repasos.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={frontId}>Anverso</FieldLabel>
            <Textarea
              id={frontId}
              autoFocus
              value={front}
              maxLength={MAX_FLASHCARD_SIDE_LENGTH}
              onChange={(event) => setFront(event.target.value)}
              placeholder="La pregunta o el concepto"
              className="min-h-20 rounded-input px-3.5 py-2.5"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={backId}>Reverso</FieldLabel>
            <Textarea
              id={backId}
              value={back}
              maxLength={MAX_FLASHCARD_SIDE_LENGTH}
              onChange={(event) => setBack(event.target.value)}
              placeholder="La respuesta"
              className="min-h-24 rounded-input px-3.5 py-2.5"
            />
          </div>
          {error && <FormMessage>{error}</FormMessage>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => changeOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="technique" disabled={!canSave}>
              {pending ? "Guardando…" : "Guardar tarjeta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
