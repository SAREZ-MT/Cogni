import { describe, expect, it } from "vitest";
import { decideFeedback, type PreviousExamSession } from "./feedback-policy";

const at = (day: number) => new Date(Date.UTC(2026, 9, day, 10));

function session(
  sessionId: string,
  overrides: Partial<PreviousExamSession> = {},
): PreviousExamSession {
  return {
    sessionId,
    passed: true,
    finishedAt: at(1),
    feedbackId: `fb-${sessionId}`,
    ...overrides,
  };
}

describe("decideFeedback", () => {
  it("generates new feedback for a failed attempt, even after a pass", () => {
    expect(
      decideFeedback({
        attemptPassed: false,
        previousSessions: [session("s-1")],
      }),
    ).toEqual({ kind: "generate" });
  });

  it("generates new feedback for the first passing attempt", () => {
    expect(
      decideFeedback({
        attemptPassed: true,
        previousSessions: [session("s-1", { passed: false })],
      }),
    ).toEqual({ kind: "generate" });
  });

  it("generates new feedback for a pass with no history", () => {
    expect(
      decideFeedback({ attemptPassed: true, previousSessions: [] }),
    ).toEqual({ kind: "generate" });
  });

  it("reuses the feedback of the most recent earlier pass", () => {
    expect(
      decideFeedback({
        attemptPassed: true,
        previousSessions: [
          session("s-1", { finishedAt: at(1) }),
          session("s-3", { finishedAt: at(3) }),
          session("s-4", { finishedAt: at(4), passed: false }),
          session("s-2", { finishedAt: at(2) }),
        ],
      }),
    ).toEqual({ kind: "reuse", sessionId: "s-3", feedbackId: "fb-s-3" });
  });

  it("ignores sessions that never finished", () => {
    expect(
      decideFeedback({
        attemptPassed: true,
        previousSessions: [
          session("s-1", { finishedAt: at(1) }),
          session("s-open", { finishedAt: null, passed: null }),
        ],
      }),
    ).toEqual({ kind: "reuse", sessionId: "s-1", feedbackId: "fb-s-1" });
  });

  it("breaks a tie on finishedAt by the larger session id", () => {
    expect(
      decideFeedback({
        attemptPassed: true,
        previousSessions: [session("s-a"), session("s-b")],
      }),
    ).toEqual({ kind: "reuse", sessionId: "s-b", feedbackId: "fb-s-b" });
  });

  it("generates when the most recent earlier pass has no stored feedback", () => {
    // Its feedback generation failed or never ran: there is nothing to reuse,
    // and an older pass's feedback would describe stale weaknesses.
    expect(
      decideFeedback({
        attemptPassed: true,
        previousSessions: [
          session("s-1", { finishedAt: at(1) }),
          session("s-2", { finishedAt: at(2), feedbackId: null }),
        ],
      }),
    ).toEqual({ kind: "generate" });
  });
});
