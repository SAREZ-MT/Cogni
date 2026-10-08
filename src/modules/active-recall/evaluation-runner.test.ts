import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EvaluateRecallSessionDeps } from "./application";

// The runner's contract: it schedules the evaluation with `after()` and
// never lets a failure escape. The composition (buildEvaluationDeps) is
// proven end to end by tests/e2e/active-recall-evaluation.spec.ts.
const { after, pending } = vi.hoisted(() => {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    after: vi.fn((callback: () => Promise<unknown>) => {
      pending.push(callback());
    }),
  };
});
vi.mock("next/server", () => ({ after }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/shared/config/env.server", () => ({ serverEnv: () => ({}) }));
vi.mock("@/modules/notebooks", () => ({ createNotebooksServerApi: vi.fn() }));

const { scheduleRecallEvaluation } = await import("./evaluation-runner");

function depsWith(
  findById: EvaluateRecallSessionDeps["sessions"]["findById"],
): () => EvaluateRecallSessionDeps {
  return () =>
    ({
      sessions: { findById, setEvaluationStatus: vi.fn() },
    }) as unknown as EvaluateRecallSessionDeps;
}

describe("scheduleRecallEvaluation", () => {
  beforeEach(() => {
    after.mockClear();
    captureException.mockClear();
    pending.length = 0;
  });

  it("runs the evaluation after the response, not before", async () => {
    const findById = vi.fn(async () => null);
    scheduleRecallEvaluation("session-1", "owner-1", depsWith(findById));

    expect(after).toHaveBeenCalledOnce();
    await Promise.all(pending);
    expect(findById).toHaveBeenCalledWith("session-1", "owner-1");
  });

  it("reports a refused evaluation to Sentry", async () => {
    scheduleRecallEvaluation(
      "session-ghost",
      "owner-1",
      depsWith(async () => null),
    );
    await Promise.all(pending);

    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ code: "RECALL_SESSION_NOT_FOUND" }),
    );
  });

  it("reports a thrown failure instead of letting it escape", async () => {
    const boom = new Error("db down");
    scheduleRecallEvaluation(
      "session-1",
      "owner-1",
      depsWith(async () => {
        throw boom;
      }),
    );
    await expect(Promise.all(pending)).resolves.toBeDefined();

    expect(captureException).toHaveBeenCalledWith(boom);
  });
});
