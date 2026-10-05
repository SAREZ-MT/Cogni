import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { STUDY_ENGINE_ERROR } from "../domain/errors";
import { newFlashcardSession } from "../domain/flashcard-session";
import { finishFlashcardSession } from "./finish-flashcard-session";
import { InMemoryFlashcardSessionRepository } from "./testing/in-memory-flashcard-session-repository";

const OWNER = "owner-1";
const STARTED = new Date("2026-10-04T09:00:00.000Z");
const NOW = new Date("2026-10-04T09:12:00.000Z");

async function setup() {
  const sessions = new InMemoryFlashcardSessionRepository();
  await sessions.insert(
    newFlashcardSession({
      id: "s1",
      ownerId: OWNER,
      pageId: "p1",
      now: STARTED,
    }),
  );
  await sessions.recordGrade("s1", OWNER, true);
  await sessions.recordGrade("s1", OWNER, false);
  return { sessions, deps: { sessions, clock: createFixedClock(NOW) } };
}

describe("finishFlashcardSession", () => {
  it("closes the session and returns its counts", async () => {
    const { deps } = await setup();

    const result = await finishFlashcardSession(
      { sessionId: "s1" },
      deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value).toEqual({
      id: "s1",
      ownerId: OWNER,
      pageId: "p1",
      startedAt: STARTED,
      finishedAt: NOW,
      reviewedCount: 2,
      againCount: 1,
    });
  });

  it("is idempotent: finishing twice keeps the first finishedAt", async () => {
    const { deps, sessions } = await setup();
    await finishFlashcardSession({ sessionId: "s1" }, deps, OWNER);

    const later = {
      sessions,
      clock: createFixedClock(new Date(NOW.getTime() + 60_000)),
    };
    const result = await finishFlashcardSession(
      { sessionId: "s1" },
      later,
      OWNER,
    );

    expect(result.ok && result.value.finishedAt).toEqual(NOW);
  });

  it("refuses an unknown or another owner's session", async () => {
    const { deps, sessions } = await setup();

    const unknown = await finishFlashcardSession(
      { sessionId: "nope" },
      deps,
      OWNER,
    );
    const foreign = await finishFlashcardSession(
      { sessionId: "s1" },
      deps,
      "owner-2",
    );

    expect(!unknown.ok && unknown.error.code).toBe(
      STUDY_ENGINE_ERROR.SESSION_NOT_FOUND,
    );
    expect(!foreign.ok && foreign.error.code).toBe(
      STUDY_ENGINE_ERROR.SESSION_NOT_FOUND,
    );
    expect((await sessions.findById("s1", OWNER))?.finishedAt).toBe(null);
  });
});
