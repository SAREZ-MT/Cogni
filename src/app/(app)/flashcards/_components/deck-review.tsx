"use client";

import { CalendarCheck, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  finishFlashcardSessionAction,
  gradeFlashcardAction,
  type ReviewCardView,
  requestSessionFeedbackAction,
  startFlashcardSessionAction,
} from "@/modules/flashcards";
import { hubHref } from "@/shared/navigation/technique-hub";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import type { RatingTone } from "@/shared/ui/rating-button";
import { SectionHeader } from "@/shared/ui/section-header";
import { StatusBanner } from "@/shared/ui/status-banner";
import { plural } from "../_lib/plural";
import {
  FlashcardPlayer,
  type PlayerCard,
  type RateOutcome,
} from "./flashcard-player";
import {
  SessionFeedbackPanel,
  type SessionFeedbackPanelState,
} from "./session-feedback-panel";

const NOTHING_DUE = "STUDY_ENGINE_NOTHING_DUE";
// The card was graded already: the player sends one grade per card, so
// this only answers a retry whose first attempt reached the server but lost
// its response. The card is graded, so moving on is correct.
const ALREADY_GRADED = "STUDY_ENGINE_ITEM_NOT_DUE";
const GRADE_FAILURE = "No pudimos guardar tu respuesta. Intenta de nuevo.";

export interface DeckReviewProps {
  notebookId: string;
  notebookTitle: string;
  pageId: string;
  deckLabel: string;
  description: string;
  // A page without cards has no deck to review.
  canReview: boolean;
  // Header actions next to "Repasar" (none on the deck route since H13).
  actions?: ReactNode;
  // Below the header: the empty state of a page without cards (Phase 8
  // H18: the deck route no longer lists the cards; the edit page does).
  children?: ReactNode;
  // Opened from "Repasos de hoy" (`?repasar=1`): start the review right
  // away instead of waiting for "Repasar".
  autoStart?: boolean;
  // Where the back links and "Todos los mazos" lead (Phase 8 H16/H17: the
  // route's hubReturnHref); defaults to the hub filtered by the notebook.
  backHref?: string;
  // The query kept when `?repasar=1` is dropped (the `desde=hub` marker
  // and the hub's filter), without the leading "?".
  keepQuery?: string;
  // Phase 8 H18: the deck's cards for "Repasar igual", the practice pass
  // offered when nothing is due. Without them the up-to-date notice stays
  // the plain banner.
  practiceCards?: readonly PracticeCard[];
  // When the next review falls ("mañana", "en 3 días"); null when unknown.
  nextReview?: string | null;
  // Opened with `?modo=practica`: practise at once, starting no session.
  practice?: boolean;
}

export interface PracticeCard {
  id: string;
  front: string;
  back: string;
}

// A graded session has its server id; a practice pass has none and never
// reaches the review-session actions, so the SM-2 schedule, the review
// logs and the metrics stay as they were.
interface ActiveSession {
  sessionId: string | null;
  cards: PlayerCard[];
}

export const PRACTICE_PARAM = "modo";
export const PRACTICE_VALUE = "practica";

// Under each rating in practice: nothing is scheduled, so no interval.
const PRACTICE_HINT = "Práctica";
const PRACTICE_HINTS = {
  again: PRACTICE_HINT,
  hard: PRACTICE_HINT,
  good: PRACTICE_HINT,
  easy: PRACTICE_HINT,
};

type Notice = "nothing-due" | "start-failed" | null;

// null: nothing to give feedback on (no card graded), so no panel.
type Feedback = SessionFeedbackPanelState | null;

