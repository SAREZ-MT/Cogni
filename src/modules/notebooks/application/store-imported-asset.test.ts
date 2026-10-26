import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { ASSET_ERROR, PAGE_ERROR } from "../domain/errors";
import { isCanonicalStoragePath, MAX_ASSET_BYTES } from "../domain/page-asset";
import { archivePage } from "./archive-page";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { deleteImportedAssets } from "./delete-imported-assets";
import { storeImportedAsset } from "./store-imported-asset";
import { FakeStorageGateway } from "./testing/fake-storage-gateway";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageAssetRepository } from "./testing/in-memory-page-asset-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

const NOW = new Date("2026-10-26T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

function makeDeps() {
  return {
    notebooks: new InMemoryNotebookRepository(),
    pages: new InMemoryPageRepository(),
    assets: new InMemoryPageAssetRepository(),
    storage: new FakeStorageGateway(),
    clock: createFixedClock(NOW),
  };
}

async function setupPage(deps: ReturnType<typeof makeDeps>) {
  const notebook = await createNotebook({ title: "Calculo I" }, deps, OWNER_ID);
  if (!notebook.ok) throw new Error("setup failed");
  const page = await createPage(
    { notebookId: notebook.value.id },
    deps,
    OWNER_ID,
  );
  if (!page.ok) throw new Error("setup failed");
  return page.value;
}

// document-import T9: the server-side counterpart of RequestImageUpload +
// RegisterPageAsset for images the importer extracted from a document.
describe("storeImportedAsset use case", () => {
  it("uploads the bytes to the canonical path and registers the asset", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await storeImportedAsset(
      { pageId: page.id, bytes: PNG_BYTES, mime: "image/png" },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deps.storage.uploadCalls).toHaveLength(1);
    const [upload] = deps.storage.uploadCalls;
    expect(upload.contentType).toBe("image/png");
    expect(upload.bytes).toBe(PNG_BYTES);
    expect(isCanonicalStoragePath(OWNER_ID, page.id, upload.path)).toBe(true);
    expect(upload.path.endsWith(".png")).toBe(true);
    const asset = await deps.assets.findById(result.value.assetId);
    expect(asset).toMatchObject({
      ownerId: OWNER_ID,
      pageId: page.id,
      storagePath: upload.path,
      mime: "image/png",
      sizeBytes: PNG_BYTES.length,
    });
  });

  it("rejects a mime outside the allowed list without touching Storage", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await storeImportedAsset(
      { pageId: page.id, bytes: PNG_BYTES, mime: "image/svg+xml" },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe(ASSET_ERROR.MIME_NOT_ALLOWED);
    expect(deps.storage.uploadCalls).toHaveLength(0);
    expect(deps.assets.count()).toBe(0);
  });

  it("rejects bytes larger than MAX_ASSET_BYTES without touching Storage", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await storeImportedAsset(
      {
        pageId: page.id,
        bytes: new Uint8Array(MAX_ASSET_BYTES + 1),
        mime: "image/png",
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ASSET_ERROR.TOO_LARGE);
    expect(deps.storage.uploadCalls).toHaveLength(0);
  });

  it("rejects another owner's page or an archived page without touching Storage", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const foreign = await storeImportedAsset(
      { pageId: page.id, bytes: PNG_BYTES, mime: "image/png" },
      deps,
      OTHER_OWNER_ID,
    );
    await archivePage({ pageId: page.id }, deps, OWNER_ID);
    const archived = await storeImportedAsset(
      { pageId: page.id, bytes: PNG_BYTES, mime: "image/png" },
      deps,
      OWNER_ID,
    );

    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.error.code).toBe(PAGE_ERROR.NOT_FOUND);
    expect(archived.ok).toBe(false);
    if (!archived.ok) expect(archived.error.code).toBe(PAGE_ERROR.NOT_FOUND);
    expect(deps.storage.uploadCalls).toHaveLength(0);
  });

  it("returns UPLOAD_FAILED (never throws) when Storage rejects the upload", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    deps.storage.failNextUpload(new Error("storage down"));

    const result = await storeImportedAsset(
      { pageId: page.id, bytes: PNG_BYTES, mime: "image/png" },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ASSET_ERROR.UPLOAD_FAILED);
    expect(deps.assets.count()).toBe(0);
  });

  it("removes the uploaded object when registration rejects the real object", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    // Storage stores a different type than the one declared (e.g. a
    // bucket-side content sniff): RegisterPageAsset trusts the real object.
    deps.storage.overrideStoredMime("application/octet-stream");

    const result = await storeImportedAsset(
      { pageId: page.id, bytes: PNG_BYTES, mime: "image/png" },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe(ASSET_ERROR.MIME_NOT_ALLOWED);
    expect(deps.assets.count()).toBe(0);
    expect(deps.storage.removeCalls).toEqual([
      [deps.storage.uploadCalls[0].path],
    ]);
  });
});

describe("deleteImportedAssets use case", () => {
  it("deletes the owner's rows and their Storage objects", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const first = await storeImportedAsset(
      { pageId: page.id, bytes: PNG_BYTES, mime: "image/png" },
      deps,
      OWNER_ID,
    );
    const second = await storeImportedAsset(
      { pageId: page.id, bytes: PNG_BYTES, mime: "image/png" },
      deps,
      OWNER_ID,
    );
    if (!first.ok || !second.ok) throw new Error("setup failed");

    await deleteImportedAssets(
      [first.value.assetId, second.value.assetId],
      deps,
      OWNER_ID,
    );

    expect(deps.assets.count()).toBe(0);
    expect(deps.storage.removeCalls).toEqual([
      deps.storage.uploadCalls.map((call) => call.path),
    ]);
  });

  it("never deletes another owner's assets", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const stored = await storeImportedAsset(
      { pageId: page.id, bytes: PNG_BYTES, mime: "image/png" },
      deps,
      OWNER_ID,
    );
    if (!stored.ok) throw new Error("setup failed");

    await deleteImportedAssets([stored.value.assetId], deps, OTHER_OWNER_ID);

    expect(deps.assets.count()).toBe(1);
    expect(deps.storage.removeCalls).toEqual([]);
  });

  it("is best effort: a Storage failure never throws", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const stored = await storeImportedAsset(
      { pageId: page.id, bytes: PNG_BYTES, mime: "image/png" },
      deps,
      OWNER_ID,
    );
    if (!stored.ok) throw new Error("setup failed");
    deps.storage.failNextRemove(new Error("storage down"));

    await expect(
      deleteImportedAssets([stored.value.assetId], deps, OWNER_ID),
    ).resolves.toBeUndefined();
    expect(deps.assets.count()).toBe(0);
  });

  it("does nothing for an empty id list", async () => {
    const deps = makeDeps();

    await deleteImportedAssets([], deps, OWNER_ID);

    expect(deps.storage.removeCalls).toEqual([]);
  });
});
