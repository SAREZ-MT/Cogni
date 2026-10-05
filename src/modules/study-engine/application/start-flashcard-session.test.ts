import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { STUDY_ENGINE_ERROR } from "../domain/errors";
import { newStudyItem, type StudyItem } from "../domain/study-item";
import { startFlashcardSession } from "./start-flashcard-session";
import { InMemoryFlashcardSessionRepository } from "./testing/in-memory-flashcard-session-repository";
import { InMemoryStudyItemRepository } from "./testing/in-memory-study-item-repository";

const OWNER = "owner-1";
const NOW = new Date("2026-10-04T09:00:00.000Z");
const HOUR_MS = 3_600_000;

function sequentialIds(prefix = "id") {
  let n = 0;
  return { next: () => `${prefix}-${++n}` };
}

function item(
  id: string,
  overrides: Partial<StudyItem> & { pageId?: string } = {},
): StudyItem {
  return {
    ...newStudyItem({
      id,
      ownerId: OWNER,
      pageId: overrides.pageId ?? "page-1",
      kind: "flashcard",
      sourceId: `card-${id}`,
      now: new Date(NOW.getTime() - 2 * HOUR_MS),
    }),
    ...overrides,
  };
}

function setup(pageExists = true) {
  const studyItems = new InMemoryStudyItemRepository();
  const sessions = new InMemoryFlashcardSessionRepository();
  const pagesRead: string[] = [];
  const deps = {
    pages: {
      async getPageText(pageId: string) {
        pagesRead.push(pageId);
        return pageExists
          ? ok({ title: "t", plainText: "" })
          : err(new DomainError("PAGE_NOT_FOUND", pageId));
      },
    },
    studyItems,
    sessions,
    clock: createFixedClock(NOW),
    ids: sequentialIds("session"),
  };
  return { deps, studyItems, sessions, pagesRead };
}

describe("startFlashcardSession", () => {
  it("opens a page session with the page's due flashcards, oldest due first", async () => {
    const { deps, studyItems, sessions } = setup();
    await studyItems.save(
      item("b", { dueAt: new Date(NOW.getTime() - HOUR_MS) }),
    );
    await studyItems.save(
      item("a", { dueAt: new Date(NOW.getTime() - 2 * HOUR_MS) }),
    );
    // Not due yet, another page, suspended: all left out.
    await studyItems.save(
      item("later", { dueAt: new Date(NOW.getTime() + HOUR_MS) }),
    );
    await studyItems.save(item("other-page", { pageId: "page-2" }));
    await studyItems.save(item("suspended", { suspendedAt: NOW }));

    const result = await startFlashcardSession(
      { pageId: "page-1" },
      deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((due) => due.itemId)).toEqual(["a", "b"]);
    expect(result.value.items[0]).toMatchObject({
      itemId: "a",
      flashcardId: "card-a",
      pageId: "page-1",
    });
    expect(result.value.session).toEqual({
      id: "session-1",
      ownerId: OWNER,
      pageId: "page-1",
      startedAt: NOW,
      finishedAt: null,
      reviewedCount: 0,
      againCount: 0,
    });
    expect(await sessions.findById("session-1", OWNER)).toEqual(
      result.value.session,
    );
  });

  it("previews the next interval of each button with SM-2", async () => {
    const { deps, studyItems } = setup();
    // Second review of a card: Otra vez resets to 1, the rest give 6 days.
    await studyItems.save(
      item("a", { repetitions: 1, intervalDays: 1, dueAt: NOW }),
    );
    await studyItems.save(item("new"));

    const result = await startFlashcardSession(
      { pageId: "page-1" },
      deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    const byId = new Map(result.value.items.map((due) => [due.itemId, due]));
    expect(byId.get("new")?.nextIntervalDays).toEqual({
      again: 1,
      hard: 1,
      good: 1,
      easy: 1,
    });
    expect(byId.get("a")?.nextIntervalDays).toEqual({
      again: 1,
      hard: 6,
      good: 6,
      easy: 6,
    });
  });

  it("spans every page of the owner without a pageId and skips the page check", async () => {
    const { deps, studyItems, pagesRead } = setup();
    await studyItems.save(item("a", { pageId: "page-1" }));
    await studyItems.save(item("b", { pageId: "page-2" }));
    await studyItems.save({ ...item("mine-not"), ownerId: "owner-2" });

    const result = await startFlashcardSession({}, deps, OWNER);

    if (!result.ok) throw result.error;
    expect(result.value.session.pageId).toBe(null);
    expect(result.value.items.map((due) => due.itemId).sort()).toEqual([
      "a",
      "b",
    ]);
    expect(pagesRead).toEqual([]);
  });

  it("only schedules flashcards: other techniques' items stay out", async () => {
    const { deps, studyItems } = setup();
    await studyItems.save(item("exam", { kind: "exam_question" }));
    await studyItems.save(item("card"));

    const result = await startFlashcardSession(
      { pageId: "page-1" },
      deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(result.value.items.map((due) => due.itemId)).toEqual(["card"]);
  });

  it("refuses a page that is missing, archived or another owner's, writing nothing", async () => {
    const { deps, studyItems, sessions } = setup(false);
    await studyItems.save(item("a"));

    const result = await startFlashcardSession(
      { pageId: "page-1" },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
    expect(await sessions.findById("session-1", OWNER)).toBe(null);
  });

  it("answers NOTHING_DUE without opening a session when no card is due", async () => {
    const { deps, studyItems, sessions } = setup();
    await studyItems.save(
      item("later", { dueAt: new Date(NOW.getTime() + HOUR_MS) }),
    );

    const result = await startFlashcardSession(
      { pageId: "page-1" },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.NOTHING_DUE,
    );
    expect(await sessions.findById("session-1", OWNER)).toBe(null);
  });
});
