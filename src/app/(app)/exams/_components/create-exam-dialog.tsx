"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  EXAM_DEFAULT_QUESTIONS,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_QUESTIONS,
  generateExamQuestionsAction,
} from "@/modules/exams";
import { Button } from "@/shared/ui/button";
import { ChoiceGroup } from "@/shared/ui/choice-group";
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
import { NativeSelect } from "@/shared/ui/native-select";

export interface CreateExamNotebook {
  id: string;
  title: string;
  // The notebook's active pages, in notebook order.
  pages: readonly { id: string; title: string }[];
}

export interface CreateExamDialogProps {
  notebooks: readonly CreateExamNotebook[];
  // Preselected notebook (the exams notebook view); the first one otherwise.
  initialNotebookId?: string;
}

type CreateMode = "ai" | "manual";

const MODES = [
  {
    value: "ai",
    label: "Generar con IA",
    description: "La IA crea preguntas de opción múltiple desde la página.",
  },
  {
    value: "manual",
    label: "Crear mis preguntas",
    description: "Escribe tus propias preguntas para la página.",
  },
] as const;

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
// then either generates the questions with AI (same action, limits and
// error copy as the techniques panel; on success the notebook's exams open)
// or writes them on the page's questions screen.
export function CreateExamDialog({
  notebooks,
  initialNotebookId,
}: CreateExamDialogProps) {
  const router = useRouter();
  const notebookFieldId = useId();
  const pageFieldId = useId();
  const firstNotebookId =
    notebooks.find((n) => n.id === initialNotebookId)?.id ??
    notebooks[0]?.id ??
    "";
  const [open, setOpen] = useState(false);
  const [notebookId, setNotebookId] = useState(firstNotebookId);
  const [pageId, setPageId] = useState("");
  const [mode, setMode] = useState<CreateMode>("ai");
  const [count, setCount] = useState(EXAM_DEFAULT_QUESTIONS);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const notebook = notebooks.find((n) => n.id === notebookId);
  const pages = notebook?.pages ?? [];
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
    if (mode === "manual") {
      router.push(`/exams/${notebookId}/${pageId}/preguntas`);
      return;
    }
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
        <Button type="button" data-testid="create-exam-button">
          <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
          Crear examen
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="create-exam-dialog">
        <DialogHeader>
          <DialogTitle>Crear examen</DialogTitle>
          <DialogDescription>
            Elige la página del examen y cómo crear sus preguntas.
          </DialogDescription>
        </DialogHeader>
        {notebooks.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Aún no tienes cuadernos. Crea uno para empezar.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={notebookFieldId}
                className="text-fg-secondary text-sm"
              >
                Cuaderno
              </label>
              <NativeSelect
                id={notebookFieldId}
                value={notebookId}
                onChange={(event) => changeNotebook(event.target.value)}
                disabled={pending}
                data-testid="create-exam-notebook"
              >
                {notebooks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {pages.length === 0 ? (
              <p className="text-fg-muted text-sm">
                Este cuaderno aún no tiene páginas.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={pageFieldId}
                  className="text-fg-secondary text-sm"
                >
                  Página
                </label>
                <NativeSelect
                  id={pageFieldId}
                  value={pageId}
                  onChange={(event) => {
                    setPageId(event.target.value);
                    setError(null);
                    setNotice(null);
                  }}
                  disabled={pending}
                  required
                  data-testid="create-exam-page"
                >
                  <option value="" disabled>
                    Elige una página
                  </option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
            <ChoiceGroup
              aria-label="Cómo crear el examen"
              options={MODES}
              value={mode}
              onChange={setMode}
              testId="create-exam-mode"
            />
            {mode === "ai" && (
              <CountStepper
                label="Preguntas a generar"
                value={count}
                min={EXAM_MIN_QUESTIONS}
                max={EXAM_MAX_QUESTIONS}
                step={EXAM_COUNT_STEP}
                onChange={setCount}
                disabled={pending}
                testId="exam-count"
              />
            )}
            {notice && (
              <p
                data-testid="create-exam-notice"
                className="text-fg-muted text-sm"
              >
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </div>
        )}
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
            onClick={submit}
            disabled={!canSubmit}
            data-testid="create-exam-submit"
          >
            {pending ? "Generando…" : mode === "ai" ? "Generar" : "Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
