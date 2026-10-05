import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { newFlashcardSession } from "../domain/flashcard-session";
import { computeMastery } from "../domain/mastery";
import { newStudyItem } from "../domain/study-item";
import { runInUnitOfWork } from "./run-in-unit-of-work";
import { InMemoryStudyUnitOfWork } from "./testing/in-memory-study-unit-of-work";

const OWNER = "owner-1";
const NOW = new Date("2026-10-05T09:00:00.000Z");

const item = newStudyItem({
  id: "item-1",
  ownerId: OWNER,
  pageId: "page-1",
  kind: "exam_question",
  sourceId: "root-1",
  now: NOW,
});

const log = {
  id: "log-1",
  ownerId: OWNER,
  itemId: "item-1",
  quality: 1 as const,
  reviewedAt: NOW,
  intervalBefore: 0,
  intervalAfter: 1,
  easinessAfter: 2.3,
  sessionKind: "exam" as const,
  sessionId: "session-1",
};

describe("runInUnitOfWork", () => {
  it("commits the writes of a work that returns ok", async () => {
    const uow = new InMemoryStudyUnitOfWork();

    const result = await runInUnitOfWork(uow, async (repos) => {
      await repos.studyItems.save(item);
      return ok("done");
    });

    expect(result).toEqual(ok("done"));
    expect(await uow.studyItems.findById("item-1", OWNER)).toEqual(item);
  });

  it("rolls back every write of a work that returns err and returns that err", async () => {
    const uow = new InMemoryStudyUnitOfWork();
    const refusal = err(new DomainError("SOME_CODE", "refused late"));

    const result = await runInUnitOfWork(uow, async (repos) => {
      await repos.studyItems.save(item);
      await repos.reviewLogs.append(log);
      return refusal;
    });

    expect(result).toBe(refusal);
    expect(await uow.studyItems.findById("item-1", OWNER)).toBe(null);
    expect(await uow.reviewLogs.listByItem("item-1", OWNER)).toEqual([]);
  });

  it("rethrows a thrown error after rolling back", async () => {
    const uow = new InMemoryStudyUnitOfWork();

    await expect(
      runInUnitOfWork(uow, async (repos) => {
        await repos.studyItems.save(item);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await uow.studyItems.findById("item-1", OWNER)).toBe(null);
  });
});

describe("InMemoryStudyUnitOfWork", () => {
  it("rolls back every repository when the work throws", async () => {
    const uow = new InMemoryStudyUnitOfWork();
    await uow.studyItems.save(item);

    await expect(
      uow.run(async (repos) => {
        await repos.studyItems.save({ ...item, intervalDays: 6 });
        await repos.reviewLogs.append(log);
        await repos.pageMastery.upsert({
          id: "m1",
          ownerId: OWNER,
          pageId: "page-1",
          ...computeMastery([item], NOW),
          computedAt: NOW,
        });
        await repos.sessions.insert(
          newFlashcardSession({
            id: "fs-1",
            ownerId: OWNER,
            pageId: "page-1",
            now: NOW,
          }),
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await uow.studyItems.findById("item-1", OWNER)).toEqual(item);
    expect(await uow.reviewLogs.listByItem("item-1", OWNER)).toEqual([]);
    expect(await uow.pageMastery.getByPage("page-1", OWNER)).toBe(null);
    expect(await uow.sessions.findById("fs-1", OWNER)).toBe(null);
  });
});
