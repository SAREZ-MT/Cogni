"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateRecallQuestionsAction } from "@/modules/active-recall";
import { generateFlashcardsAction } from "@/modules/flashcards";
import { Button } from "@/shared/ui/button";
import { ChoiceGroup } from "@/shared/ui/choice-group";
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
import { PagePicker, type PagePickerNotebook } from "@/shared/ui/page-picker";
import { TechniqueCreateTile } from "@/shared/ui/technique-create-tile";

type Technique = "flashcards" | "recall";
type Mode = "ai" | "manual";

export interface CreateFromPageDialogProps {
  technique: Technique;
  // From `loadCreateExamNotebooks`; null when they could not be read.
  notebooks: readonly PagePickerNotebook[] | null;
  // Generations left today (shared daily limit); null when unknown.
  remaining: number | null;
  // "cta": the empty state's technique pill. "tile": the first, fixed tile
  // of the hub's grid.
  trigger: "cta" | "tile";
}

const LIMIT_REACHED = "Llegaste al límite de hoy. Vuelve mañana.";
const PAGE_EMPTY = "La página está vacía: escribe algo antes de generar.";
const NO_NEW_CONTENT = "No hay contenido nuevo para generar";
const NO_NEW_CONTENT_CODES = new Set([
  "FLASHCARDS_NO_NEW_CONTENT",
  "RECALL_NO_NEW_CONTENT",
]);

// Per technique: the copy, the triggers and the action of the techniques
// panel it reuses (same error copy as the panel's cards).
const CONFIG = {
  flashcards: {
    title: "Crear flashcards",
    description: "Elige la página de tus tarjetas y cómo crearlas.",
    cta: "Crear mis primeras flashcards",
    tileHint: "Elige una página de tus cuadernos",
    genericFailure: "No pudimos generar las tarjetas. Intenta de nuevo.",
    errors: {
      AI_DAILY_LIMIT_REACHED: LIMIT_REACHED,
      AI_PAGE_EMPTY: PAGE_EMPTY,
      FLASHCARDS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
    } as Record<string, string>,
  },
  recall: {
    title: "Generar preguntas",
    description:
      "Elige la página: la IA crea preguntas abiertas desde su texto para que las respondas de memoria.",
    cta: "Generar mis primeras preguntas",
    tileHint: "Elige una página para practicar",
    genericFailure: "No pudimos generar las preguntas. Intenta de nuevo.",
    errors: {
      AI_DAILY_LIMIT_REACHED: LIMIT_REACHED,
      AI_PAGE_EMPTY: PAGE_EMPTY,
    } as Record<string, string>,
  },
} as const;

const FLASHCARD_MODES = [
  {
    value: "ai",
    label: "Generar con IA",
    description: "La IA crea tarjetas desde el texto de la página.",
  },
  {
    value: "manual",
    label: "Crear a mano",
    description: "Escribe tú la pregunta y la respuesta de cada tarjeta.",
  },
] as const;

function remainingCopy(remaining: number): string {
  if (remaining <= 0) return LIMIT_REACHED;
  return remaining === 1
    ? "Te queda 1 generación hoy"
    : `Te quedan ${remaining} generaciones hoy`;
}

