import { describe, expect, it, vi } from "vitest";
import { ok } from "@/shared/kernel/result";
import type { ImportedDoc } from "../domain/imported-doc";
import { NotebooksPagesAdapter } from "./notebooks-pages-adapter";

// NotebooksPagesAdapter wraps createNotebooksServerApi (notebooks' public
// API, cross-module-via-index in .dependency-cruiser.cjs) to implement
// NotebookPagesPort one-to-one (design.md, "Interfaces / Contracts"). Every
// method is a direct pass-through, so this test only proves the wiring:
// createNotebooksServerApi is swapped for a fake, mirroring
// notebooks/server-api.test.ts's own substitution pattern for its Drizzle
// repositories.
const findActiveNotebook = vi.fn();
const createPage = vi.fn();
const findPageNotebookId = vi.fn();
const writeImportedContent = vi.fn();
const createNotebooksServerApi = vi.fn((_input?: unknown) => ({
  findActiveNotebook,
  createPage,
  findPageNotebookId,
  writeImportedContent,
}));

vi.mock("@/modules/notebooks", () => ({
  createNotebooksServerApi: (input: unknown) => createNotebooksServerApi(input),
}));

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const FAKE_DB = {} as never;
const IMPORTED_DOC: ImportedDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "hola" }],
    },
  ],
};

describe("NotebooksPagesAdapter", () => {
  it("builds the server API once from the given db", () => {
    new NotebooksPagesAdapter(FAKE_DB);

    expect(createNotebooksServerApi).toHaveBeenCalledWith({ db: FAKE_DB });
  });

  it("delegates findActiveNotebook", async () => {
    findActiveNotebook.mockResolvedValueOnce({ id: "nb-1" });
    const adapter = new NotebooksPagesAdapter(FAKE_DB);

    const result = await adapter.findActiveNotebook(OWNER_ID, "nb-1");

    expect(result).toEqual({ id: "nb-1" });
    expect(findActiveNotebook).toHaveBeenCalledWith(OWNER_ID, "nb-1");
  });

  it("delegates createPage", async () => {
    createPage.mockResolvedValueOnce(ok({ id: "page-1", notebookId: "nb-1" }));
    const adapter = new NotebooksPagesAdapter(FAKE_DB);

    const result = await adapter.createPage(OWNER_ID, {
      notebookId: "nb-1",
      title: "documento.pdf",
    });

    expect(result).toEqual(ok({ id: "page-1", notebookId: "nb-1" }));
    expect(createPage).toHaveBeenCalledWith(OWNER_ID, {
      notebookId: "nb-1",
      title: "documento.pdf",
    });
  });

  it("delegates findPageNotebookId", async () => {
    findPageNotebookId.mockResolvedValueOnce("nb-1");
    const adapter = new NotebooksPagesAdapter(FAKE_DB);

    const result = await adapter.findPageNotebookId(OWNER_ID, "page-1");

    expect(result).toBe("nb-1");
    expect(findPageNotebookId).toHaveBeenCalledWith(OWNER_ID, "page-1");
  });

  it("delegates writeImportedContent", async () => {
    writeImportedContent.mockResolvedValueOnce(ok({ version: 2 }));
    const adapter = new NotebooksPagesAdapter(FAKE_DB);

    const result = await adapter.writeImportedContent(OWNER_ID, {
      pageId: "page-1",
      content: IMPORTED_DOC,
      expectedVersion: 1,
    });

    expect(result).toEqual(ok({ version: 2 }));
    expect(writeImportedContent).toHaveBeenCalledWith(OWNER_ID, {
      pageId: "page-1",
      content: IMPORTED_DOC,
      expectedVersion: 1,
    });
  });
});
