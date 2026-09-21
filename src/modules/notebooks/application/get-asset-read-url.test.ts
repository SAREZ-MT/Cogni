import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createId } from "@/shared/kernel/id";
import { ASSET_ERROR } from "../domain/errors";
import { getAssetReadUrl } from "./get-asset-read-url";
import { FakeStorageGateway } from "./testing/fake-storage-gateway";
import { InMemoryPageAssetRepository } from "./testing/in-memory-page-asset-repository";

const NOW = new Date("2026-09-21T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const PAGE_ID = "9f7f5cf1-a5f1-4a9e-9d13-0b7c9c9f3d21";

function makeDeps() {
  return {
    assets: new InMemoryPageAssetRepository(),
    storage: new FakeStorageGateway(),
    clock: createFixedClock(NOW),
  };
}

async function seedAsset(deps: ReturnType<typeof makeDeps>, ownerId: string) {
  const asset = {
    id: createId(),
    ownerId,
    pageId: PAGE_ID,
    storagePath: `${ownerId}/${PAGE_ID}/${createId()}.png`,
    mime: "image/png",
    sizeBytes: 1024,
    createdAt: NOW,
    updatedAt: NOW,
  };
  await deps.assets.upsert(asset);
  return asset;
}

// specs/page-assets/spec.md, "URLs de lectura firmadas de corta duración".
describe("getAssetReadUrl use case", () => {
  it("issues a signed read URL for the owner's own asset (Scenario: URL emitida para asset propio)", async () => {
    const deps = makeDeps();
    const asset = await seedAsset(deps, OWNER_ID);

    const result = await getAssetReadUrl({ assetId: asset.id }, deps, OWNER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.url).toContain(asset.storagePath);
  });

  it("rejects reading another user's asset (Scenario: Asset ajeno)", async () => {
    const deps = makeDeps();
    const asset = await seedAsset(deps, OTHER_OWNER_ID);

    const result = await getAssetReadUrl({ assetId: asset.id }, deps, OWNER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ASSET_ERROR.FORBIDDEN);
  });

  it("rejects an unknown assetId", async () => {
    const deps = makeDeps();

    const result = await getAssetReadUrl(
      { assetId: createId() },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ASSET_ERROR.FORBIDDEN);
  });
});
