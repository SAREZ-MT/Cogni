import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll } from "vitest";
import { runDueTodayReaderContract } from "@/modules/scheduling/application/testing/due-today-reader.contract";
import { DrizzleDueTodayReader } from "@/modules/scheduling/infrastructure/drizzle-due-today-reader";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import { DrizzleStudyItemRepository } from "@/modules/study-engine/infrastructure/drizzle-study-item-repository";
import { examSessions, notebooks, pages, profiles } from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Top-level await: the contract builds its `it()` closures at collection
// time, so the fixtures must exist before it is called. Deleting the owners
// cascades to every notebook, page, study item and exam session created
// here.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("due-today-owner");
  const otherOwner = await createTestOwner("due-today-other");
  const pageOwners = new Map<string, string>();
  let nextPosition = 1;

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
      await deleteTestOwner(otherOwner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values([{ id: owner.id }, { id: otherOwner.id }]);

  runDueTodayReaderContract({
    createReader: () => new DrizzleDueTodayReader(db),
    context: () => ({
      ownerId: owner.id,
      otherOwnerId: otherOwner.id,
      newPage: async (ownerId = owner.id) => {
        const fixture = {
          pageId: randomUUID(),
          pageTitle: `Página ${randomUUID().slice(0, 8)}`,
          notebookId: randomUUID(),
          notebookTitle: "Cuaderno del contrato de Repasos de hoy",
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
        const ownerId = pageOwners.get(page.pageId) ?? owner.id;
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
    }),
  });
}
