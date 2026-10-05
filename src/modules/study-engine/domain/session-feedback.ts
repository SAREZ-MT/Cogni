import type { SessionKind } from "./review-log";

// AI feedback for one finished review session (documento-maestro §6.1,
// §8.4). One row per session: it is created "pending" before the model is
// called, then becomes "done" with its content or "failed". A failure never
// blocks closing the session.
export type SessionFeedbackStatus = "pending" | "done" | "failed";

// Mirrors the ai module's `session_feedback` output contract, without Zod
// (domain-is-pure).
export interface SessionFeedbackContent {
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly toReinforce: readonly string[];
  readonly nextStepSuggestion: string;
}

export interface SessionFeedback {
  readonly id: string;
  readonly ownerId: string;
  readonly sessionKind: SessionKind;
  readonly sessionId: string;
  readonly status: SessionFeedbackStatus;
  readonly content: SessionFeedbackContent | null;
  // The audited AI attempt behind the content (or the last failed one).
  readonly generationId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewSessionFeedbackInput {
  id: string;
  ownerId: string;
  sessionKind: SessionKind;
  sessionId: string;
  now: Date;
}

export function newSessionFeedback(
  input: NewSessionFeedbackInput,
): SessionFeedback {
  return {
    id: input.id,
    ownerId: input.ownerId,
    sessionKind: input.sessionKind,
    sessionId: input.sessionId,
    status: "pending",
    content: null,
    generationId: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function completeSessionFeedback(
  feedback: SessionFeedback,
  content: SessionFeedbackContent,
  generationId: string,
  now: Date,
): SessionFeedback {
  return { ...feedback, status: "done", content, generationId, updatedAt: now };
}

export function failSessionFeedback(
  feedback: SessionFeedback,
  generationId: string | null,
  now: Date,
): SessionFeedback {
  return {
    ...feedback,
    status: "failed",
    content: null,
    generationId,
    updatedAt: now,
  };
}
