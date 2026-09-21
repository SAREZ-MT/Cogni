import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// Imported from its concrete file, not the barrel: see
// notebooks-repository.smoke.test.ts's comment on why (SupabaseStorage
// Gateway's `import "server-only"` breaks plain Node module resolution).
import { DrizzlePageRepository } from "@/modules/notebooks/infrastructure/drizzle-page-repository";
import { notebooks, pages, profiles } from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import {
  createTestOwner,
  deleteTestOwner,
  type TestOwner,
} from "./helpers/test-owner";

// Scenario "Dos escrituras concurrentes con la misma versión"
// (specs/notebooks/spec.md): two concurrent writers racing on the same
// expectedVersion MUST result in exactly one of them updating the row.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("SavePage concurrency (updateIfVersion race)", () => {
  let owner: TestOwner;
  const db = createTestDb();
  const repo = new DrizzlePageRepository(db);
  const notebookId = randomUUID();
  const pageId = randomUUID();

  beforeAll(async () => {
    owner = await createTestOwner("save-page-race");
    await db.insert(profiles).values({ id: owner.id });
    await db.insert(notebooks).values({
      id: notebookId,
      ownerId: owner.id,
      title: "Carrera",
      position: 1,
    });
    await db.insert(pages).values({
      id: pageId,
      ownerId: owner.id,
      notebookId,
      title: "Sin título",
      content: { type: "doc", content: [] },
      plainText: "",
      contentVersion: 1,
      position: 1,
    });
  });

  afterAll(async () => {
    await deleteTestOwner(owner.id);
  });

  it("lets exactly one of two concurrent writers with the same expectedVersion update", async () => {
    const [first, second] = await Promise.all([
      repo.updateIfVersion({
        pageId,
        ownerId: owner.id,
        expectedVersion: 1,
        content: { type: "doc", content: [{ type: "text", text: "writer A" }] },
        plainText: "writer A",
        updatedAt: new Date(),
      }),
      repo.updateIfVersion({
        pageId,
        ownerId: owner.id,
        expectedVersion: 1,
        content: { type: "doc", content: [{ type: "text", text: "writer B" }] },
        plainText: "writer B",
        updatedAt: new Date(),
      }),
    ]);

    const results = [first, second];
    const updatedCount = results.filter((r) => r.updated).length;
    expect(updatedCount).toBe(1);

    const stored = await repo.findById(pageId);
    expect(stored?.contentVersion).toBe(2);
    expect(["writer A", "writer B"]).toContain(stored?.plainText);
  });
});
