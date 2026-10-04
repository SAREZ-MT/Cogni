import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { AI_ERROR } from "./errors";
import {
  completeGeneration,
  failGeneration,
  startGeneration,
} from "./generation";

const t0 = new Date("2026-10-03T10:00:00Z");
const t1 = new Date("2026-10-03T10:00:02Z");

const input = {
  id: "g1",
  ownerId: "u1",
  pageId: "p1",
  purpose: "generate_flashcards" as const,
  provider: "gemini",
  model: "gemini-3.5-flash-lite",
  promptVersion: "v1",
};

function running() {
  return startGeneration(input, createFixedClock(t0));
}

describe("startGeneration", () => {
  it("creates a running generation with empty usage", () => {
    expect(running()).toEqual({
      ...input,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      status: "running",
      error: null,
      createdAt: t0,
      updatedAt: t0,
    });
  });
});

describe("completeGeneration", () => {
  it("moves running to done with usage and latency", () => {
    const result = completeGeneration(
      running(),
      { inputTokens: 100, outputTokens: 40, latencyMs: 900 },
      createFixedClock(t1),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      status: "done",
      inputTokens: 100,
      outputTokens: 40,
      latencyMs: 900,
      error: null,
      updatedAt: t1,
    });
  });

  it("rejects completing a generation that is already done", () => {
    const done = completeGeneration(
      running(),
      { inputTokens: 1, outputTokens: 1, latencyMs: 1 },
      createFixedClock(t1),
    );
    if (!done.ok) throw new Error("setup");
    const again = completeGeneration(
      done.value,
      { inputTokens: 1, outputTokens: 1, latencyMs: 1 },
      createFixedClock(t1),
    );
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe(AI_ERROR.INVALID_TRANSITION);
  });
});

describe("failGeneration", () => {
  it("moves running to failed recording the error", () => {
    const result = failGeneration(
      running(),
      "schema mismatch",
      createFixedClock(t1),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      status: "failed",
      error: "schema mismatch",
      updatedAt: t1,
    });
  });

  it("rejects failing a generation that is already done", () => {
    const done = completeGeneration(
      running(),
      { inputTokens: 1, outputTokens: 1, latencyMs: 1 },
      createFixedClock(t1),
    );
    if (!done.ok) throw new Error("setup");
    const result = failGeneration(done.value, "late", createFixedClock(t1));
    expect(result.ok).toBe(false);
  });
});
