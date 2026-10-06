import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll } from "vitest";
import { runExamHubReaderContract } from "@/modules/exams/application/testing/exam-hub-reader.contract";
import {
  createDrizzleExamRepositories,
  DrizzleExamHubReader,
} from "@/modules/exams/infrastructure";
import { aiGenerations, notebooks, pages, profiles } from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Top-level await: the contract builds its `it()` closures at collection
// time, so the fixtures must exist before it is called. Deleting the owners
// cascades to every notebook, page and exam row created here.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("exam-hub-owner");
  const otherOwner = await createTestOwner("exam-hub-other");
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

  runExamHubReaderContract({
    createFixture: () => ({
      reader: new DrizzleExamHubReader(db),
      repositories: createDrizzleExamRepositories(db),
    }),
    context: () => ({
      ownerId: owner.id,
      otherOwnerId: otherOwner.id,
      newId: () => randomUUID(),
      newPage: async (input = {}) => {
        const ownerId = input.ownerId ?? owner.id;
        const fixture = {
          pageId: randomUUID(),
          pageTitle: input.pageTitle ?? `Página ${randomUUID().slice(0, 8)}`,
          notebookId: randomUUID(),
          notebookTitle: input.notebookTitle ?? "Cuaderno del hub de exámenes",
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
        return fixture;
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
      newGenerationId: async () => {
        const id = randomUUID();
        await db.insert(aiGenerations).values({
          id,
          ownerId: owner.id,
          pageId: null,
          purpose: "generate_exam_variants",
          provider: "fake",
          model: "fake-model",
          promptVersion: "generate_exam_variants/v1",
          status: "done",
        });
        return id;
      },
    }),
  });
}
