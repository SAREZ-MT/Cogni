import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { FakeNotebookPagesPort } from "./fake-notebook-pages-port";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

describe("FakeNotebookPagesPort", () => {
  it("returns null for a notebook that was never added", async () => {
    const port = new FakeNotebookPagesPort();

    expect(await port.findActiveNotebook(OWNER_ID, "nb-1")).toBeNull();
  });

  it("returns null for a notebook owned by someone else", async () => {
    const port = new FakeNotebookPagesPort();
    port.addNotebook({ id: "nb-1", ownerId: OWNER_ID, active: true });

    expect(await port.findActiveNotebook(OTHER_OWNER_ID, "nb-1")).toBeNull();
  });

  it("returns null for an archived notebook", async () => {
    const port = new FakeNotebookPagesPort();
    port.addNotebook({ id: "nb-1", ownerId: OWNER_ID, active: false });

    expect(await port.findActiveNotebook(OWNER_ID, "nb-1")).toBeNull();
  });

  it("returns the id of an active, owned notebook", async () => {
    const port = new FakeNotebookPagesPort();
    port.addNotebook({ id: "nb-1", ownerId: OWNER_ID, active: true });

    expect(await port.findActiveNotebook(OWNER_ID, "nb-1")).toEqual({
      id: "nb-1",
    });
  });

  it("returns null from findPageNotebookId for a page that was never created", async () => {
    const port = new FakeNotebookPagesPort();

    expect(await port.findPageNotebookId(OWNER_ID, "missing")).toBeNull();
  });

  it("returns null from findPageNotebookId for a page owned by someone else", async () => {
    const port = new FakeNotebookPagesPort();
    const created = await port.createPage(OWNER_ID, { notebookId: "nb-1" });
    if (!created.ok) throw new Error("setup failed");

    expect(
      await port.findPageNotebookId(OTHER_OWNER_ID, created.value.id),
    ).toBeNull();
  });

  it("returns the real notebookId of an owned page", async () => {
    const port = new FakeNotebookPagesPort();
    const created = await port.createPage(OWNER_ID, { notebookId: "nb-1" });
    if (!created.ok) throw new Error("setup failed");

    expect(await port.findPageNotebookId(OWNER_ID, created.value.id)).toBe(
      "nb-1",
    );
  });

  it("creates a page and records the call", async () => {
    const port = new FakeNotebookPagesPort();

    const result = await port.createPage(OWNER_ID, {
      notebookId: "nb-1",
      title: "Notas",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.notebookId).toBe("nb-1");
    expect(port.createPageCalls).toEqual([
      { ownerId: OWNER_ID, notebookId: "nb-1", title: "Notas" },
    ]);
    expect(port.getPage(result.value.id)).toMatchObject({
      ownerId: OWNER_ID,
      notebookId: "nb-1",
      title: "Notas",
      version: 1,
    });
  });

  it("returns the forced error on the next createPage() call only", async () => {
    const port = new FakeNotebookPagesPort();
    const forced = new DomainError("FORCED", "simulated failure");
    port.forceNextCreatePageError(forced);

    const first = await port.createPage(OWNER_ID, { notebookId: "nb-1" });
    const second = await port.createPage(OWNER_ID, { notebookId: "nb-1" });

    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.error).toBe(forced);
    expect(second.ok).toBe(true);
  });

  it("writes imported content to an existing owned page at the expected version", async () => {
    const port = new FakeNotebookPagesPort();
    const created = await port.createPage(OWNER_ID, { notebookId: "nb-1" });
    if (!created.ok) throw new Error("setup failed");
    const content = { type: "doc" as const, content: [] };

    const result = await port.writeImportedContent(OWNER_ID, {
      pageId: created.value.id,
      content,
      expectedVersion: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(2);
    expect(port.writeImportedContentCalls).toEqual([
      { ownerId: OWNER_ID, pageId: created.value.id },
    ]);
    expect(port.getPage(created.value.id)?.content).toBe(content);
  });

  it("rejects writeImportedContent for a page that does not exist", async () => {
    const port = new FakeNotebookPagesPort();

    const result = await port.writeImportedContent(OWNER_ID, {
      pageId: "missing",
      content: { type: "doc", content: [] },
      expectedVersion: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAGE_NOT_FOUND");
  });

  it("rejects writeImportedContent for a page owned by someone else", async () => {
    const port = new FakeNotebookPagesPort();
    const created = await port.createPage(OWNER_ID, { notebookId: "nb-1" });
    if (!created.ok) throw new Error("setup failed");

    const result = await port.writeImportedContent(OTHER_OWNER_ID, {
      pageId: created.value.id,
      content: { type: "doc", content: [] },
      expectedVersion: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAGE_NOT_FOUND");
  });

  it("rejects writeImportedContent on a version conflict", async () => {
    const port = new FakeNotebookPagesPort();
    const created = await port.createPage(OWNER_ID, { notebookId: "nb-1" });
    if (!created.ok) throw new Error("setup failed");

    const result = await port.writeImportedContent(OWNER_ID, {
      pageId: created.value.id,
      content: { type: "doc", content: [] },
      expectedVersion: 99,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAGE_VERSION_CONFLICT");
  });

  // document-import T9.
  it("stores an allowed image on an owned page and returns a fresh assetId", async () => {
    const port = new FakeNotebookPagesPort();
    const page = await port.createPage(OWNER_ID, { notebookId: "nb-1" });
    if (!page.ok) throw new Error("setup failed");

    const stored = await port.storeImportedAsset(OWNER_ID, {
      pageId: page.value.id,
      bytes: new Uint8Array(4),
      mime: "image/png",
    });

    expect(stored.ok).toBe(true);
    expect(port.storedAssetIds()).toEqual(
      stored.ok ? [stored.value.assetId] : [],
    );
  });

  it("refuses a disallowed mime or another owner's page like notebooks does", async () => {
    const port = new FakeNotebookPagesPort();
    const page = await port.createPage(OWNER_ID, { notebookId: "nb-1" });
    if (!page.ok) throw new Error("setup failed");

    const tiff = await port.storeImportedAsset(OWNER_ID, {
      pageId: page.value.id,
      bytes: new Uint8Array(4),
      mime: "image/tiff",
    });
    const foreign = await port.storeImportedAsset(OTHER_OWNER_ID, {
      pageId: page.value.id,
      bytes: new Uint8Array(4),
      mime: "image/png",
    });

    expect(tiff.ok).toBe(false);
    if (!tiff.ok) expect(tiff.error.code).toBe("ASSET_MIME_NOT_ALLOWED");
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.error.code).toBe("PAGE_NOT_FOUND");
    expect(port.storedAssetIds()).toEqual([]);
  });

  it("fails a chosen store call with an error or a throw", async () => {
    const port = new FakeNotebookPagesPort();
    const page = await port.createPage(OWNER_ID, { notebookId: "nb-1" });
    if (!page.ok) throw new Error("setup failed");
    port.failStoreAt(0, "error");
    port.failStoreAt(1, "throw");
    const input = {
      pageId: page.value.id,
      bytes: new Uint8Array(4),
      mime: "image/png",
    };

    const first = await port.storeImportedAsset(OWNER_ID, input);

    expect(first.ok).toBe(false);
    await expect(port.storeImportedAsset(OWNER_ID, input)).rejects.toThrow();
    expect(port.storedAssetIds()).toEqual([]);
  });

  it("deletes only the caller's stored assets and records the call", async () => {
    const port = new FakeNotebookPagesPort();
    const page = await port.createPage(OWNER_ID, { notebookId: "nb-1" });
    if (!page.ok) throw new Error("setup failed");
    const stored = await port.storeImportedAsset(OWNER_ID, {
      pageId: page.value.id,
      bytes: new Uint8Array(4),
      mime: "image/png",
    });
    if (!stored.ok) throw new Error("setup failed");

    await port.deleteImportedAssets(OTHER_OWNER_ID, [stored.value.assetId]);
    expect(port.storedAssetIds()).toHaveLength(1);
    await port.deleteImportedAssets(OWNER_ID, [stored.value.assetId]);

    expect(port.storedAssetIds()).toEqual([]);
    expect(port.deleteImportedAssetsCalls).toEqual([
      { ownerId: OTHER_OWNER_ID, assetIds: [stored.value.assetId] },
      { ownerId: OWNER_ID, assetIds: [stored.value.assetId] },
    ]);
  });
});