// Creating from a technique hub (Phase 8 H11, user-approved flow
// 2026-10-29). Every flashcard and recall question belongs to a page
// (`page_id` is required), so the dialog first asks for a notebook and a
// page (`PagePicker`), then offers the technique's paths, reusing the
// techniques panel's Server Actions:
// - Flashcards: "Generar con IA" (generateFlashcardsAction, then the page's
//   deck) or "Crear a mano" (the page's deck with `?nueva=1`, which opens
//   "Nueva tarjeta" at once — the deck route renders for a page with no
//   cards, so the first card starts the deck).
// - Recordación activa: "Generar con IA" only (documento-maestro: recall
//   questions are AI-generated), then the page's session.
// The remaining generations show under the AI path and block it at 0; an
// empty page reads the panel's error and links to the page.
export function CreateFromPageDialog({
  technique,
  notebooks,
  remaining: initialRemaining,
  trigger,
}: CreateFromPageDialogProps) {
  const config = CONFIG[technique];
  const router = useRouter();
  const firstNotebookId = notebooks?.[0]?.id ?? "";
  const [open, setOpen] = useState(false);
  const [notebookId, setNotebookId] = useState(firstNotebookId);
  const [pageId, setPageId] = useState("");
  const [mode, setMode] = useState<Mode>("ai");
  const [remaining, setRemaining] = useState(initialRemaining);
  const [error, setError] = useState<string | null>(null);
  const [emptyPage, setEmptyPage] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const prefix = `create-${technique}`;
  const limitReached = remaining !== null && remaining <= 0;
  const canSubmit =
    pageId !== "" && !pending && (mode === "manual" || !limitReached);

  function clearFeedback() {
    setError(null);
    setEmptyPage(false);
    setNotice(null);
  }

  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    clearFeedback();
    if (next) {
      setNotebookId(firstNotebookId);
      setPageId("");
      setMode("ai");
    }
  }

  function failWith(code: string) {
    if (NO_NEW_CONTENT_CODES.has(code)) {
      setNotice(NO_NEW_CONTENT);
      return;
    }
    setError(config.errors[code] ?? config.genericFailure);
    if (code === "AI_PAGE_EMPTY") setEmptyPage(true);
    if (code === "AI_DAILY_LIMIT_REACHED") setRemaining(0);
  }

  function submit() {
    if (!canSubmit) return;
    clearFeedback();
    if (technique === "flashcards" && mode === "manual") {
      router.push(`/flashcards/${notebookId}/${pageId}?nueva=1`);
      return;
    }
    startTransition(async () => {
      try {
        if (technique === "flashcards") {
          const result = await generateFlashcardsAction({ pageId });
          if (!result.ok) return failWith(result.error.code);
          setOpen(false);
          router.push(`/flashcards/${notebookId}/${pageId}`);
          return;
        }
        const result = await generateRecallQuestionsAction({ pageId });
        if (!result.ok) return failWith(result.error.code);
        setOpen(false);
        router.push(`/active-recall/${notebookId}/${pageId}`);
      } catch {
        setError(config.genericFailure);
      }
    });
  }

  const triggerNode =
    trigger === "cta" ? (
      <EmptyStateCta tone="technique" data-testid={`${prefix}-cta`}>
        {config.cta}
      </EmptyStateCta>
    ) : (
      <TechniqueCreateTile
        label={config.title}
        hint={config.tileHint}
        data-testid={`${prefix}-tile`}
      />
    );
  const showsAi = technique === "recall" || mode === "ai";

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{triggerNode}</DialogTrigger>
      <DialogContent data-testid={`${prefix}-dialog`}>
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <PagePicker
            notebooks={notebooks}
            notebookId={notebookId}
            pageId={pageId}
            onNotebookChange={(next) => {
              setNotebookId(next);
              setPageId("");
              clearFeedback();
            }}
            onPageChange={(next) => {
              setPageId(next);
              clearFeedback();
            }}
            disabled={pending}
            testIdPrefix={prefix}
          />
          {notebooks !== null && notebooks.length > 0 && (
            <>
              {technique === "flashcards" && (
                <ChoiceGroup
                  aria-label="Cómo crear las flashcards"
                  options={FLASHCARD_MODES}
                  value={mode}
                  onChange={(next) => {
                    setMode(next);
                    clearFeedback();
                  }}
                  tone="amber"
                  testId={`${prefix}-mode`}
                />
              )}
              {showsAi && remaining !== null && (
                <p
                  data-testid={`${prefix}-remaining`}
                  className="text-fg-secondary text-xs"
                >
                  {remainingCopy(remaining)}
                </p>
              )}
              {notice && (
                <p
                  data-testid={`${prefix}-notice`}
                  className="text-fg-muted text-sm"
                >
                  {notice}
                </p>
              )}
              {error && (
                <div className="flex flex-col gap-1">
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                  {emptyPage && (
                    <Link
                      href={`/notebooks/${notebookId}/pages/${pageId}`}
                      className="self-start font-semibold text-primary-700 text-sm underline-offset-2 hover:underline"
                    >
                      Abrir la página
                    </Link>
                  )}
                </div>
              )}
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
            onClick={submit}
            disabled={!canSubmit}
            data-testid={`${prefix}-submit`}
          >
            {pending ? "Generando…" : showsAi ? "Generar" : "Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
