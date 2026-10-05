import { randomUUID } from "node:crypto";
import { afterAll } from "vitest";
import { runStudiedPageReaderContract } from "@/modules/study-engine/application/testing/studied-page-reader.contract";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import { DrizzleStudiedPageReader } from "@/modules/study-engine/infrastructure/drizzle-studied-page-reader";
import { DrizzleStudyItemRepository } from "@/modules/study-engine/infrastructure/drizzle-study-item-repository";
import { notebooks, pages, profiles } from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Top-level await: the contract builds its `it()` closures at collection
// time, so the fixtures must exist before it is called. Deleting the owners
// cascades to every notebook, page and study item created here.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("studied-pages-owner");
  const otherOwner = await createTestOwner("studied-pages-other");
  const notebookByOwner = new Map<string, string>();
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
  for (const ownerId of [owner.id, otherOwner.id]) {
    const notebookId = randomUUID();
    await db.insert(notebooks).values({
      id: notebookId,
      ownerId,
      title: "Cuaderno del contrato de páginas estudiadas",
      position: 1,
    });
    notebookByOwner.set(ownerId, notebookId);
  }

  runStudiedPageReaderContract({
    context: async () => ({
      ownerId: owner.id,
      otherOwnerId: otherOwner.id,
      reader: new DrizzleStudiedPageReader(db),
      newPageId: async (ownerId) => {
        const id = randomUUID();
        await db.insert(pages).values({
          id,
          ownerId,
          notebookId: notebookByOwner.get(ownerId) ?? "",
          title: `Página ${id}`,
          content: { type: "doc", content: [] },
          position: nextPosition++,
        });
        return id;
      },
      addItem: async ({ ownerId, pageId, suspended }) => {
        const now = new Date("2026-10-01T08:00:00.000Z");
        const item = newStudyItem({
          id: randomUUID(),
          ownerId,
          pageId,
          kind: "flashcard",
          sourceId: randomUUID(),
          now,
        });
        await new DrizzleStudyItemRepository(db).save({
          ...item,
          suspendedAt: suspended ? now : null,
        });
      },
    }),
  });
}
