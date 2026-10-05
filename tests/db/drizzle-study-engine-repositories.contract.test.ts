import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll } from "vitest";
import { runFlashcardSessionRepositoryContract } from "@/modules/study-engine/application/testing/flashcard-session-repository.contract";
import { runPageMasteryRepositoryContract } from "@/modules/study-engine/application/testing/page-mastery-repository.contract";
import { runReviewLogRepositoryContract } from "@/modules/study-engine/application/testing/review-log-repository.contract";
import { runSessionFeedbackRepositoryContract } from "@/modules/study-engine/application/testing/session-feedback-repository.contract";
import { runStudyItemRepositoryContract } from "@/modules/study-engine/application/testing/study-item-repository.contract";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import { DrizzleFlashcardSessionRepository } from "@/modules/study-engine/infrastructure/drizzle-flashcard-session-repository";
import { DrizzlePageMasteryRepository } from "@/modules/study-engine/infrastructure/drizzle-page-mastery-repository";
import { DrizzleReviewLogRepository } from "@/modules/study-engine/infrastructure/drizzle-review-log-repository";
import { DrizzleSessionFeedbackRepository } from "@/modules/study-engine/infrastructure/drizzle-session-feedback-repository";
import { DrizzleStudyItemRepository } from "@/modules/study-engine/infrastructure/drizzle-study-item-repository";
import { aiGenerations, notebooks, pages, profiles } from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Top-level await: the contracts build their `it()` closures at collection
// time, so the fixtures must exist before they are called. Deleting the
// owners cascades to every study item, log and mastery row created here.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("study-engine-owner");
  const otherOwner = await createTestOwner("study-engine-other");
  const notebookId = randomUUID();
  let nextPagePosition = 1;

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
      await deleteTestOwner(otherOwner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values([{ id: owner.id }, { id: otherOwner.id }]);
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno del contrato del motor de estudio",
    position: 1,
  });

  async function newPage(inNotebook: string = notebookId): Promise<string> {
    const id = randomUUID();
    await db.insert(pages).values({
      id,
      ownerId: owner.id,
      notebookId: inNotebook,
      title: `Página ${id}`,
      content: { type: "doc", content: [] },
      position: nextPagePosition++,
    });
    return id;
  }

  const ownership = {
    ownerId: owner.id,
    otherOwnerId: otherOwner.id,
    newId: () => randomUUID(),
  };

  runStudyItemRepositoryContract({
    createRepository: () => new DrizzleStudyItemRepository(db),
    context: () => ({
      ...ownership,
      newPageId: () => newPage(),
      archivePage: async (pageId) => {
        await db
          .update(pages)
          .set({ archivedAt: new Date() })
          .where(eq(pages.id, pageId));
      },
      newPageInArchivedNotebook: async () => {
        const archivedNotebookId = randomUUID();
        await db.insert(notebooks).values({
          id: archivedNotebookId,
          ownerId: owner.id,
          title: "Cuaderno archivado del contrato",
          position: 2,
          archivedAt: new Date(),
        });
        return newPage(archivedNotebookId);
      },
    }),
  });

  runReviewLogRepositoryContract({
    createRepository: () => new DrizzleReviewLogRepository(db),
    context: () => ({
      ...ownership,
      newItemId: async () => {
        const item = newStudyItem({
          id: randomUUID(),
          ownerId: owner.id,
          pageId: await newPage(),
          kind: "flashcard",
          sourceId: randomUUID(),
          now: new Date("2026-10-01T08:00:00.000Z"),
        });
        await new DrizzleStudyItemRepository(db).save(item);
        return item.id;
      },
    }),
  });

  runPageMasteryRepositoryContract({
    createRepository: () => new DrizzlePageMasteryRepository(db),
    context: () => ({ ...ownership, newPageId: newPage }),
  });

  runFlashcardSessionRepositoryContract({
    createRepository: () => new DrizzleFlashcardSessionRepository(db),
    context: () => ({ ...ownership, newPageId: newPage }),
  });

  runSessionFeedbackRepositoryContract({
    createRepository: () => new DrizzleSessionFeedbackRepository(db),
    context: () => ({
      ...ownership,
      newGenerationId: async () => {
        const id = randomUUID();
        await db.insert(aiGenerations).values({
          id,
          ownerId: owner.id,
          pageId: null,
          purpose: "session_feedback",
          provider: "fake",
          model: "fake-model",
          promptVersion: "session_feedback/v1",
          status: "done",
        });
        return id;
      },
    }),
  });
}
