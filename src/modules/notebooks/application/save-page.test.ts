import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { savePage } from "./save-page";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

const NOW = new Date("2026-09-20T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function makeDeps() {
  return {
    notebooks: new InMemoryNotebookRepository(),
    pages: new InMemoryPageRepository(),
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

const DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hola" }] }],
};

describe("savePage use case", () => {
  it("persists content, increments content_version and recalculates plain_text (Scenario: Guardado con version vigente)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await savePage(
      { pageId: page.id, content: DOC, expectedVersion: 1 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(2);
    const stored = await deps.pages.findById(page.id);
    expect(stored?.contentVersion).toBe(2);
    expect(stored?.plainText).toBe("hola");
    expect(stored?.content).toEqual(DOC);
  });

  it("rejects a stale expectedVersion with the current version, writing nothing (Scenario: Guardado obsoleto rechazado)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);
    const firstSave = await savePage(
      { pageId: page.id, content: DOC, expectedVersion: 1 },
      deps,
      OWNER_ID,
    );
    if (!firstSave.ok) throw new Error("setup failed");

    const result = await savePage(
      { pageId: page.id, content: DOC, expectedVersion: 1 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("PAGE_VERSION_CONFLICT");
    expect(!result.ok && result.error.message).toContain("2");
    const stored = await deps.pages.findById(page.id);
    expect(stored?.contentVersion).toBe(2);
  });

  it("ignores a client-sent plain_text field (Scenario: plain_text enviado por el cliente ignorado)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await savePage(
      {
        pageId: page.id,
        content: DOC,
        expectedVersion: 1,
        plain_text: "texto falso del cliente",
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    const stored = await deps.pages.findById(page.id);
    expect(stored?.plainText).toBe("hola");
  });

  it("rejects content without a doc root node (Scenario: Contenido que no es un documento Tiptap)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await savePage(
      { pageId: page.id, content: { type: "paragraph" }, expectedVersion: 1 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    const stored = await deps.pages.findById(page.id);
    expect(stored?.contentVersion).toBe(1);
  });

  it("rejects saving a page owned by another user (Scenario: Pagina ajena)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await savePage(
      { pageId: page.id, content: DOC, expectedVersion: 1 },
      deps,
      OTHER_OWNER_ID,
    );

    expect(result.ok).toBe(false);
    const stored = await deps.pages.findById(page.id);
    expect(stored?.contentVersion).toBe(1);
  });
});
