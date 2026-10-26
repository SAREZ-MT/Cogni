import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { FakeStorageGateway } from "./application/testing/fake-storage-gateway";
import { InMemoryNotebookRepository } from "./application/testing/in-memory-notebook-repository";
import { InMemoryPageAssetRepository } from "./application/testing/in-memory-page-asset-repository";
import { InMemoryPageRepository } from "./application/testing/in-memory-page-repository";
import type { Notebook } from "./domain/notebook";
import type { TiptapDoc } from "./domain/plain-text";

// createNotebooksServerApi composes application with infrastructure
// (design.md, "server-api.ts vive en la raíz del módulo, como
// actions.ts"). Same substitution pattern as actions.test.ts: the Drizzle
// repositories are swapped for the in-memory test doubles so this proves
// the wiring without a real database.
let notebooks = new InMemoryNotebookRepository();
let pages = new InMemoryPageRepository();
let assets = new InMemoryPageAssetRepository();
let storage = new FakeStorageGateway();
vi.mock("./infrastructure", () => ({
  DrizzlePageAssetRepository: vi.fn(function DrizzlePageAssetRepository() {
    return assets;
  }),
  SupabaseStorageGateway: vi.fn(function SupabaseStorageGateway() {
    return storage;
  }),
  DrizzleNotebookRepository: vi.fn(function DrizzleNotebookRepository() {
    return notebooks;
  }),
  DrizzlePageRepository: vi.fn(function DrizzlePageRepository() {
    return pages;
  }),
}));

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const NOW = new Date("2026-09-23T10:00:00.000Z");
const FAKE_DB = {} as never;

const IMPORTED_DOC: TiptapDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hola" }] }],
};

