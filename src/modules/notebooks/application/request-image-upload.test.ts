import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { ASSET_ERROR, PAGE_ERROR } from "../domain/errors";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { requestImageUpload } from "./request-image-upload";
import { markPageArchived } from "./testing/archived-fixtures";
import { FakeStorageGateway } from "./testing/fake-storage-gateway";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

const NOW = new Date("2026-09-21T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function makeDeps() {
  return {
    notebooks: new InMemoryNotebookRepository(),
    pages: new InMemoryPageRepository(),
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

// specs/page-assets/spec.md, "Permiso de subida firmado con límites del
// servidor".
describe("requestImageUpload use case", () => {
  it("issues a signed upload grant to the canonical path (Scenario: Permiso emitido)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await requestImageUpload(
      { pageId: page.id, mime: "image/png", sizeBytes: 2 * 1024 * 1024 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.storagePath).toMatch(
      new RegExp(`^${OWNER_ID}/${page.id}/[^/]+\\.png$`),
    );
    expect(result.value.signedUrl).toContain(result.value.storagePath);
    expect(result.value.token).toBeTruthy();
  });

  it("rejects a mime type outside the allow-list without contacting Storage (Scenario: MIME no permitido)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await requestImageUpload(
      { pageId: page.id, mime: "image/svg+xml", sizeBytes: 1024 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe(ASSET_ERROR.MIME_NOT_ALLOWED);
    expect(deps.storage.signedUploadUrlCalls).toHaveLength(0);
  });

  it("rejects a size over the limit without contacting Storage (Scenario: Tamaño excedido)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await requestImageUpload(
      { pageId: page.id, mime: "image/png", sizeBytes: 10485761 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ASSET_ERROR.TOO_LARGE);
    expect(deps.storage.signedUploadUrlCalls).toHaveLength(0);
  });

  it("rejects a page owned by another user (Scenario: Página ajena o archivada)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await requestImageUpload(
      { pageId: page.id, mime: "image/png", sizeBytes: 1024 },
      deps,
      OTHER_OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(PAGE_ERROR.NOT_FOUND);
  });

  it("rejects an archived page (Scenario: Página ajena o archivada)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    await markPageArchived(deps.pages, page.id);

    const result = await requestImageUpload(
      { pageId: page.id, mime: "image/png", sizeBytes: 1024 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(PAGE_ERROR.NOT_FOUND);
  });
});
