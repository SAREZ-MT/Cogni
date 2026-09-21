import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach } from "vitest";
import { runPageRepositoryContract } from "@/modules/notebooks/application/testing/page-repository.contract";
import { DrizzlePageRepository } from "@/modules/notebooks/infrastructure";
import { notebooks, pages, profiles } from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Same shared contract used against the in-memory double in phase 1
// (application/testing/in-memory-page-repository.contract.test.ts), run
// here against real Postgres so DrizzlePageRepository.updateIfVersion is
// proven to be the same atomic compare-and-swap (design.md).
//
// Top-level await (this file is ESM) creates the owner/notebook fixtures
// before `runPageRepositoryContract` registers its `describe`/`it` blocks:
// a `beforeAll` would run too late, since the contract function reads
// `ids.ownerId` while building each test's `it()` closures at collection
// time, not inside a hook.
const url = process.env.DATABASE_URL;

if (url) {
  const db = createTestDb();
  const owner = await createTestOwner("page-contract-owner");
  const otherOwner = await createTestOwner("page-contract-other");
  const notebookId = randomUUID();
  const pageId = randomUUID();

  await db.insert(profiles).values([{ id: owner.id }, { id: otherOwner.id }]);
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno del contrato",
    position: 1,
  });

  afterEach(async () => {
    await db.delete(pages).where(eq(pages.id, pageId));
  });

  afterAll(async () => {
    await deleteTestOwner(owner.id);
    await deleteTestOwner(otherOwner.id);
  });

  runPageRepositoryContract(() => new DrizzlePageRepository(db), {
    pageId,
    ownerId: owner.id,
    otherOwnerId: otherOwner.id,
    notebookId,
  });
}
