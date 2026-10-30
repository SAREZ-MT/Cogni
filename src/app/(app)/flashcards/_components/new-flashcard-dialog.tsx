"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
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
  // Phase 8 H11: open at once (the deck route's `?nueva=1`, from a
  // technique hub's "Crear a mano"); the flag is then dropped from the URL
  // so a reload or the post-save refresh never reopens it.
  initialOpen?: boolean;
}

// "Nueva tarjeta" on a page's deck (one deck per page; there is no
// notebook-level entry). Composes Cogni's Dialog, Textarea and Button atoms,
// same pattern as QuestionFormDialog. The card lands at the end of the deck
// and, when the page had none, starts it; the route refreshes to show it.
export function NewFlashcardDialog({
  pageId,
  initialOpen = false,
}: NewFlashcardDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(initialOpen);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const frontId = useId();
  const backId = useId();

  const canSave = front.trim() !== "" && back.trim() !== "" && !pending;

  // Only the mount-time flag matters: drop `?nueva=1` once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-time only
  useEffect(() => {
    if (initialOpen) router.replace(pathname, { scroll: false });
  }, []);

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
      <DialogContent data-testid="new-flashcard-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva tarjeta</DialogTitle>
          <DialogDescription>
            Se agrega al mazo de esta página y entra hoy a tus repasos.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={frontId} className="text-fg-secondary text-sm">
              Anverso
            </label>
            <Textarea
              id={frontId}
              autoFocus
              value={front}
              maxLength={MAX_FLASHCARD_SIDE_LENGTH}
              onChange={(event) => setFront(event.target.value)}
              placeholder="La pregunta o el concepto"
              className="min-h-20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={backId} className="text-fg-secondary text-sm">
              Reverso
            </label>
            <Textarea
              id={backId}
              value={back}
              maxLength={MAX_FLASHCARD_SIDE_LENGTH}
              onChange={(event) => setBack(event.target.value)}
              placeholder="La respuesta"
              className="min-h-24"
            />
          </div>
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
            <Button type="submit" disabled={!canSave}>
              {pending ? "Guardando…" : "Guardar tarjeta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
