import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { InMemoryNotebookRepository } from "./application/testing/in-memory-notebook-repository";
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
vi.mock("./infrastructure", () => ({
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
    });

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
});
