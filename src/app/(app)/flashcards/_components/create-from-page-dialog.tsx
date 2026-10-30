"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateRecallQuestionsAction } from "@/modules/active-recall";
import { generateFlashcardsAction } from "@/modules/flashcards";
import {
  MIN_GENERATION_WORDS,
  PAGE_TOO_SHORT_CODE,
  RECALL_MIN_WORDS,
} from "@/shared/kernel/generation-capacity";
import { FROM_HUB_QUERY } from "@/shared/navigation/hub-return";
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
import { EmptyStateCta } from "@/shared/ui/empty-state-cta";
import { FormMessage } from "@/shared/ui/form-message";
import { GenerationsLeft } from "@/shared/ui/generations-left";
import { PagePicker, type PagePickerNotebook } from "@/shared/ui/page-picker";
import { PixelTile } from "@/shared/ui/pixel-tile";
import { pageTooShortMessage } from "@/shared/ui/short-page-copy";
import { TechniqueCreateTile } from "@/shared/ui/technique-create-tile";
import { TECHNIQUE_THEME } from "@/shared/ui/technique-theme";

type Technique = "flashcards" | "recall";

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
    theme: "flashcards",
    title: "Crear flashcards",
    description:
      "Elige la página: la IA crea tarjetas de pregunta y respuesta desde su texto.",
    cta: "Crear mis primeras flashcards",
    // Phase 8 H14: the words a page needs (100; recall's 10 questions 150).
    minWords: MIN_GENERATION_WORDS,
    tileHint: "Elige una página de tus cuadernos",
    genericFailure: "No pudimos generar las tarjetas. Intenta de nuevo.",
    errors: {
      AI_DAILY_LIMIT_REACHED: LIMIT_REACHED,
      AI_PAGE_EMPTY: PAGE_EMPTY,
      FLASHCARDS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
    } as Record<string, string>,
  },
  recall: {
    theme: "recall",
    title: "Generar preguntas",
    description:
      "Elige la página: la IA crea preguntas abiertas desde su texto para que las respondas de memoria.",
    cta: "Generar mis primeras preguntas",
    minWords: RECALL_MIN_WORDS,
    tileHint: "Elige una página para practicar",
    genericFailure: "No pudimos generar las preguntas. Intenta de nuevo.",
    errors: {
      AI_DAILY_LIMIT_REACHED: LIMIT_REACHED,
      AI_PAGE_EMPTY: PAGE_EMPTY,
    } as Record<string, string>,
  },
} as const;

function remainingCopy(remaining: number): string {
  if (remaining <= 0) return LIMIT_REACHED;
  return remaining === 1
    ? "Te queda 1 generación hoy"
    : `Te quedan ${remaining} generaciones hoy`;
}

// Creating from a technique hub (Phase 8 H11, user-approved flow
// 2026-10-29). Every flashcard and recall question belongs to a page
// (`page_id` is required), so the dialog first asks for a notebook and a
// page (`PagePicker`), then generates with AI, reusing the techniques
// panel's Server Actions (generateFlashcardsAction, then the page's deck;
// generateRecallQuestionsAction, then the page's session). AI only (user
// decision 2026-10-29, Phase 8 H12; H13 removed the deck's "Nueva tarjeta"
// too, so no card is written by hand anywhere).
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
  const [remaining, setRemaining] = useState(initialRemaining);
  const [error, setError] = useState<string | null>(null);
  const [emptyPage, setEmptyPage] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const prefix = `create-${technique}`;
  const limitReached = remaining !== null && remaining <= 0;
  const canSubmit = pageId !== "" && !pending && !limitReached;

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
    }
  }

  function failWith({ code, minWords }: { code: string; minWords?: number }) {
    if (NO_NEW_CONTENT_CODES.has(code)) {
      setNotice(NO_NEW_CONTENT);
      return;
    }
    if (code === PAGE_TOO_SHORT_CODE) {
      setError(pageTooShortMessage(minWords ?? config.minWords));
      return;
    }
    setError(config.errors[code] ?? config.genericFailure);
    if (code === "AI_PAGE_EMPTY") setEmptyPage(true);
    if (code === "AI_DAILY_LIMIT_REACHED") setRemaining(0);
  }

  function submit() {
    if (!canSubmit) return;
    clearFeedback();
    startTransition(async () => {
      try {
        if (technique === "flashcards") {
          const result = await generateFlashcardsAction({ pageId });
          if (!result.ok) return failWith(result.error);
          setOpen(false);
          router.push(
            `/flashcards/${notebookId}/${pageId}?repasar=1&${FROM_HUB_QUERY}`,
          );
          return;
        }
        const result = await generateRecallQuestionsAction({ pageId });
        if (!result.ok) return failWith(result.error);
        setOpen(false);
        router.push(`/active-recall/${notebookId}/${pageId}?${FROM_HUB_QUERY}`);
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

  const theme = TECHNIQUE_THEME[config.theme];

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{triggerNode}</DialogTrigger>
      <DialogContent
        data-testid={`${prefix}-dialog`}
        data-technique-theme={config.theme}
      >
        <DialogHeader
          icon={<PixelTile tone={theme.tone} icon={theme.icon} size={48} />}
        >
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
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
            minWords={config.minWords}
          />
          {notebooks !== null && notebooks.length > 0 && (
            <>
              {remaining !== null && (
                <GenerationsLeft
                  remaining={remaining}
                  data-testid={`${prefix}-remaining`}
                >
                  {remainingCopy(remaining)}
                </GenerationsLeft>
              )}
              {notice && (
                <FormMessage tone="info" data-testid={`${prefix}-notice`}>
                  {notice}
                </FormMessage>
              )}
              {error && (
                <FormMessage>
                  <p>{error}</p>
                  {emptyPage && (
                    <Link
                      href={`/notebooks/${notebookId}/pages/${pageId}`}
                      className="font-semibold text-primary-700 underline-offset-2 hover:underline"
                    >
                      Abrir la página
                    </Link>
                  )}
                </FormMessage>
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
            variant="technique"
            onClick={submit}
            disabled={!canSubmit}
            data-testid={`${prefix}-submit`}
          >
            {pending ? "Generando…" : "Generar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
