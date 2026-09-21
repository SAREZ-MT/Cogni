import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { archiveNotebook } from "./archive-notebook";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

const NOW = new Date("2026-09-20T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

function makeDeps() {
  return {
    notebooks: new InMemoryNotebookRepository(),
    pages: new InMemoryPageRepository(),
    clock: createFixedClock(NOW),
  };
}

describe("archiveNotebook use case", () => {
  it("archives the notebook and hides its active pages too (Scenario: Cuaderno archivado desaparece con sus paginas)", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook(
      { title: "Calculo I" },
      deps,
      OWNER_ID,
    );
    if (!notebook.ok) throw new Error("setup failed");
    const pageA = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    const pageB = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    if (!pageA.ok || !pageB.ok) throw new Error("setup failed");

    const result = await archiveNotebook(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    const storedNotebook = await deps.notebooks.findById(notebook.value.id);
    expect(storedNotebook?.archivedAt).toEqual(NOW);
    const storedPages = await deps.pages.listActiveByNotebook(
      notebook.value.id,
    );
    expect(storedPages).toHaveLength(0);
    expect((await deps.pages.findById(pageA.value.id))?.archivedAt).toEqual(
      NOW,
    );
    expect((await deps.pages.findById(pageB.value.id))?.archivedAt).toEqual(
      NOW,
    );
  });

  it("is idempotent on an already archived notebook (Scenario: Archivado repetido)", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook(
      { title: "Calculo I" },
      deps,
      OWNER_ID,
    );
    if (!notebook.ok) throw new Error("setup failed");
    await archiveNotebook({ notebookId: notebook.value.id }, deps, OWNER_ID);
    const firstArchivedAt = (await deps.notebooks.findById(notebook.value.id))
      ?.archivedAt;

    const result = await archiveNotebook(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    const stored = await deps.notebooks.findById(notebook.value.id);
    expect(stored?.archivedAt).toEqual(firstArchivedAt);
  });
});
