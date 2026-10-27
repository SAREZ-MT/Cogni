import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { CATALOGUE_SAMPLE_DOC } from "@/shared/kernel/testing/catalogue-sample-doc";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";
import { writeImportedContent } from "./write-imported-content";

const NOW = new Date("2026-09-23T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function makeDeps() {
  return {
    pages: new InMemoryPageRepository(),
    clock: createFixedClock(NOW),
  };
}

async function setupPage() {
  const notebooks = new InMemoryNotebookRepository();
  const pages = new InMemoryPageRepository();
  const clock = createFixedClock(NOW);
  const notebook = await createNotebook(
    { title: "Calculo I" },
    { notebooks, clock },
    OWNER_ID,
  );
  if (!notebook.ok) throw new Error("setup failed");
  const page = await createPage(
    { notebookId: notebook.value.id },
    { notebooks, pages, clock },
    OWNER_ID,
  );
  if (!page.ok) throw new Error("setup failed");
  return { page: page.value, pages, clock };
}

const IMPORTED_DOC = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Titulo" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "primer parrafo" }] },
    { type: "paragraph", content: [{ type: "text", text: "segundo parrafo" }] },
  ],
};

describe("writeImportedContent use case", () => {
  it("persists the initial content, increments content_version and materializes plain_text (Scenario: Contenido inicial persistido)", async () => {
    const { page, pages, clock } = await setupPage();

    const result = await writeImportedContent(
      { pageId: page.id, content: IMPORTED_DOC, expectedVersion: 1 },
      { pages, clock },
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(2);
    const stored = await pages.findById(page.id);
    expect(stored?.contentVersion).toBe(2);
    expect(stored?.content).toEqual(IMPORTED_DOC);
    expect(stored?.plainText).toBe("Titulo\nprimer parrafo\nsegundo parrafo");
  });

  it("rejects a stale expectedVersion with the current version, writing nothing (Scenario: Página ya modificada rechazada)", async () => {
    const { page, pages, clock } = await setupPage();
    const first = await writeImportedContent(
      { pageId: page.id, content: IMPORTED_DOC, expectedVersion: 1 },
      { pages, clock },
      OWNER_ID,
    );
    if (!first.ok) throw new Error("setup failed");

    const result = await writeImportedContent(
      { pageId: page.id, content: IMPORTED_DOC, expectedVersion: 1 },
      { pages, clock },
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("PAGE_VERSION_CONFLICT");
    expect(!result.ok && result.error.message).toContain("2");
    const stored = await pages.findById(page.id);
    expect(stored?.content).toEqual(IMPORTED_DOC);
    expect(stored?.contentVersion).toBe(2);
  });

  it("rejects content without a doc root node (Scenario: Contenido inválido rechazado)", async () => {
    const { page, pages, clock } = await setupPage();

    const result = await writeImportedContent(
      { pageId: page.id, content: { type: "paragraph" }, expectedVersion: 1 },
      { pages, clock },
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    // R3-weak-error-assertions: a shape violation caught by Zod must
    // surface the parseInput edge's code, not just any falsy result.
    expect(!result.ok && result.error.code).toBe("NOTEBOOKS_INVALID_INPUT");
    const stored = await pages.findById(page.id);
    expect(stored?.content).toEqual({ type: "doc", content: [] });
    expect(stored?.contentVersion).toBe(1);
  });

  it("rejects a client-sent plain_text field instead of silently dropping it (Scenario: Contenido inválido rechazado)", async () => {
    const { page, pages, clock } = await setupPage();

    const result = await writeImportedContent(
      {
        pageId: page.id,
        content: IMPORTED_DOC,
        expectedVersion: 1,
        plain_text: "texto falso del llamador",
      },
      { pages, clock },
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("NOTEBOOKS_INVALID_INPUT");
    const stored = await pages.findById(page.id);
    expect(stored?.content).toEqual({ type: "doc", content: [] });
    expect(stored?.contentVersion).toBe(1);
  });

  it("rejects a node outside the content catalogue, writing nothing (strict import contract)", async () => {
    const { page, pages, clock } = await setupPage();

    const result = await writeImportedContent(
      {
        pageId: page.id,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "ok" }] },
            { type: "iframe", attrs: { src: "https://example.com" } },
          ],
        },
        expectedVersion: 1,
      },
      { pages, clock },
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("NOTEBOOKS_INVALID_INPUT");
    const stored = await pages.findById(page.id);
    expect(stored?.content).toEqual({ type: "doc", content: [] });
    expect(stored?.contentVersion).toBe(1);
  });

  it("accepts the full catalogue sample document", async () => {
    const { page, pages, clock } = await setupPage();

    const result = await writeImportedContent(
      { pageId: page.id, content: CATALOGUE_SAMPLE_DOC, expectedVersion: 1 },
      { pages, clock },
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    const stored = await pages.findById(page.id);
    expect(stored?.content).toEqual(CATALOGUE_SAMPLE_DOC);
  });

  it("rejects an empty document: initial content is never empty (design.md invariant 2)", async () => {
    const { page, pages, clock } = await setupPage();

    const result = await writeImportedContent(
      {
        pageId: page.id,
        content: { type: "doc", content: [] },
        expectedVersion: 1,
      },
      { pages, clock },
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("PAGE_INVALID_CONTENT");
    const stored = await pages.findById(page.id);
    expect(stored?.contentVersion).toBe(1);
  });

  it("rejects a page owned by another user without revealing whether it exists (Scenario: Página o cuaderno ajenos)", async () => {
    const { page, pages, clock } = await setupPage();

    const result = await writeImportedContent(
      { pageId: page.id, content: IMPORTED_DOC, expectedVersion: 1 },
      { pages, clock },
      OTHER_OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
    const stored = await pages.findById(page.id);
    expect(stored?.content).toEqual({ type: "doc", content: [] });
    expect(stored?.contentVersion).toBe(1);
  });

  it("rejects an archived page (Scenario: Página o cuaderno ajenos, archived-page handling)", async () => {
    const deps = makeDeps();
    const notebooks = new InMemoryNotebookRepository();
    const notebook = await createNotebook(
      { title: "Cuaderno" },
      { notebooks, clock: deps.clock },
      OWNER_ID,
    );
    if (!notebook.ok) throw new Error("setup failed");
    const page = await createPage(
      { notebookId: notebook.value.id },
      { notebooks, pages: deps.pages, clock: deps.clock },
      OWNER_ID,
    );
    if (!page.ok) throw new Error("setup failed");
    await deps.pages.update({ ...page.value, archivedAt: deps.clock.now() });

    const result = await writeImportedContent(
      { pageId: page.value.id, content: IMPORTED_DOC, expectedVersion: 1 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
    const stored = await deps.pages.findById(page.value.id);
    expect(stored?.content).toEqual({ type: "doc", content: [] });
    expect(stored?.contentVersion).toBe(1);
    expect(stored?.archivedAt).toEqual(deps.clock.now());
  });

  it("rejects a nonexistent pageId (Scenario: Página o cuaderno ajenos)", async () => {
    const deps = makeDeps();

    const result = await writeImportedContent(
      { pageId: "does-not-exist", content: IMPORTED_DOC, expectedVersion: 1 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
  });
});
