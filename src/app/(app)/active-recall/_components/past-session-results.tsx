"use client";

import { useRouter } from "next/navigation";
import { ActiveRecallResultsView } from "./active-recall-results-view";
import type { QuestionRecord } from "./self-rating";

export interface PastSessionResultsProps {
  pageTitle: string;
  records: QuestionRecord[];
  sessionId: string;
  sessionsHref: string;
  // The page's session route: "Nueva sesión →" opens it.
  sessionHref: string;
}

// A past session's results (Phase 6 T7): the same ActiveRecallResultsView
// the player shows at the end of a session, fed from the stored session,
// polling its evaluation like a fresh one. "Nueva sesión →" goes to the
// page's session route instead of restarting an in-page player.
export function PastSessionResults({
  pageTitle,
  records,
  sessionId,
  sessionsHref,
  sessionHref,
}: PastSessionResultsProps) {
  const router = useRouter();
  return (
    <ActiveRecallResultsView
      pageTitle={pageTitle}
      records={records}
      sessionsHref={sessionsHref}
      sessionId={sessionId}
      onRestart={() => router.push(sessionHref)}
    />
  );
}
