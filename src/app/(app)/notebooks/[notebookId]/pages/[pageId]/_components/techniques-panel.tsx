"use client";

import { PanelRightClose, PanelRightOpen, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  generateRecallQuestionsAction,
  getRecallPageSummaryAction,
} from "@/modules/active-recall";
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
import { EmptyState } from "@/shared/ui/empty-state";
import { PanelToggleButton } from "@/shared/ui/panel-toggle-button";
import { SavedStudySection } from "@/shared/ui/saved-study-section";
import { SidePanel } from "@/shared/ui/side-panel";
import type { StudyItemRowProps } from "@/shared/ui/study-item-row";
import {
  TechniqueCard,
  TechniqueIconStrip,
  TechniqueStack,
} from "@/shared/ui/technique-card";
import {
  TECHNIQUES_PANEL_COLLAPSED,
  TECHNIQUES_PANEL_COOKIE,
  TECHNIQUES_PANEL_EXPANDED,
} from "../../../../../_components/techniques-panel-cookie";
import { TECHNIQUES_PANEL_SLOT_ID } from "../../../../../_components/techniques-panel-slot";
import { ExamGenerateDialog } from "./exam-generate-dialog";
import { TECHNIQUES, type TechniqueDefinition } from "./techniques";

// "Técnicas de estudio" panel (Phase 6 T5b, user decision 2026-10-06:
// NotebookLM Studio model on the docs/design-system/screenshots/editor.png
// layout, without the AI status card). The three technique cards only
// generate ("Generar", coloured per technique, sharing the daily limit);
// below, "Generado en esta página" lists one row per technique that has
// content on this page, and a row opens that technique's practice route:
// - Flashcards: the deck route with `?repasar=1`, which starts the graded
//   review at once (the deck itself stays one "Volver al mazo" away);
// - Recordación activa: the recall session route;
// - Examen: the exam route, which itself offers the normal exam, the
//   pending retake or the "not enough questions" state (the same href the
//   former "Rendir examen"/"Repetir examen" buttons used).
// The three cards are identical (user decision 2026-10-06): the same pastel
// "Generar" and the same feedback lines; Examen's "Generar" first opens
// ExamGenerateDialog to choose the question count. Manual exam questions
// live in the Exams section (Exámenes → cuaderno → página → Preguntas).

const GENERIC_FAILURE = "No pudimos generar las tarjetas. Intenta de nuevo.";
const LIMIT_REACHED = "Llegaste al límite de hoy. Vuelve mañana.";

// Incremental generation (Phase 6 T5c): every paragraph of the page was
// already used by that technique. Not a failure — no AI call and no unit
// were spent — so it reads in the card's notice line, not as an error.
const NO_NEW_CONTENT = "No hay contenido nuevo para generar";
const NO_NEW_CONTENT_CODES = new Set([
  "FLASHCARDS_NO_NEW_CONTENT",
  "EXAMS_NO_NEW_CONTENT",
  "RECALL_NO_NEW_CONTENT",
]);

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

// The page's exam start state, or null when it cannot be read (the panel
// then lists no exam row).
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

// Recall questions on the page, or null when they cannot be read (the
// panel then keeps the count it had).
async function readRecallQuestionCount(pageId: string): Promise<number | null> {
  try {
    const result = await getRecallPageSummaryAction({ pageId });
    return result.ok ? result.value.questionCount : null;
  } catch {
    return null;
  }
}

