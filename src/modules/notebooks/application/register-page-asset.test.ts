import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { ASSET_ERROR, PAGE_ERROR } from "../domain/errors";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { registerPageAsset } from "./register-page-asset";
import { FakeStorageGateway } from "./testing/fake-storage-gateway";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageAssetRepository } from "./testing/in-memory-page-asset-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

const NOW = new Date("2026-09-21T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

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

// specs/page-assets/spec.md, "Registro de PageAsset con revalidación".
describe("registerPageAsset use case", () => {
  it("persists mime/size from the real object (Scenario: Registro exitoso)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const storagePath = `${OWNER_ID}/${page.id}/asset-1.png`;
    deps.storage.put(storagePath, {
      sizeBytes: 2 * 1024 * 1024,
      mime: "image/png",
    });

    const result = await registerPageAsset(
      {
        pageId: page.id,
        storagePath,
        mime: "image/png",
        sizeBytes: 2 * 1024 * 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pageId).toBe(page.id);
    expect(result.value.storagePath).toBe(storagePath);
    expect(result.value.mime).toBe("image/png");
    expect(result.value.sizeBytes).toBe(2 * 1024 * 1024);
    expect(deps.assets.count()).toBe(1);
  });

  it("rejects and does not persist when the real object exceeds policy, even if declared smaller (Scenario: Objeto real fuera de política)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const storagePath = `${OWNER_ID}/${page.id}/asset-2.png`;
    deps.storage.put(storagePath, {
      sizeBytes: 12 * 1024 * 1024,
      mime: "image/png",
    });

    const result = await registerPageAsset(
      {
        pageId: page.id,
        storagePath,
        mime: "image/png",
        sizeBytes: 2 * 1024 * 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ASSET_ERROR.TOO_LARGE);
    expect(deps.assets.count()).toBe(0);
  });

  it("rejects a storagePath whose first segment is not the owner (Scenario: Ruta fuera del prefijo del owner)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const storagePath = `${OTHER_OWNER_ID}/${page.id}/asset-3.png`;
    deps.storage.put(storagePath, { sizeBytes: 1024, mime: "image/png" });

    const result = await registerPageAsset(
      { pageId: page.id, storagePath, mime: "image/png", sizeBytes: 1024 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe(ASSET_ERROR.PATH_OUT_OF_SCOPE);
    expect(deps.assets.count()).toBe(0);
  });

  it("rejects a storagePath that keeps the owner prefix but escapes it with dot-segments", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const victimPath = `${OTHER_OWNER_ID}/some-page/secret.png`;
    deps.storage.put(victimPath, { sizeBytes: 1024, mime: "image/png" });
    const storagePath = `${OWNER_ID}/${page.id}/../../${victimPath}`;
    // The fake gateway would resolve the traversal like a normalising HTTP
    // client does, so only the use case's guard stands between the caller
    // and the other owner's object.
    deps.storage.put(storagePath, { sizeBytes: 1024, mime: "image/png" });

    const result = await registerPageAsset(
      { pageId: page.id, storagePath, mime: "image/png", sizeBytes: 1024 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe(ASSET_ERROR.PATH_OUT_OF_SCOPE);
    expect(deps.assets.count()).toBe(0);
  });

  it("returns the existing row without duplicating on a repeated registration (Scenario: Registro repetido)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const storagePath = `${OWNER_ID}/${page.id}/asset-4.png`;
    deps.storage.put(storagePath, { sizeBytes: 1024, mime: "image/png" });

    const first = await registerPageAsset(
      { pageId: page.id, storagePath, mime: "image/png", sizeBytes: 1024 },
      deps,
      OWNER_ID,
    );
    const second = await registerPageAsset(
      { pageId: page.id, storagePath, mime: "image/png", sizeBytes: 1024 },
      deps,
      OWNER_ID,
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.value.id).toBe(first.value.id);
    expect(deps.assets.count()).toBe(1);
  });

  it("rejects a page owned by another user (Scenario: Página ajena)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const storagePath = `${OTHER_OWNER_ID}/${page.id}/asset-5.png`;

    const result = await registerPageAsset(
      { pageId: page.id, storagePath, mime: "image/png", sizeBytes: 1024 },
      deps,
      OTHER_OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(PAGE_ERROR.NOT_FOUND);
  });

  it("rejects when the real object does not exist in Storage", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const storagePath = `${OWNER_ID}/${page.id}/missing.png`;

    const result = await registerPageAsset(
      { pageId: page.id, storagePath, mime: "image/png", sizeBytes: 1024 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ASSET_ERROR.FORBIDDEN);
    expect(deps.assets.count()).toBe(0);
  });
});
