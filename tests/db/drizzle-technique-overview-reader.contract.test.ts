import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll } from "vitest";
import {
  runTechniqueOverviewReaderContract,
  type TechniqueOverviewReaderContractContext,
} from "@/modules/scheduling/application/testing/technique-overview-reader.contract";
import type { DueKind } from "@/modules/scheduling/domain/due-today";
import { REVIEW_SESSION_KIND } from "@/modules/scheduling/domain/technique-overview";
import { DrizzleTechniqueOverviewReader } from "@/modules/scheduling/infrastructure/drizzle-technique-overview-reader";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import { DrizzleStudyItemRepository } from "@/modules/study-engine/infrastructure/drizzle-study-item-repository";
import {
  examSessions,
  notebooks,
  pages,
  profiles,
  reviewLogs,
} from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import {
  createTestOwner,
  deleteTestOwner,
  type TestOwner,
} from "./helpers/test-owner";

// The overview counts every item an owner has, so unlike the page-scoped
// due readers each contract test needs owners of its own: a pool of owner
// pairs is created up front (the contract builds its `it()` closures at
// collection time) and each context() call takes the next pair. Deleting
// the owners cascades to every notebook, page, study item and review log
// created here.
const CONTRACT_TESTS = 11;

if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const pairs: [TestOwner, TestOwner][] = [];
  for (let index = 0; index < CONTRACT_TESTS; index++) {
    pairs.push([
      await createTestOwner(`overview-owner-${index}`),
      await createTestOwner(`overview-other-${index}`),
    ]);
  }
  const owners = pairs.flat();
  const pageOwners = new Map<string, string>();
  let nextPair = 0;
  let nextPosition = 1;

  afterAll(async () => {
    try {
      for (const owner of owners) await deleteTestOwner(owner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values(owners.map((owner) => ({ id: owner.id })));

  const addItem = async (
    page: { pageId: string },
    input: { kind?: DueKind; dueAt: Date; suspended?: boolean },
  ): Promise<{ itemId: string; ownerId: string }> => {
    const ownerId = pageOwners.get(page.pageId);
    if (!ownerId) throw new Error("unknown contract page");
    const item = newStudyItem({
      id: randomUUID(),
      ownerId,
      pageId: page.pageId,
      kind: input.kind ?? "flashcard",
      sourceId: randomUUID(),
      now: input.dueAt,
    });
    await new DrizzleStudyItemRepository(db).save({
      ...item,
      dueAt: input.dueAt,
      suspendedAt: input.suspended ? input.dueAt : null,
    });
    return { itemId: item.id, ownerId };
  };

  const context = (): TechniqueOverviewReaderContractContext => {
    const pair = pairs[nextPair++];
    if (!pair) throw new Error("add owners: the contract grew past the pool");
    const [owner, otherOwner] = pair;
    return {
      ownerId: owner.id,
      otherOwnerId: otherOwner.id,
      newPage: async (ownerId = owner.id) => {
        const fixture = {
          pageId: randomUUID(),
          pageTitle: `Página ${randomUUID().slice(0, 8)}`,
          notebookId: randomUUID(),
          notebookTitle: "Cuaderno del contrato del resumen por técnica",
          notebookColor: "green",
        };
        await db.insert(notebooks).values({
          id: fixture.notebookId,
          ownerId,
          title: fixture.notebookTitle,
          color: fixture.notebookColor,
          position: nextPosition++,
        });
        await db.insert(pages).values({
          id: fixture.pageId,
          ownerId,
          notebookId: fixture.notebookId,
          title: fixture.pageTitle,
          content: { type: "doc", content: [] },
          position: 1,
        });
        pageOwners.set(fixture.pageId, ownerId);
        return fixture;
      },
      addItem: async (page, input) => {
        await addItem(page, input);
      },
      addReviewedItem: async (page, input) => {
        const kind = input.kind ?? "flashcard";
        const { itemId, ownerId } = await addItem(page, {
          kind,
          dueAt: input.dueAt,
        });
        await db.insert(reviewLogs).values({
          id: randomUUID(),
          ownerId,
          itemId,
          quality: 4,
          reviewedAt: input.reviewedAt,
          intervalBefore: 0,
          intervalAfter: 1,
          easinessAfter: 2.5,
          sessionKind: REVIEW_SESSION_KIND[kind],
          sessionId: randomUUID(),
        });
      },
      addExamSession: async (page, finishedAt) => {
        const ownerId = pageOwners.get(page.pageId) ?? owner.id;
        const done = finishedAt !== null;
        await db.insert(examSessions).values({
          id: randomUUID(),
          ownerId,
          pageId: page.pageId,
          requestedCount: 10,
          questionIds: [randomUUID()],
          startedAt: finishedAt ?? new Date(),
          finishedAt,
          total: done ? 1 : null,
          correct: done ? 1 : null,
          score: done ? 1 : null,
          passed: done ? true : null,
        });
      },
      archivePage: async (page) => {
        await db
          .update(pages)
          .set({ archivedAt: new Date() })
          .where(eq(pages.id, page.pageId));
      },
      archiveNotebook: async (page) => {
        await db
          .update(notebooks)
          .set({ archivedAt: new Date() })
          .where(eq(notebooks.id, page.notebookId));
      },
    };
  };

  runTechniqueOverviewReaderContract({
    createReader: () => new DrizzleTechniqueOverviewReader(db),
    context,
  });
}