function countCopy(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

function generatedRow(
  technique: TechniqueDefinition,
  href: string,
  detail: string,
): StudyItemRowProps {
  return {
    href,
    label: technique.name,
    detail,
    tone: technique.tone,
    testId: `generated-item-${technique.id}`,
  };
}

// The remaining-generations line under every technique's name (H9-T1:
// the tile's meta line), identical for the three; `prefix` namespaces the
// test id.
function RemainingLine({
  prefix,
  remaining,
}: {
  prefix: string;
  remaining: number | null;
}) {
  if (remaining === null) return null;
  return (
    <p
      data-testid={`${prefix}generation-remaining`}
      className="mt-0.5 text-[10.5px] text-fg-secondary leading-snug"
    >
      {remainingCopy(remaining)}
    </p>
  );
}

// The feedback lines under every technique's "Generar" (notice, error).
function CardFeedback({
  prefix,
  notice,
  error,
}: {
  prefix: string;
  notice: string | null;
  error: string | null;
}) {
  return (
    <>
      {notice && (
        <p
          data-testid={`${prefix}generation-notice`}
          className="text-[10.5px] text-fg-secondary"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          data-testid={`${prefix}generation-error`}
          className="text-[10.5px] text-error-600"
        >
          {error}
        </p>
      )}
    </>
  );
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
  // Initial data is read by the server page and refreshed on the client
  // after each generation (the panel is hidden/collapsible, so nothing
  // refetches on mount).
  initialFlashcards: FlashcardView[];
  // Active recall questions on the page; refreshed after a recall generation.
  // null when the server could not read it: the panel reads it again on
  // mount instead of treating the page as having no questions.
  initialRecallQuestionCount: number | null;
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
  initialFlashcards,
  initialRecallQuestionCount,
  initialRemaining,
}: TechniquesPanelProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [cards, setCards] = useState(initialFlashcards);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [examCount, setExamCount] = useState(EXAM_DEFAULT_QUESTIONS);
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [examNotice, setExamNotice] = useState<string | null>(null);
  const [examError, setExamError] = useState<string | null>(null);
  const [examPending, startExamTransition] = useTransition();
  const [recallNotice, setRecallNotice] = useState<string | null>(null);
  const [recallError, setRecallError] = useState<string | null>(null);
  const [recallPending, startRecallTransition] = useTransition();
  const [recallQuestionCount, setRecallQuestionCount] = useState(
    initialRecallQuestionCount,
  );
  // The page's exam state (question count, pending retake) behind the exam
  // row; read on mount and after each question generation. Null until read
  // or when it fails.
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

  // Every recall count read takes a ticket; only the latest one may set the
  // count, so a slow mount-time read never overwrites the newer count a
  // finished generation already read.
  const recallReadTicket = useRef(0);
  async function refreshRecallQuestionCount(): Promise<void> {
    recallReadTicket.current += 1;
    const ticket = recallReadTicket.current;
    const count = await readRecallQuestionCount(pageId);
    if (ticket === recallReadTicket.current && count !== null) {
      setRecallQuestionCount(count);
    }
  }

  // Only the server read's outcome at mount matters here: a later
  // generation re-reads the count itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-time retry
  useEffect(() => {
    if (initialRecallQuestionCount !== null) return;
    void refreshRecallQuestionCount();
    return () => {
      // An unmounted panel ignores the answer.
      recallReadTicket.current += 1;
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
        if (NO_NEW_CONTENT_CODES.has(result.error.code)) {
          setNotice(NO_NEW_CONTENT);
          return;
        }
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

  // The questions live on their own route (revalidated by the action): the
  // panel reports what was created and re-reads the exam row.
  function generateExam(count: number) {
    setExamNotice(null);
    setExamError(null);
    startExamTransition(async () => {
      let result: Awaited<ReturnType<typeof generateExamQuestionsAction>>;
      try {
        result = await generateExamQuestionsAction({
          pageId,
          count,
        });
      } catch {
        setExamError(EXAM_GENERIC_FAILURE);
        return;
      }
      if (!result.ok) {
        if (NO_NEW_CONTENT_CODES.has(result.error.code)) {
          setExamNotice(NO_NEW_CONTENT);
          return;
        }
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

  // Reports what was created and re-reads the recall row's count.
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
        if (NO_NEW_CONTENT_CODES.has(result.error.code)) {
          setRecallNotice(NO_NEW_CONTENT);
          return;
        }
        setRecallError(
          RECALL_ERROR_COPY[result.error.code] ?? EXAM_GENERIC_FAILURE,
        );
        if (result.error.code === "AI_DAILY_LIMIT_REACHED") setRemaining(0);
        return;
      }
      setRemaining(result.value.remainingToday);
      setRecallNotice(recallNoticeCopy(result.value));
      await refreshRecallQuestionCount();
    });
  }

  if (!slotNode) return null;

  const limitReached = remaining !== null && remaining <= 0;

  const generatedRows: StudyItemRowProps[] = TECHNIQUES.flatMap((t) => {
    if (t.id === "flashcards") {
      return cards.length > 0
        ? [
            generatedRow(
              t,
              `/flashcards/${notebookId}/${pageId}?repasar=1`,
              countCopy(cards.length, "tarjeta", "tarjetas"),
            ),
          ]
        : [];
    }
    if (t.id === "active-recall") {
      return recallQuestionCount !== null && recallQuestionCount > 0
        ? [
            generatedRow(
              t,
              `/active-recall/${notebookId}/${pageId}`,
              countCopy(recallQuestionCount, "pregunta", "preguntas"),
            ),
          ]
        : [];
    }
    if (!examStart) return [];
    const { activeQuestionCount, retakePending } = examStart;
    if (activeQuestionCount === 0 && !retakePending) return [];
    const count = countCopy(activeQuestionCount, "pregunta", "preguntas");
    return [
      generatedRow(
        t,
        `/exams/${notebookId}/${pageId}`,
        retakePending ? `${count} · Repetición pendiente` : count,
      ),
    ];
  });

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
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles
                aria-hidden="true"
                size={14}
                strokeWidth={2}
                className="shrink-0 text-primary-600"
              />
              <div className="min-w-0">
                <p className="font-bold text-[13px] text-fg leading-tight">
                  Técnicas de estudio
                </p>
                <p className="mt-0.5 text-[10.5px] text-fg-muted leading-tight">
                  Genera contenido de estudio con IA
                </p>
              </div>
            </div>
            {toggleButton}
          </>
        )
      }
      collapsedContent={
        <div className="flex flex-col items-center gap-[5px] py-2.5">
          {TECHNIQUES.map((t) => (
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
      <div className="flex flex-col gap-2 p-3 pb-4">
        {TECHNIQUES.map((t) => {
          const card =
            t.id === "flashcards"
              ? {
                  onGenerate: generate,
                  pending,
                  testId: "generate-flashcards",
                  prefix: "",
                  notice,
                  error,
                }
              : t.id === "exam"
                ? {
                    onGenerate: () => setExamDialogOpen(true),
                    pending: examPending,
                    testId: "generate-exam-questions",
                    prefix: "exam-",
                    notice: examNotice,
                    error: examError,
                  }
                : {
                    onGenerate: generateRecall,
                    pending: recallPending,
                    testId: "generate-recall-questions",
                    prefix: "recall-",
                    notice: recallNotice,
                    error: recallError,
                  };
          return (
            <TechniqueCard
              key={t.id}
              icon={t.icon}
              tone={t.tone}
              name={t.name}
              onGenerate={card.onGenerate}
              pending={card.pending}
              disabled={limitReached}
              generateTestId={card.testId}
              meta={
                <RemainingLine prefix={card.prefix} remaining={remaining} />
              }
            >
              <CardFeedback
                prefix={card.prefix}
                notice={card.notice}
                error={card.error}
              />
            </TechniqueCard>
          );
        })}
        <ExamGenerateDialog
          open={examDialogOpen}
          onOpenChange={setExamDialogOpen}
          count={examCount}
          onCountChange={setExamCount}
          min={EXAM_MIN_QUESTIONS}
          max={EXAM_MAX_QUESTIONS}
          step={EXAM_COUNT_STEP}
          onConfirm={generateExam}
        />

        <SavedStudySection
          label="Generado en esta página"
          items={generatedRows}
          className="mt-2"
          empty={
            <EmptyState
              variant="tinted"
              icon={<TechniqueStack />}
              title="Aquí verás todo lo que generes"
              titleAs="p"
              titleClassName="font-semibold text-[12px]"
              description="Las flashcards, preguntas y exámenes que crees a partir de esta página aparecerán en esta sección para que los practiques."
              descriptionClassName="text-[10.5px] leading-relaxed"
              className="px-4 py-5"
            />
          }
        />
      </div>
    </SidePanel>,
    slotNode,
  );
}
