import { randomUUID } from "node:crypto";
import { afterAll } from "vitest";
import { DrizzleRecallFingerprints } from "@/modules/active-recall/infrastructure";
import { DrizzleExamFingerprints } from "@/modules/exams/infrastructure";
import { DrizzleFlashcardFingerprints } from "@/modules/flashcards/infrastructure";
import { notebooks, pages, profiles } from "@/shared/db/schema";
import type {
  GenerationFingerprintRepository,
  GenerationTechnique,
} from "@/shared/kernel/generation-fingerprints";
import { runGenerationFingerprintsContract } from "@/shared/kernel/testing/generation-fingerprints.contract";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Each technique's module owns its Drizzle adapter over the one
// generation_fingerprints table (Phase 6 T5c); together they must satisfy
// the shared contract, technique isolation included.
const ADAPTERS: Record<
  GenerationTechnique,
  (db: TestDb) => GenerationFingerprintRepository
> = {
  flashcards: (db) => new DrizzleFlashcardFingerprints(db),
  exam: (db) => new DrizzleExamFingerprints(db),
  recall: (db) => new DrizzleRecallFingerprints(db),
};

// Top-level await: the contract builds its `it()` closures at collection
// time, so the fixtures must exist before it is called. Deleting the owners
// cascades to every row created here (cogni-dev is shared).
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("fingerprints-owner");
  const otherOwner = await createTestOwner("fingerprints-other");
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
    title: "Cuaderno del contrato de huellas",
    position: 1,
  });

  runGenerationFingerprintsContract({
    createRepository: (technique) => ADAPTERS[technique](db),
    context: () => ({
      ownerId: owner.id,
      otherOwnerId: otherOwner.id,
      newPageId: async () => {
        const id = randomUUID();
        await db.insert(pages).values({
          id,
          ownerId: owner.id,
          notebookId,
          title: `Página ${id}`,
          content: { type: "doc", content: [] },
          position: nextPagePosition++,
        });
        return id;
      },
    }),
  });
}
