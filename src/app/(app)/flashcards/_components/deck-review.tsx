"use client";

import { Play } from "lucide-react";
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
import { FROM_HUB_QUERY } from "@/shared/navigation/hub-return";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
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
  // The deck itself (the review list or its empty state).
  children: ReactNode;
  // Opened from "Repasos de hoy" (`?repasar=1`): start the review right
  // away instead of waiting for "Repasar".
  autoStart?: boolean;
  // Opened from the hub's create dialog (`?desde=hub`, Phase 8 H16): the
  // back links lead to /flashcards instead of the notebook's decks, and
  // the marker survives dropping `?repasar=1`.
  fromHub?: boolean;
}

interface ActiveSession {
  sessionId: string;
  cards: PlayerCard[];
}

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
  notebookTitle,
  pageId,
  deckLabel,
  description,
  canReview,
  actions,
  children,
  autoStart = false,
  fromHub = false,
}: DeckReviewProps) {
  const backHref = fromHub ? "/flashcards" : `/flashcards/${notebookId}`;
  const router = useRouter();
  const autoStarted = useRef(false);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [feedback, setFeedback] = useState<Feedback>({ status: "loading" });
  const [starting, startTransition] = useTransition();

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
    if (!autoStart || !canReview || autoStarted.current) return;
    autoStarted.current = true;
    window.history.replaceState(
      null,
      "",
      `/flashcards/${notebookId}/${pageId}${fromHub ? `?${FROM_HUB_QUERY}` : ""}`,
    );
    startReview();
  }, [autoStart, canReview, notebookId, pageId, fromHub]);

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
        onExit={() => {
          setSession(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <BackLink href={backHref}>
          {fromHub ? "Flashcards" : notebookTitle}
        </BackLink>
        <SectionHeader
          eyebrow="Flashcards"
          title={deckLabel}
          titleClassName="text-xl"
          description={description}
          actions={
            <div className="flex items-center gap-2">
              {actions}
              {canReview && (
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
      {notice === "nothing-due" && (
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
