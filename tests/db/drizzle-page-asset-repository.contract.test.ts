import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNotebook } from "@/modules/notebooks/domain/notebook";
import { createPage } from "@/modules/notebooks/domain/page";
import type { PageAsset } from "@/modules/notebooks/domain/page-asset-repository";
// Concrete files, not the infrastructure barrel (it re-exports the
// "server-only" SupabaseStorageGateway; see notebooks-repository.smoke).
import { DrizzleNotebookRepository } from "@/modules/notebooks/infrastructure/drizzle-notebook-repository";
import { DrizzlePageAssetRepository } from "@/modules/notebooks/infrastructure/drizzle-page-asset-repository";
import { DrizzlePageRepository } from "@/modules/notebooks/infrastructure/drizzle-page-repository";
import { profiles } from "@/shared/db/schema";
import { systemClock } from "@/shared/kernel/clock";
import { createTestDb } from "./helpers/test-db";
import {
  createTestOwner,
  deleteTestOwner,
  type TestOwner,
} from "./helpers/test-owner";

// document-import T9: deleteByIds backs deleteImportedAssets, the cleanup
// the importer runs when writing the imported content fails after its
// images were already stored. It must only ever delete the caller's rows.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("DrizzlePageAssetRepository", () => {
  let ownerA: TestOwner;
  let ownerB: TestOwner;
  const db = createTestDb();
  const notebookRepo = new DrizzleNotebookRepository(db);
  const pageRepo = new DrizzlePageRepository(db);
  const assetRepo = new DrizzlePageAssetRepository(db);

  async function seedPage(ownerId: string): Promise<string> {
    const notebook = createNotebook(
      {
        id: randomUUID(),
        ownerId,
        title: "Cuaderno",
        position: await notebookRepo.nextPosition(ownerId),
      },
      systemClock,
    );
    if (!notebook.ok) throw new Error("setup failed");
    await notebookRepo.create(notebook.value);
    const page = createPage(
      {
        id: randomUUID(),
        ownerId,
        notebookId: notebook.value.id,
        position: await pageRepo.nextPosition(notebook.value.id),
      },
      systemClock,
    );
    if (!page.ok) throw new Error("setup failed");
    await pageRepo.create(page.value);
    return page.value.id;
  }

  async function seedAsset(ownerId: string, pageId: string) {
    const now = new Date();
    const asset: PageAsset = {
      id: randomUUID(),
      ownerId,
      pageId,
      storagePath: `${ownerId}/${pageId}/${randomUUID()}.png`,
      mime: "image/png",
      sizeBytes: 10,
      createdAt: now,
      updatedAt: now,
    };
    await assetRepo.upsert(asset);
    return asset;
  }

  beforeAll(async () => {
    ownerA = await createTestOwner("page-asset-repo-a");
    ownerB = await createTestOwner("page-asset-repo-b");
    await db.insert(profiles).values([{ id: ownerA.id }, { id: ownerB.id }]);
  });

  afterAll(async () => {
    await deleteTestOwner(ownerA.id);
    await deleteTestOwner(ownerB.id);
  });

  it("deleteByIds deletes only the owner's rows and returns them", async () => {
    const pageA = await seedPage(ownerA.id);
    const pageB = await seedPage(ownerB.id);
    const first = await seedAsset(ownerA.id, pageA);
    const second = await seedAsset(ownerA.id, pageA);
    const foreign = await seedAsset(ownerB.id, pageB);

    const deleted = await assetRepo.deleteByIds(ownerA.id, [
      first.id,
      foreign.id,
    ]);

    expect(deleted.map((asset) => asset.storagePath)).toEqual([
      first.storagePath,
    ]);
    expect(await assetRepo.findById(first.id)).toBeNull();
    expect(await assetRepo.findById(second.id)).not.toBeNull();
    expect(await assetRepo.findById(foreign.id)).not.toBeNull();
  });

  it("deleteByIds with no ids deletes nothing", async () => {
    expect(await assetRepo.deleteByIds(ownerA.id, [])).toEqual([]);
  });
});
