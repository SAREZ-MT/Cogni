"use client";

import {
  FileCheck,
  Layers,
  ListChecks,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { getSampleStudyItemsForPage } from "@/app/(app)/flashcards/_data/sample";
import { generateRecallQuestionsAction } from "@/modules/active-recall";
import {
  EXAM_DEFAULT_QUESTIONS,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_QUESTIONS,
  type ExamStartView,
  generateExamQuestionsAction,
  getExamStartAction,
} from "@/modules/exams";
import {
  type FlashcardView,
  generateFlashcardsAction,
  listFlashcardsAction,
} from "@/modules/flashcards";
import { Button } from "@/shared/ui/button";
import { CountStepper } from "@/shared/ui/count-stepper";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { PanelToggleButton } from "@/shared/ui/panel-toggle-button";
import { Pill } from "@/shared/ui/pill";
import { SavedStudySection } from "@/shared/ui/saved-study-section";
import { SidePanel } from "@/shared/ui/side-panel";
import type { StudyItemRowProps } from "@/shared/ui/study-item-row";
import { TechniqueCard, TechniqueIconStrip } from "@/shared/ui/technique-card";
import {
  TECHNIQUES_PANEL_COLLAPSED,
  TECHNIQUES_PANEL_COOKIE,
  TECHNIQUES_PANEL_EXPANDED,
} from "../../../../../_components/techniques-panel-cookie";
import { TECHNIQUES_PANEL_SLOT_ID } from "../../../../../_components/techniques-panel-slot";
import { TECHNIQUES } from "./techniques";

// Examen is live since Phase 5: its card links to the page's questions
// ("Preguntas", real data, T4) and its "Generar" creates 10-30 AI questions
// (T5), sharing the daily generation limit with Flashcards.
//
// Active recall's "Generar" creates 10 AI open questions since Phase 6 T4
// (same daily limit), but its card still renders only with `showPreviews`
// until its session ships (T5).
//
// PREVIEW ONLY: the Active recall and Exámenes saved items are still design previews (user
// decision 2026-09-24): fixed sample items, not filtered by the real
// notebookId/pageId this panel is mounted on — see
// getSampleStudyItemsForPage's own doc comment. They render only when the
// page route passes `showPreviews`. Flashcards are real (Phase 3) and never
// read this sample. `sample.ts` is a plain data module (no server-only
// imports), so importing it here is safe.
const STUDY_ITEMS = getSampleStudyItemsForPage();

// Rows shown in the panel before pointing at the full deck page.
const VISIBLE_CARDS = 5;

const GENERIC_FAILURE = "No pudimos generar las tarjetas. Intenta de nuevo.";
const LIMIT_REACHED = "Llegaste al límite de hoy. Vuelve mañana.";

// Spanish copy per ActionError code of generateFlashcardsAction; anything
// not listed (PAGE_NOT_FOUND, FLASHCARDS_UNEXPECTED, AI_GENERATION_FAILED,
// invalid input…) reads as the generic failure.
const ERROR_COPY: Record<string, string> = {
  AI_DAILY_LIMIT_REACHED: LIMIT_REACHED,
  AI_PAGE_EMPTY: "La página está vacía: escribe algo antes de generar.",
  FLASHCARDS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
};

const EXAM_GENERIC_FAILURE =
  "No pudimos generar las preguntas. Intenta de nuevo.";

// Spanish copy per ActionError code of generateExamQuestionsAction; the
// rest (PAGE_NOT_FOUND, AI_GENERATION_FAILED, EXAMS_UNEXPECTED…) reads as
// the generic failure.
const EXAM_ERROR_COPY: Record<string, string> = {
  AI_DAILY_LIMIT_REACHED: LIMIT_REACHED,
  AI_PAGE_EMPTY: "La página está vacía: escribe algo antes de generar.",
  EXAMS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
};

// Spanish copy per ActionError code of generateRecallQuestionsAction; the
// rest (PAGE_NOT_FOUND, AI_GENERATION_FAILED, RECALL_*…) reads as the
// generic failure, which is the exam card's copy.
const RECALL_ERROR_COPY: Record<string, string> = {
  AI_DAILY_LIMIT_REACHED: LIMIT_REACHED,
  AI_PAGE_EMPTY: "La página está vacía: escribe algo antes de generar.",
};

// The count stepper moves in steps of 5 between 10 and 30.
const EXAM_COUNT_STEP = 5;

// The page's exam start state, or null when it cannot be read (the card
// then keeps "Rendir examen" disabled without a note).
async function readExamStart(pageId: string): Promise<ExamStartView | null> {
  try {
    const result = await getExamStartAction({ pageId });
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

function examNoticeCopy(value: {
  created: number;
  skipped: number;
  truncated: boolean;
  wordsUsed: number;
}): string {
  const parts = [
    value.created === 1
      ? "Se generó 1 pregunta."
      : `Se generaron ${value.created} preguntas.`,
  ];
  if (value.skipped === 1) {
    parts.push("1 se descartó por repetida o inválida.");
  } else if (value.skipped > 1) {
    parts.push(`${value.skipped} se descartaron por repetidas o inválidas.`);
  }
  if (value.truncated) {
    parts.push(
      `Se usaron las primeras ${value.wordsUsed} palabras de la página.`,
    );
  }
  return parts.join(" ");
}

// Phase 6 T4 (user-approved copy): the created count plus the truncation
// note; recall generation has no count to choose and reports no discards.
function recallNoticeCopy(value: {
  created: number;
  truncated: boolean;
  wordsUsed: number;
}): string {
  const parts = [
    value.created === 1
      ? "Se generó 1 pregunta."
      : `Se generaron ${value.created} preguntas.`,
  ];
  if (value.truncated) {
    parts.push(
      `Se usaron las primeras ${value.wordsUsed} palabras de la página.`,
    );
  }
  return parts.join(" ");
}

function remainingCopy(remaining: number): string {
  if (remaining <= 0) return LIMIT_REACHED;
  return remaining === 1
    ? "Te queda 1 generación hoy"
    : `Te quedan ${remaining} generaciones hoy`;
}

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export interface TechniquesPanelProps {
  initialCollapsed: boolean;
  notebookId: string;
  pageId: string;
  // Server decision (designPreviewsEnabled): also list the Active recall
  // preview and the Active recall / Exámenes sample saved items.
  showPreviews: boolean;
  // Initial data is read by the server page and refreshed on the client
  // after each generation (the panel is hidden/collapsible, so nothing
  // refetches on mount).
  initialFlashcards: FlashcardView[];
  // Generations left today; null when the status could not be read.
  initialRemaining: number | null;
}

// design/shell-look: the page-editor route's only consumer of the
// "Técnicas" side panel. Portals into TechniquesPanelSlot (rendered by
// AppLayout as a sibling after the content card) instead of rendering
// inline, since only this route knows it needs the panel — same pattern as
// Editor's autosave status portaling into PAGE_STATUS_SLOT_ID. `collapsed`
// starts from the server-read cookie (page.tsx) so a returning visitor's
// first paint already matches their last choice once the portal mounts.
export function TechniquesPanel({
  initialCollapsed,
  notebookId,
  pageId,
  showPreviews,
  initialFlashcards,
  initialRemaining,
}: TechniquesPanelProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [cards, setCards] = useState(initialFlashcards);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [examCount, setExamCount] = useState(EXAM_DEFAULT_QUESTIONS);
  const [examNotice, setExamNotice] = useState<string | null>(null);
  const [examError, setExamError] = useState<string | null>(null);
  const [examPending, startExamTransition] = useTransition();
  const [recallNotice, setRecallNotice] = useState<string | null>(null);
  const [recallError, setRecallError] = useState<string | null>(null);
  const [recallPending, startRecallTransition] = useTransition();
  // Whether the page can hold an exam ("Rendir examen"); read on mount and
  // after each question generation. Null until read or when it fails.
  const [examStart, setExamStart] = useState<ExamStartView | null>(null);
  // The slot element (rendered by AppLayout) doesn't exist as a portal
  // target concept until this component looks it up after mount —
  // `createPortal` needs a real, already-committed DOM node (same
  // resolve-after-mount pattern as Editor's statusPortalNode).
  const [slotNode, setSlotNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlotNode(document.getElementById(TECHNIQUES_PANEL_SLOT_ID));
  }, []);

  useEffect(() => {
    let active = true;
    readExamStart(pageId).then((view) => {
      if (active) setExamStart(view);
    });
    return () => {
      active = false;
    };
  }, [pageId]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    const value = next ? TECHNIQUES_PANEL_COLLAPSED : TECHNIQUES_PANEL_EXPANDED;
    // biome-ignore lint/suspicious/noDocumentCookie: cookieStore is missing in jsdom and older Safari
    document.cookie = `${TECHNIQUES_PANEL_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
  }

  function generate() {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof generateFlashcardsAction>>;
      try {
        result = await generateFlashcardsAction({ pageId });
      } catch {
        setError(GENERIC_FAILURE);
        return;
      }
      if (!result.ok) {
        setError(ERROR_COPY[result.error.code] ?? GENERIC_FAILURE);
        if (result.error.code === "AI_DAILY_LIMIT_REACHED") setRemaining(0);
        return;
      }
      setRemaining(result.value.remainingToday);
      if (result.value.truncated) {
        setNotice(
          `Se usaron las primeras ${result.value.wordsUsed} palabras de la página`,
        );
      }
      // The deck is the source of truth; if the refresh fails the cards this
      // generation created are still shown.
      const list = await listFlashcardsAction({ pageId }).catch(() => null);
      const generated = result.value.cards;
      setCards((previous) =>
        list?.ok ? list.value : [...previous, ...generated],
      );
    });
  }

  // The questions live on their own route (revalidated by the action), so
  // the panel only reports what was created; "Preguntas" opens the list.
  function generateExam() {
    setExamNotice(null);
    setExamError(null);
    startExamTransition(async () => {
      let result: Awaited<ReturnType<typeof generateExamQuestionsAction>>;
      try {
        result = await generateExamQuestionsAction({
          pageId,
          count: examCount,
        });
      } catch {
        setExamError(EXAM_GENERIC_FAILURE);
        return;
      }
      if (!result.ok) {
        setExamError(
          EXAM_ERROR_COPY[result.error.code] ?? EXAM_GENERIC_FAILURE,
        );
        if (result.error.code === "AI_DAILY_LIMIT_REACHED") setRemaining(0);
        return;
      }
      setRemaining(result.value.remainingToday);
      setExamNotice(examNoticeCopy(result.value));
      setExamStart(await readExamStart(pageId));
    });
  }

  // Active recall questions have no panel list yet (T5 adds the session),
  // so the panel only reports what was created, like Examen.
  function generateRecall() {
    setRecallNotice(null);
    setRecallError(null);
    startRecallTransition(async () => {
      let result: Awaited<ReturnType<typeof generateRecallQuestionsAction>>;
      try {
        result = await generateRecallQuestionsAction({ pageId });
      } catch {
        setRecallError(EXAM_GENERIC_FAILURE);
        return;
      }
      if (!result.ok) {
        setRecallError(
          RECALL_ERROR_COPY[result.error.code] ?? EXAM_GENERIC_FAILURE,
        );
        if (result.error.code === "AI_DAILY_LIMIT_REACHED") setRemaining(0);
        return;
      }
      setRemaining(result.value.remainingToday);
      setRecallNotice(recallNoticeCopy(result.value));
    });
  }

  if (!slotNode) return null;

  const limitReached = remaining !== null && remaining <= 0;

  const deckHref = `/flashcards/${notebookId}/${pageId}`;
  const cardRows: StudyItemRowProps[] = cards
    .slice(0, VISIBLE_CARDS)
    .map((card) => ({
      href: `${deckHref}#${card.id}`,
      label: card.front,
      detail: `${card.position + 1}`,
      tone: "primary",
      testId: "flashcard-item",
      title: card.back,
    }));
  if (cards.length > VISIBLE_CARDS) {
    cardRows.push({
      href: deckHref,
      label: "Ver el mazo completo",
      detail: `${cards.length} tarjetas`,
      tone: "primary",
      testId: "flashcard-deck-link",
    });
  }
  const visibleTechniques = showPreviews
    ? TECHNIQUES
    : TECHNIQUES.filter((t) => t.id !== "active-recall");
  const examHref = `/exams/${notebookId}/${pageId}`;
  const questionsHref = `${examHref}/preguntas`;
  const canTakeExam =
    examStart !== null &&
    !examStart.retakePending &&
    examStart.activeQuestionCount >= EXAM_MIN_QUESTIONS;

  const toggleButton = (
    <PanelToggleButton
      icon={collapsed ? PanelRightClose : PanelRightOpen}
      size={12}
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-label={
        collapsed ? "Expandir panel de técnicas" : "Colapsar panel de técnicas"
      }
      data-testid="techniques-panel-toggle"
    />
  );

  return createPortal(
    <SidePanel
      collapsed={collapsed}
      width={264}
      collapsedWidth={52}
      side="right"
      className="hidden lg:flex"
      aria-label="Técnicas de estudio"
      data-testid="techniques-panel"
      header={
        collapsed ? (
          toggleButton
        ) : (
          <>
            <div>
              <p className="font-semibold text-[12.5px] text-fg">Técnicas</p>
              <p className="mt-0.5 text-[10px] text-fg-muted">
                Genera contenido de estudio desde esta página
              </p>
            </div>
            {toggleButton}
          </>
        )
      }
      collapsedContent={
        <div className="flex flex-col items-center gap-[5px] py-2.5">
          {visibleTechniques.map((t) => (
            <TechniqueIconStrip
              key={t.id}
              icon={t.icon}
              tone={t.tone}
              title={t.name}
              available
            />
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-[7px] p-2.5 pb-3.5">
        {visibleTechniques.map((t) =>
          t.id === "flashcards" ? (
            <TechniqueCard
              key={t.id}
              icon={t.icon}
              tone={t.tone}
              name={t.name}
              description={t.description}
              onGenerate={generate}
              pending={pending}
              disabled={limitReached}
              generateTestId="generate-flashcards"
            >
              {remaining !== null && (
                <p
                  data-testid="generation-remaining"
                  className="text-[10.5px] text-fg-muted"
                >
                  {remainingCopy(remaining)}
                </p>
              )}
              {notice && (
                <p
                  data-testid="generation-notice"
                  className="text-[10.5px] text-fg-muted"
                >
                  {notice}
                </p>
              )}
              {error && (
                <p
                  role="alert"
                  data-testid="generation-error"
                  className="text-[10.5px] text-error-600"
                >
                  {error}
                </p>
              )}
            </TechniqueCard>
          ) : t.id === "exam" ? (
            <TechniqueCard
              key={t.id}
              icon={t.icon}
              tone={t.tone}
              name={t.name}
              description={t.description}
              onGenerate={generateExam}
              pending={examPending}
              disabled={limitReached}
              generateTestId="generate-exam-questions"
              controls={
                <CountStepper
                  label="Preguntas a generar"
                  value={examCount}
                  min={EXAM_MIN_QUESTIONS}
                  max={EXAM_MAX_QUESTIONS}
                  step={EXAM_COUNT_STEP}
                  onChange={setExamCount}
                  disabled={examPending}
                  testId="exam-count"
                />
              }
            >
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full text-[11.5px]"
              >
                <Link href={questionsHref} data-testid="exam-questions-link">
                  <ListChecks aria-hidden="true" size={14} strokeWidth={1.75} />
                  Preguntas
                </Link>
              </Button>
              {canTakeExam ? (
                <Button asChild size="sm" className="w-full text-[11.5px]">
                  <Link href={examHref} data-testid="take-exam-button">
                    <FileCheck
                      aria-hidden="true"
                      size={14}
                      strokeWidth={1.75}
                    />
                    Rendir examen
                  </Link>
                </Button>
              ) : examStart?.retakePending &&
                examStart.failedRootCount === 0 ? (
                // Every failed question was retired: the exam route clears
                // the retake and returns to the normal exam.
                <>
                  <Button asChild size="sm" className="w-full text-[11.5px]">
                    <Link href={examHref} data-testid="retake-exam-button">
                      <FileCheck
                        aria-hidden="true"
                        size={14}
                        strokeWidth={1.75}
                      />
                      Continuar
                    </Link>
                  </Button>
                  <p
                    data-testid="exam-retake-note"
                    className="text-[10.5px] text-fg-muted"
                  >
                    Retiraste las preguntas que fallaste: no queda nada por
                    repetir.
                  </p>
                </>
              ) : examStart?.retakePending &&
                examStart.activeQuestionCount < EXAM_MIN_QUESTIONS ? (
                <p
                  data-testid="exam-retake-needs-questions"
                  className="text-[10.5px] text-fg-muted"
                >
                  Agrega o genera preguntas para repetir el examen.
                </p>
              ) : examStart?.retakePending ? (
                <>
                  <Button asChild size="sm" className="w-full text-[11.5px]">
                    <Link href={examHref} data-testid="retake-exam-button">
                      <RotateCcw
                        aria-hidden="true"
                        size={14}
                        strokeWidth={1.75}
                      />
                      Repetir examen
                    </Link>
                  </Button>
                  <p
                    data-testid="exam-retake-note"
                    className="text-[10.5px] text-fg-muted"
                  >
                    {`Fallaste el último examen: ${examStart.failedRootCount} conceptos vuelven con preguntas reformuladas.`}
                  </p>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    className="w-full text-[11.5px]"
                    data-testid="take-exam-button"
                  >
                    <FileCheck
                      aria-hidden="true"
                      size={14}
                      strokeWidth={1.75}
                    />
                    Rendir examen
                  </Button>
                  {examStart && (
                    <p
                      data-testid="exam-needs-questions"
                      className="text-[10.5px] text-fg-muted"
                    >
                      {`Necesitas al menos ${EXAM_MIN_QUESTIONS} preguntas para rendir un examen.`}
                    </p>
                  )}
                </>
              )}
              {limitReached && !examError && (
                <p
                  data-testid="exam-generation-limit"
                  className="text-[10.5px] text-fg-muted"
                >
                  {LIMIT_REACHED}
                </p>
              )}
              {examNotice && (
                <p
                  data-testid="exam-generation-notice"
                  className="text-[10.5px] text-fg-muted"
                >
                  {examNotice}
                </p>
              )}
              {examError && (
                <p
                  role="alert"
                  data-testid="exam-generation-error"
                  className="text-[10.5px] text-error-600"
                >
                  {examError}
                </p>
              )}
            </TechniqueCard>
          ) : (
            <TechniqueCard
              key={t.id}
              icon={t.icon}
              tone={t.tone}
              name={t.name}
              description={t.description}
              onGenerate={generateRecall}
              pending={recallPending}
              disabled={limitReached}
              generateTestId="generate-recall-questions"
            >
              {limitReached && !recallError && (
                <p
                  data-testid="recall-generation-limit"
                  className="text-[10.5px] text-fg-muted"
                >
                  {LIMIT_REACHED}
                </p>
              )}
              {recallNotice && (
                <p
                  data-testid="recall-generation-notice"
                  className="text-[10.5px] text-fg-muted"
                >
                  {recallNotice}
                </p>
              )}
              {recallError && (
                <p
                  role="alert"
                  data-testid="recall-generation-error"
                  className="text-[10.5px] text-error-600"
                >
                  {recallError}
                </p>
              )}
            </TechniqueCard>
          ),
        )}

        <div className="mt-1 flex items-center gap-1.5 px-0.5">
          <p className="font-medium text-[10px] text-fg-muted uppercase tracking-[0.06em]">
            Generado en esta página
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {cardRows.length > 0 ? (
            <SavedStudySection label="Mazo de esta página" items={cardRows} />
          ) : (
            <EmptyState
              variant="tinted"
              icon={
                <IconTile size="30" tone="primary" radius="md">
                  <Layers aria-hidden="true" size={16} strokeWidth={1.75} />
                </IconTile>
              }
              title="Aún no hay tarjetas en esta página"
              titleAs="p"
              titleClassName="text-xs"
              description="Pulsa Generar en Flashcards para crearlas."
              descriptionClassName="text-[10.5px]"
              className="px-3 py-4"
            />
          )}
        </div>
        {showPreviews && (
          <>
            <div className="mt-1 flex items-center gap-1.5 px-0.5">
              <Pill size="sm" tone="neutral">
                Vista previa
              </Pill>
            </div>
            <div className="flex flex-col gap-2">
              <SavedStudySection
                label="Sesiones de Active Recall"
                items={STUDY_ITEMS.activeRecall}
              />
              <SavedStudySection
                label="Exámenes recientes"
                items={STUDY_ITEMS.exam}
              />
            </div>
          </>
        )}
      </div>
    </SidePanel>,
    slotNode,
  );
}
