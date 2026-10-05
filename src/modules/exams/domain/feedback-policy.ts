// When an exam session asks the AI for feedback (user decision 2026-10-05):
//   failed attempt                         → generate (current weaknesses)
//   first passing attempt                  → generate
//   pass after an earlier pass             → reuse that pass's stored feedback
// Edge: if the most recent earlier pass has no stored feedback (its
// generation failed or never ran), the attempt generates. An older pass's
// feedback is not used: it would describe weaknesses already superseded.
export interface PreviousExamSession {
  readonly sessionId: string;
  // Null while the session is still open (abandoned sessions stay open).
  readonly passed: boolean | null;
  readonly finishedAt: Date | null;
  readonly feedbackId: string | null;
}

export type FeedbackDecision =
  | { readonly kind: "generate" }
  | {
      readonly kind: "reuse";
      readonly sessionId: string;
      readonly feedbackId: string;
    };

export function decideFeedback(input: {
  attemptPassed: boolean;
  // The page's earlier sessions, excluding the attempt being decided.
  previousSessions: readonly PreviousExamSession[];
}): FeedbackDecision {
  if (!input.attemptPassed) return { kind: "generate" };

  let lastPass: PreviousExamSession | null = null;
  let lastPassAt = 0;
  for (const session of input.previousSessions) {
    if (session.passed !== true || session.finishedAt === null) continue;
    const at = session.finishedAt.getTime();
    if (
      lastPass === null ||
      at > lastPassAt ||
      (at === lastPassAt && session.sessionId > lastPass.sessionId)
    ) {
      lastPass = session;
      lastPassAt = at;
    }
  }

  if (lastPass === null || lastPass.feedbackId === null) {
    return { kind: "generate" };
  }
  return {
    kind: "reuse",
    sessionId: lastPass.sessionId,
    feedbackId: lastPass.feedbackId,
  };
}