// Closes the session, then asks for its AI feedback (documento-maestro
// §3.3: at the end, never between cards). Any failure only degrades the
// panel to a calm note; the summary stays usable.
async function finishWithFeedback(sessionId: string): Promise<Feedback> {
  try {
    const finished = await finishFlashcardSessionAction({ sessionId });
    if (!finished.ok) return { status: "unavailable" };
    if (finished.value.reviewedCount === 0) return null;
    const result = await requestSessionFeedbackAction({ sessionId });
    if (result.ok && result.value.status === "done" && result.value.content) {
      return { status: "done", content: result.value.content };
    }
  } catch {
    // Network drop or a crashed action: same calm note.
  }
  return { status: "unavailable" };
}

function toPlayerCard(card: ReviewCardView): PlayerCard {
  const days = card.nextIntervalDays;
  return {
    id: card.itemId,
    front: card.front,
    back: card.back,
    hints: {
      again: plural(days.again, "día", "días"),
      hard: plural(days.hard, "día", "días"),
      good: plural(days.good, "día", "días"),
      easy: plural(days.easy, "día", "días"),
    },
  };
}

// The page deck with its graded review (documento-maestro §3.3): "Repasar"
// opens a session over the page's due cards and swaps the deck for the
// FlashcardPlayer; every answer is graded through the review-session
// Server Actions (§7.2 buttons, SM-2 in study-engine). Leaving the summary
// brings the refreshed deck back.
export function DeckReview({
  notebookId,
  pageId,
  deckLabel,
  description,
  canReview,
  actions,
  children,
  autoStart = false,
  backHref = hubHref("/flashcards", notebookId),
  keepQuery = "",
  practiceCards,
  nextReview = null,
  practice = false,
}: DeckReviewProps) {
  const router = useRouter();
  const autoStarted = useRef(false);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [feedback, setFeedback] = useState<Feedback>({ status: "loading" });
  const [starting, startTransition] = useTransition();
  const deckPath = `/flashcards/${notebookId}/${pageId}`;

  function startPractice() {
    if (!practiceCards || practiceCards.length === 0) return;
    setNotice(null);
    window.history.replaceState(
      null,
      "",
      `${deckPath}?${keepQuery ? `${keepQuery}&` : ""}${PRACTICE_PARAM}=${PRACTICE_VALUE}`,
    );
    setSession({
      sessionId: null,
      cards: practiceCards.map((card) => ({ ...card, hints: PRACTICE_HINTS })),
    });
  }

  // "Volver al mazo" from the summary. Leaving a practice pass drops
  // `?modo=practica` (a reload shows the deck instead of practising) and
  // shows the up-to-date state again; leaving a graded session asks for
  // the deck's due cards again, so the deck says it is up to date, or
  // goes on with what is still due.
  function exitSession() {
    const practised = session?.sessionId === null;
    setSession(null);
    router.refresh();
    if (practised) {
      window.history.replaceState(
        null,
        "",
        `${deckPath}${keepQuery ? `?${keepQuery}` : ""}`,
      );
      setNotice("nothing-due");
      return;
    }
    if (practiceCards) startReview();
  }

  function startReview() {
    setNotice(null);
    setFeedback({ status: "loading" });
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof startFlashcardSessionAction>>;
      try {
        result = await startFlashcardSessionAction({ pageId });
      } catch {
        setNotice("start-failed");
        return;
      }
      if (!result.ok) {
        setNotice(
          result.error.code === NOTHING_DUE ? "nothing-due" : "start-failed",
        );
        return;
      }
      if (result.value.cards.length === 0) {
        setNotice("nothing-due");
        return;
      }
      setSession({
        sessionId: result.value.sessionId,
        cards: result.value.cards.map(toPlayerCard),
      });
    });
  }

  // Once per mount (the ref survives StrictMode's effect replay). The query
  // is dropped through the native history API, which Next.js syncs without
  // a server render, so a reload or "Volver al mazo" shows the deck instead
  // of starting another session.
  // biome-ignore lint/correctness/useExhaustiveDependencies: start once on mount, not on every render's new startReview
  useEffect(() => {
    if (autoStarted.current) return;
    if (practice && practiceCards && practiceCards.length > 0) {
      autoStarted.current = true;
      startPractice();
      return;
    }
    if (!autoStart || !canReview) return;
    autoStarted.current = true;
    window.history.replaceState(
      null,
      "",
      `${deckPath}${keepQuery ? `?${keepQuery}` : ""}`,
    );
    startReview();
  }, [autoStart, canReview, deckPath, keepQuery, practice]);

  if (session?.sessionId === null) {
    // Practice (H18): every rating is accepted locally, nothing is saved.
    return (
      <div className="flex flex-col">
        <StatusBanner
          tone="info"
          title="Modo práctica"
          description="Tus respuestas no cambian tus próximos repasos."
          className="mx-auto w-full max-w-[660px]"
        />
        <FlashcardPlayer
          notebookId={notebookId}
          deckLabel={deckLabel}
          cards={session.cards}
          onRate={async () => ({ ok: true })}
          feedback={null}
          backHref={backHref}
          onExit={exitSession}
        />
      </div>
    );
  }

  if (session) {
    const { sessionId } = session;
    const rate = async (
      card: PlayerCard,
      tone: RatingTone,
    ): Promise<RateOutcome> => {
      const result = await gradeFlashcardAction({
        sessionId,
        itemId: card.id,
        rating: tone,
      });
      if (result.ok)
        return { ok: true, masteryLevel: result.value.masteryLevel };
      if (result.error.code === ALREADY_GRADED) return { ok: true };
      return { ok: false, message: GRADE_FAILURE };
    };
    return (
      <FlashcardPlayer
        notebookId={notebookId}
        deckLabel={deckLabel}
        cards={session.cards}
        onRate={rate}
        onFinish={async () => {
          // The session stays open if closing fails; the summary still
          // shows, only without feedback.
          setFeedback(await finishWithFeedback(sessionId));
        }}
        feedback={feedback && <SessionFeedbackPanel state={feedback} />}
        backHref={backHref}
        onExit={exitSession}
      />
    );
  }

  const upToDate =
    notice === "nothing-due" && practiceCards && practiceCards.length > 0;

  return (
    <>
      <div className="flex flex-col gap-3">
        <BackLink href={backHref}>Flashcards</BackLink>
        <SectionHeader
          eyebrow="Flashcards"
          title={deckLabel}
          titleClassName="text-xl"
          description={description}
          actions={
            <div className="flex items-center gap-2">
              {actions}
              {canReview && !upToDate && (
                <Button
                  type="button"
                  data-testid="start-review-button"
                  disabled={starting}
                  onClick={startReview}
                >
                  <Play aria-hidden="true" size={15} strokeWidth={2} />
                  Repasar
                </Button>
              )}
            </div>
          }
        />
      </div>
      {upToDate && (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="success">
              <CalendarCheck aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Estás al día con este mazo"
          titleClassName="text-base"
          description={
            nextReview
              ? `Tu próximo repaso es ${nextReview}. Si quieres, practica ahora: no cambia tus repasos.`
              : "No hay tarjetas pendientes. Si quieres, practica ahora: no cambia tus repasos."
          }
          descriptionClassName="max-w-[380px]"
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" onClick={startPractice}>
                <Play aria-hidden="true" size={15} strokeWidth={2} />
                Repasar igual
              </Button>
              <Button asChild variant="outline">
                <Link href={backHref}>Volver a Flashcards</Link>
              </Button>
            </div>
          }
        />
      )}
      {notice === "nothing-due" && !upToDate && (
        <StatusBanner
          tone="success"
          title="Estás al día"
          description="No hay tarjetas pendientes en este mazo. Vuelve cuando toque repasar."
        />
      )}
      {notice === "start-failed" && (
        <StatusBanner
          tone="error"
          title="No pudimos iniciar el repaso"
          description="Intenta de nuevo en unos segundos."
        />
      )}
      {children}
    </>
  );
}