function makeNotebook(overrides: Partial<Notebook> = {}): Notebook {
  return {
    id: "nb-1",
    ownerId: OWNER_ID,
    title: "Cuaderno",
    icon: null,
    color: null,
    position: 1,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("createNotebooksServerApi", () => {
  beforeEach(() => {
    notebooks = new InMemoryNotebookRepository();
    pages = new InMemoryPageRepository();
    assets = new InMemoryPageAssetRepository();
    storage = new FakeStorageGateway();
  });

  describe("findActiveNotebook", () => {
    it("returns the id of an active notebook owned by the caller", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });

      const found = await api.findActiveNotebook(OWNER_ID, "nb-1");

      expect(found).toEqual({ id: "nb-1" });
    });

    it("returns null for a notebook owned by another user", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });

      const found = await api.findActiveNotebook(OTHER_OWNER_ID, "nb-1");

      expect(found).toBeNull();
    });

    it("returns null for an archived notebook", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook({ archivedAt: NOW }));
      const api = createNotebooksServerApi({ db: FAKE_DB });

      const found = await api.findActiveNotebook(OWNER_ID, "nb-1");

      expect(found).toBeNull();
    });

    it("returns null for a nonexistent notebook", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      const api = createNotebooksServerApi({ db: FAKE_DB });

      const found = await api.findActiveNotebook(OWNER_ID, "does-not-exist");

      expect(found).toBeNull();
    });
  });

  describe("createPage", () => {
    it("creates a page in an active notebook of the caller with the given title", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });

      const result = await api.createPage(OWNER_ID, {
        notebookId: "nb-1",
        title: "documento.pdf",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.notebookId).toBe("nb-1");
      const stored = await pages.findById(result.value.id);
      expect(stored?.title).toBe("documento.pdf");
      expect(stored?.contentVersion).toBe(1);
    });

    it("falls back to the default title when none is given", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });

      const result = await api.createPage(OWNER_ID, { notebookId: "nb-1" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const stored = await pages.findById(result.value.id);
      expect(stored?.title).toBe("Sin título");
    });

    it("rejects a notebook owned by another user", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });

      const result = await api.createPage(OTHER_OWNER_ID, {
        notebookId: "nb-1",
      });

      expect(result.ok).toBe(false);
    });
  });

  describe("writeImportedContent", () => {
    it("writes the initial content atomically and increments content_version (Scenario: Contenido inicial persistido)", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");

      const result = await api.writeImportedContent(OWNER_ID, {
        pageId: created.value.id,
        content: IMPORTED_DOC,
        expectedVersion: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.version).toBe(2);
      const stored = await pages.findById(created.value.id);
      expect(stored?.content).toEqual(IMPORTED_DOC);
      expect(stored?.plainText).toBe("hola");
    });

    it("rejects a stale expectedVersion without changing the page (Scenario: Página ya modificada rechazada)", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");
      const first = await api.writeImportedContent(OWNER_ID, {
        pageId: created.value.id,
        content: IMPORTED_DOC,
        expectedVersion: 1,
      });
      if (!first.ok) throw new Error("setup failed");

      const result = await api.writeImportedContent(OWNER_ID, {
        pageId: created.value.id,
        content: IMPORTED_DOC,
        expectedVersion: 1,
      });

      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.code).toBe("PAGE_VERSION_CONFLICT");
      // R3-conflict-test-no-state-assert: the rejected second call must
      // never touch the page the first call already wrote.
      const stored = await pages.findById(created.value.id);
      expect(stored?.content).toEqual(IMPORTED_DOC);
      expect(stored?.contentVersion).toBe(2);
    });

    it("rejects a page owned by another user without revealing whether it exists", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");

      const result = await api.writeImportedContent(OTHER_OWNER_ID, {
        pageId: created.value.id,
        content: IMPORTED_DOC,
        expectedVersion: 1,
      });

      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
      const stored = await pages.findById(created.value.id);
      expect(stored?.content).not.toEqual(IMPORTED_DOC);
      expect(stored?.contentVersion).toBe(1);
    });
  });

  describe("findPageNotebookId", () => {
    it("returns the notebookId of a page owned by the caller in an active notebook", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");

      const notebookId = await api.findPageNotebookId(
        OWNER_ID,
        created.value.id,
      );

      expect(notebookId).toBe("nb-1");
    });

    it("returns null for a page owned by another user", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");

      const notebookId = await api.findPageNotebookId(
        OTHER_OWNER_ID,
        created.value.id,
      );

      expect(notebookId).toBeNull();
    });

    it("returns null for a nonexistent page", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      const api = createNotebooksServerApi({ db: FAKE_DB });

      const notebookId = await api.findPageNotebookId(
        OWNER_ID,
        "does-not-exist",
      );

      expect(notebookId).toBeNull();
    });

    it("returns null for an archived page", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");
      const page = await pages.findById(created.value.id);
      if (!page) throw new Error("setup failed");
      await pages.update({ ...page, archivedAt: NOW });

      const notebookId = await api.findPageNotebookId(
        OWNER_ID,
        created.value.id,
      );

      expect(notebookId).toBeNull();
    });

    it("returns null when the page's notebook is archived", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");
      await notebooks.update(makeNotebook({ archivedAt: NOW }));

      const notebookId = await api.findPageNotebookId(
        OWNER_ID,
        created.value.id,
      );

      expect(notebookId).toBeNull();
    });

    // T7a review follow-up (R3-notebook-owner-unchecked): a defensive
    // check against a data inconsistency where the page's notebook is no
    // longer owned by the same caller, even though page.ownerId matched.
    it("returns null when the page's notebook is owned by someone else than the page (defensive)", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");
      await notebooks.update(makeNotebook({ ownerId: OTHER_OWNER_ID }));

      const notebookId = await api.findPageNotebookId(
        OWNER_ID,
        created.value.id,
      );

      expect(notebookId).toBeNull();
    });
  });

  describe("getPageText", () => {
    async function setup() {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, {
        notebookId: "nb-1",
        title: "Fotosintesis",
      });
      if (!created.ok) throw new Error("setup failed");
      return { api, pageId: created.value.id };
    }

    it("returns the title and plain text of an owned page", async () => {
      const { api, pageId } = await setup();
      await api.writeImportedContent(OWNER_ID, {
        pageId,
        content: IMPORTED_DOC,
        expectedVersion: 1,
      });

      const result = await api.getPageText(pageId, OWNER_ID);

      expect(result).toEqual({
        ok: true,
        value: { title: "Fotosintesis", plainText: "hola" },
      });
    });

    it("returns NOT_FOUND for a page owned by someone else", async () => {
      const { api, pageId } = await setup();

      const result = await api.getPageText(pageId, OTHER_OWNER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("PAGE_NOT_FOUND");
    });

    it("returns NOT_FOUND for an archived page", async () => {
      const { api, pageId } = await setup();
      const page = await pages.findById(pageId);
      if (!page) throw new Error("setup failed");
      await pages.update({ ...page, archivedAt: NOW });

      const result = await api.getPageText(pageId, OWNER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("PAGE_NOT_FOUND");
    });
  });

  describe("writeImportedContent (updatedAt)", () => {
    it("uses the injected clock for updatedAt instead of the system clock", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const fixed = new Date("2020-01-01T00:00:00.000Z");
      const api = createNotebooksServerApi({
        db: FAKE_DB,
        clock: createFixedClock(fixed),
      });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");

      await api.writeImportedContent(OWNER_ID, {
        pageId: created.value.id,
        content: IMPORTED_DOC,
        expectedVersion: 1,
      });

      const stored = await pages.findById(created.value.id);
      expect(stored?.updatedAt).toEqual(fixed);
    });
  });

  // document-import T9: the importer stores extracted images server-side.
  describe("storeImportedAsset / deleteImportedAssets", () => {
    const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

    it("uploads and registers an asset on an owned page, then deletes it", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");

      const stored = await api.storeImportedAsset(OWNER_ID, {
        pageId: created.value.id,
        bytes: PNG,
        mime: "image/png",
      });

      expect(stored.ok).toBe(true);
      if (!stored.ok) return;
      expect(await assets.findById(stored.value.assetId)).not.toBeNull();
      expect(storage.uploadCalls).toHaveLength(1);

      await api.deleteImportedAssets(OWNER_ID, [stored.value.assetId]);

      expect(await assets.findById(stored.value.assetId)).toBeNull();
      expect(storage.removeCalls).toEqual([[storage.uploadCalls[0].path]]);
    });

    it("refuses another owner's page", async () => {
      const { createNotebooksServerApi } = await import("./server-api");
      await notebooks.create(makeNotebook());
      const api = createNotebooksServerApi({ db: FAKE_DB });
      const created = await api.createPage(OWNER_ID, { notebookId: "nb-1" });
      if (!created.ok) throw new Error("setup failed");

      const stored = await api.storeImportedAsset(OTHER_OWNER_ID, {
        pageId: created.value.id,
        bytes: PNG,
        mime: "image/png",
      });

      expect(stored.ok).toBe(false);
      if (!stored.ok) expect(stored.error.code).toBe("PAGE_NOT_FOUND");
      expect(storage.uploadCalls).toHaveLength(0);
    });
  });
});
