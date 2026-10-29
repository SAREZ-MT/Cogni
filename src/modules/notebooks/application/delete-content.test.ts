import { describe, expect, it, vi } from "vitest";
import type {
  ContentDeletion,
  DeletedFiles,
  ImportSourceStorage,
} from "../domain/content-deletion";
import { NOTEBOOK_ERROR, PAGE_ERROR } from "../domain/errors";
import type { StorageGateway } from "../domain/storage-gateway";
import {
  deleteNotebook,
  deletePage,
  previewNotebookDeletion,
  previewPageDeletion,
} from "./delete-content";

const OWNER = "owner-1";
const NOTEBOOK = "11111111-1111-4111-8111-111111111111";
const PAGE = "22222222-2222-4222-8222-222222222222";
const FILES: DeletedFiles = {
  assetPaths: [`${OWNER}/${PAGE}/a.png`],
  importPaths: [`${OWNER}/u.pdf`],
};

function setup(options: { failStorage?: boolean } = {}) {
  const owned = (id: string, ownerId: string, expected: string) =>
    id === expected && ownerId === OWNER;
  const deletion: ContentDeletion = {
    async previewPage(pageId, ownerId) {
      return owned(pageId, ownerId, PAGE)
        ? { flashcards: 3, recallQuestions: 0, examQuestions: 2, images: 1 }
        : null;
    },
    async previewNotebook(notebookId, ownerId) {
      return owned(notebookId, ownerId, NOTEBOOK)
        ? { pages: 4, decks: 2, recallSets: 0, examSets: 1 }
        : null;
    },
    async deletePage(pageId, ownerId) {
      return owned(pageId, ownerId, PAGE) ? FILES : null;
    },
    async deleteNotebook(notebookId, ownerId) {
      return owned(notebookId, ownerId, NOTEBOOK) ? FILES : null;
    },
  };
  const remove = vi.fn(async (_paths: string[]) => {
    if (options.failStorage) throw new Error("storage down");
  });
  const removeImports = vi.fn(async (_paths: string[]) => {});
  const storage = { remove } as unknown as StorageGateway;
  const importSources: ImportSourceStorage = { remove: removeImports };
  return { deps: { deletion, storage, importSources }, remove, removeImports };
}

describe("page and notebook hard deletes (Phase 8 H19)", () => {
  it("previews what deleting a page or a notebook removes", async () => {
    const { deps } = setup();
    expect(await previewPageDeletion({ pageId: PAGE }, deps, OWNER)).toEqual({
      ok: true,
      value: { flashcards: 3, recallQuestions: 0, examQuestions: 2, images: 1 },
    });
    expect(
      await previewNotebookDeletion({ notebookId: NOTEBOOK }, deps, OWNER),
    ).toEqual({
      ok: true,
      value: { pages: 4, decks: 2, recallSets: 0, examSets: 1 },
    });
  });

  it("deletes a page, then removes its images and sources from Storage", async () => {
    const { deps, remove, removeImports } = setup();
    const result = await deletePage({ pageId: PAGE }, deps, OWNER);
    expect(result).toEqual({ ok: true, value: { pageId: PAGE } });
    expect(remove).toHaveBeenCalledWith(FILES.assetPaths);
    expect(removeImports).toHaveBeenCalledWith(FILES.importPaths);
  });

  it("deletes a notebook, then removes its pages' files", async () => {
    const { deps, remove, removeImports } = setup();
    const result = await deleteNotebook({ notebookId: NOTEBOOK }, deps, OWNER);
    expect(result).toEqual({ ok: true, value: { notebookId: NOTEBOOK } });
    expect(remove).toHaveBeenCalledWith(FILES.assetPaths);
    expect(removeImports).toHaveBeenCalledWith(FILES.importPaths);
  });

  it("still succeeds when Storage fails after the commit (logged, not surfaced)", async () => {
    const { deps } = setup({ failStorage: true });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await deletePage({ pageId: PAGE }, deps, OWNER);
    expect(result.ok).toBe(true);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("answers not found for a foreign or malformed target, touching nothing", async () => {
    const { deps, remove } = setup();
    const foreignPage = await deletePage({ pageId: PAGE }, deps, "owner-2");
    const foreignNotebook = await previewNotebookDeletion(
      { notebookId: NOTEBOOK },
      deps,
      "owner-2",
    );
    const malformed = await previewPageDeletion({ pageId: "x" }, deps, OWNER);
    expect(foreignPage.ok || foreignPage.error.code).toBe(PAGE_ERROR.NOT_FOUND);
    expect(foreignNotebook.ok || foreignNotebook.error.code).toBe(
      NOTEBOOK_ERROR.NOT_FOUND,
    );
    expect(malformed.ok || malformed.error.code).toBe(PAGE_ERROR.NOT_FOUND);
    expect(remove).not.toHaveBeenCalled();
  });
});
