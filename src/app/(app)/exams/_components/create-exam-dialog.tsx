"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  EXAM_DEFAULT_QUESTIONS,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_QUESTIONS,
  generateExamQuestionsAction,
} from "@/modules/exams";
import { Button } from "@/shared/ui/button";
import { CountStepper } from "@/shared/ui/count-stepper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { EmptyStateCta } from "@/shared/ui/empty-state-cta";
import { FormMessage } from "@/shared/ui/form-message";
import { PagePicker, type PagePickerNotebook } from "@/shared/ui/page-picker";
import { PixelTile } from "@/shared/ui/pixel-tile";
import { TechniqueCreateTile } from "@/shared/ui/technique-create-tile";
import { TECHNIQUE_THEME } from "@/shared/ui/technique-theme";

// A notebook with its active pages (Phase 8 H11: the shared PagePicker's
// shape, which also feeds the flashcards and recall create dialogs).
export type CreateExamNotebook = PagePickerNotebook;

export interface CreateExamDialogProps {
  // null when the notebooks could not be read (a load error, never the
  // "no notebooks yet" empty state).
  notebooks: readonly CreateExamNotebook[] | null;
  // Preselected notebook (the exams notebook view); the first one otherwise.
  initialNotebookId?: string;
  // Phase 8 H11: "button" (default) is the header's "Crear examen"; "cta"
  // the hub empty state's rose pill; "tile" the first, fixed tile of the
  // hub's grid.
  trigger?: "button" | "cta" | "tile";
}

// Same steps as the techniques panel's exam count (10–30 in steps of 5).
const EXAM_COUNT_STEP = 5;

const LIMIT_REACHED = "Llegaste al límite de hoy. Vuelve mañana.";
const GENERIC_FAILURE = "No pudimos generar las preguntas. Intenta de nuevo.";
// Incremental generation (Phase 6 T5c): the page has no paragraph exams
// has not used yet. Same copy as the techniques panel; a notice, not an
// error (no AI call and no generation were spent).
const NO_NEW_CONTENT_CODE = "EXAMS_NO_NEW_CONTENT";
const NO_NEW_CONTENT = "No hay contenido nuevo para generar";

// Spanish copy per ActionError code of generateExamQuestionsAction — the
// same messages the techniques panel's Examen card shows; anything else
// reads as the generic failure.
const ERROR_COPY: Record<string, string> = {
  AI_DAILY_LIMIT_REACHED: LIMIT_REACHED,
  AI_PAGE_EMPTY: "La página está vacía: escribe algo antes de generar.",
  EXAMS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
};

// "Crear examen" (Phase 6 T5b, user decision 2026-10-07): the exams hub's
// and notebook view's entry to start an exam for a page. The student picks
// a notebook and a page (mandatory: an exam belongs to a page for SM-2),
// then generates the questions with AI (same action, limits and error copy
// as the techniques panel; on success the notebook's exams open). AI only
// (user decision 2026-10-29, Phase 8 H12): writing questions by hand stays
// on the page's questions screen ("Nueva pregunta").
export function CreateExamDialog({
  notebooks: loadedNotebooks,
  initialNotebookId,
  trigger = "button",
}: CreateExamDialogProps) {
  const notebooks = loadedNotebooks ?? [];
  const router = useRouter();
  const firstNotebookId =
    notebooks.find((n) => n.id === initialNotebookId)?.id ??
    notebooks[0]?.id ??
    "";
  const [open, setOpen] = useState(false);
  const [notebookId, setNotebookId] = useState(firstNotebookId);
  const [pageId, setPageId] = useState("");
  const [count, setCount] = useState(EXAM_DEFAULT_QUESTIONS);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = pageId !== "" && !pending;

  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setError(null);
      setNotice(null);
      return;
    }
    setNotebookId(firstNotebookId);
    setPageId("");
  }

  function changeNotebook(next: string) {
    setNotebookId(next);
    setPageId("");
    setError(null);
    setNotice(null);
  }

  function submit() {
    if (!canSubmit) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof generateExamQuestionsAction>>;
      try {
        result = await generateExamQuestionsAction({ pageId, count });
      } catch {
        setError(GENERIC_FAILURE);
        return;
      }
      if (!result.ok) {
        if (result.error.code === NO_NEW_CONTENT_CODE) {
          setNotice(NO_NEW_CONTENT);
          return;
        }
        setError(ERROR_COPY[result.error.code] ?? GENERIC_FAILURE);
        return;
      }
      setOpen(false);
      router.push(`/exams/${notebookId}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {trigger === "cta" ? (
          <EmptyStateCta tone="technique" data-testid="create-exam-cta">
            Crear mi primer examen
          </EmptyStateCta>
        ) : trigger === "tile" ? (
          <TechniqueCreateTile
            label="Crear examen"
            hint="Elige una página para el examen"
            data-testid="create-exam-tile"
          />
        ) : (
          <Button type="button" data-testid="create-exam-button">
            <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
            Crear examen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        data-testid="create-exam-dialog"
        data-technique-theme="exams"
      >
        <DialogHeader
          icon={
            <PixelTile
              tone={TECHNIQUE_THEME.exams.tone}
              icon={TECHNIQUE_THEME.exams.icon}
              size={48}
            />
          }
        >
          <DialogTitle>Crear examen</DialogTitle>
          <DialogDescription>
            Elige la página: la IA crea preguntas de opción múltiple desde su
            texto.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <PagePicker
            notebooks={loadedNotebooks}
            notebookId={notebookId}
            pageId={pageId}
            onNotebookChange={changeNotebook}
            onPageChange={(next) => {
              setPageId(next);
              setError(null);
              setNotice(null);
            }}
            disabled={pending}
            testIdPrefix="create-exam"
          />
          {notebooks.length > 0 && (
            <>
              <CountStepper
                label="Preguntas a generar"
                value={count}
                min={EXAM_MIN_QUESTIONS}
                max={EXAM_MAX_QUESTIONS}
                step={EXAM_COUNT_STEP}
                onChange={setCount}
                disabled={pending}
                testId="exam-count"
                size="field"
                hint={`Entre ${EXAM_MIN_QUESTIONS} y ${EXAM_MAX_QUESTIONS}, de ${EXAM_COUNT_STEP} en ${EXAM_COUNT_STEP}`}
              />
              {notice && (
                <FormMessage tone="info" data-testid="create-exam-notice">
                  {notice}
                </FormMessage>
              )}
              {error && <FormMessage>{error}</FormMessage>}
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => changeOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="technique"
            onClick={submit}
            disabled={!canSubmit}
            data-testid="create-exam-submit"
          >
            {pending ? "Generando…" : "Generar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
