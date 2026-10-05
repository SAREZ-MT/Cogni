import { describe, expect, it } from "vitest";
import {
  completeSessionFeedback,
  failSessionFeedback,
  newSessionFeedback,
  type SessionFeedback,
} from "../../domain/session-feedback";
import type { SessionFeedbackRepository } from "../../domain/session-feedback-repository";

export interface SessionFeedbackRepositoryContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  readonly newId: () => string;
  // Returns the id of a fresh AI generation owned by `ownerId`. Async so
  // the DB runner can insert the real ai_generations row (FK).
  readonly newGenerationId: () => Promise<string>;
}

export interface SessionFeedbackRepositoryContractOptions {
  createRepository(): SessionFeedbackRepository;
  context: () => SessionFeedbackRepositoryContractContext;
}

const T0 = new Date("2026-10-01T08:00:00.000Z");
const T1 = new Date("2026-10-01T08:00:05.000Z");

const CONTENT = {
  summary: "Buena sesión.",
  strengths: ["Recordaste la mitocondria"],
  toReinforce: ["Las fases de la mitosis"],
  nextStepSuggestion: "Repasa la mitosis mañana.",
};

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it.
export function runSessionFeedbackRepositoryContract(
  options: SessionFeedbackRepositoryContractOptions,
): void {
  const pending = (
    ctx: SessionFeedbackRepositoryContractContext,
    sessionId = ctx.newId(),
  ): SessionFeedback =>
    newSessionFeedback({
      id: ctx.newId(),
      ownerId: ctx.ownerId,
      sessionKind: "flashcards",
      sessionId,
      now: T0,
    });

  describe("SessionFeedbackRepository contract", () => {
    it("create then findBySession returns the pending row", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const feedback = pending(ctx);
      expect(await repo.create(feedback)).toBe(true);
      expect(
        await repo.findBySession("flashcards", feedback.sessionId, ctx.ownerId),
      ).toEqual(feedback);
    });

    it("refuses a second row for the same session and keeps the first", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const first = pending(ctx);
      await repo.create(first);
      expect(await repo.create(pending(ctx, first.sessionId))).toBe(false);
      expect(
        await repo.findBySession("flashcards", first.sessionId, ctx.ownerId),
      ).toEqual(first);
    });

    it("returns null for an unknown session or another session kind", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const feedback = pending(ctx);
      await repo.create(feedback);
      expect(
        await repo.findBySession("flashcards", ctx.newId(), ctx.ownerId),
      ).toBeNull();
      expect(
        await repo.findBySession("exam", feedback.sessionId, ctx.ownerId),
      ).toBeNull();
    });

    it("never reveals another owner's row", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const feedback = pending(ctx);
      await repo.create(feedback);
      expect(
        await repo.findBySession(
          "flashcards",
          feedback.sessionId,
          ctx.otherOwnerId,
        ),
      ).toBeNull();
    });

    it("update stores the done content and its generation", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const feedback = pending(ctx);
      await repo.create(feedback);
      const done = completeSessionFeedback(
        feedback,
        CONTENT,
        await ctx.newGenerationId(),
        T1,
      );
      await repo.update(done);
      expect(
        await repo.findBySession("flashcards", feedback.sessionId, ctx.ownerId),
      ).toEqual(done);
    });

    it("update stores a failure without content", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const feedback = pending(ctx);
      await repo.create(feedback);
      const failed = failSessionFeedback(feedback, null, T1);
      await repo.update(failed);
      expect(
        await repo.findBySession("flashcards", feedback.sessionId, ctx.ownerId),
      ).toEqual(failed);
    });

    it("update never touches another owner's row", async () => {
      const ctx = options.context();
      const repo = options.createRepository();
      const feedback = pending(ctx);
      await repo.create(feedback);
      await repo.update({
        ...failSessionFeedback(feedback, null, T1),
        ownerId: ctx.otherOwnerId,
      });
      expect(
        await repo.findBySession("flashcards", feedback.sessionId, ctx.ownerId),
      ).toEqual(feedback);
    });
  });
}
