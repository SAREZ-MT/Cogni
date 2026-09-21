import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createId } from "@/shared/kernel/id";
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

describe("createPage use case", () => {
  it('creates a page inside its notebook with "Sin titulo" (Scenario: Pagina creada dentro de un cuaderno)', async () => {
    const deps = makeDeps();
    const notebook = await createNotebook(
      { title: "Calculo I" },
      deps,
      OWNER_ID,
    );
    if (!notebook.ok) throw new Error("setup failed");

    const result = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.notebookId).toBe(notebook.value.id);
    expect(result.value.title).toBe("Sin título");
    expect(result.value.contentVersion).toBe(1);
    expect(result.value.plainText).toBe("");
  });

  it("rejects creating a page under a notebook that does not exist (Scenario: Pagina sin cuaderno rechazada)", async () => {
    const deps = makeDeps();

    const result = await createPage({ notebookId: createId() }, deps, OWNER_ID);

    expect(result.ok).toBe(false);
    expect(deps.pages.count()).toBe(0);
  });

  it("rejects creating a page under an archived notebook (Scenario: Pagina en cuaderno archivado rechazada)", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook(
      { title: "Calculo I" },
      deps,
      OWNER_ID,
    );
    if (!notebook.ok) throw new Error("setup failed");
    await deps.notebooks.update({ ...notebook.value, archivedAt: NOW });

    const result = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect(deps.pages.count()).toBe(0);
  });

  it("rejects creating a page under a notebook owned by another user", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook(
      { title: "Calculo I" },
      deps,
      OWNER_ID,
    );
    if (!notebook.ok) throw new Error("setup failed");

    const result = await createPage(
      { notebookId: notebook.value.id },
      deps,
      "otro-usuario",
    );

    expect(result.ok).toBe(false);
    expect(deps.pages.count()).toBe(0);
  });

  it("assigns strictly increasing positions, counting archived siblings (Scenario: Posiciones crecientes)", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook(
      { title: "Calculo I" },
      deps,
      OWNER_ID,
    );
    if (!notebook.ok) throw new Error("setup failed");
    const first = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    const second = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    if (!first.ok || !second.ok) throw new Error("setup failed");
    await deps.pages.update({ ...second.value, archivedAt: NOW });

    const third = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );

    expect(third.ok && third.value.position).toBeGreaterThan(
      second.value.position,
    );
  });
});
