import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createNotebook } from "./create-notebook";
import { renameNotebook } from "./rename-notebook";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";

const NOW = new Date("2026-09-20T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function makeDeps() {
  return {
    notebooks: new InMemoryNotebookRepository(),
    clock: createFixedClock(NOW),
  };
}

describe("renameNotebook use case", () => {
  it("renames a notebook owned by the caller", async () => {
    const deps = makeDeps();
    const created = await createNotebook(
      { title: "Calculo I" },
      deps,
      OWNER_ID,
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await renameNotebook(
      { notebookId: created.value.id, title: "Calculo Diferencial" },
      deps,
      OWNER_ID,
    );

    expect(result.ok && result.value.title).toBe("Calculo Diferencial");
  });

  it("rejects a blank title without touching the stored notebook (Scenario: Titulo vacio rechazado)", async () => {
    const deps = makeDeps();
    const created = await createNotebook(
      { title: "Calculo I" },
      deps,
      OWNER_ID,
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await renameNotebook(
      { notebookId: created.value.id, title: "   " },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    const stored = await deps.notebooks.findById(created.value.id);
    expect(stored?.title).toBe("Calculo I");
  });

  it("rejects renaming a notebook owned by another user", async () => {
    const deps = makeDeps();
    const created = await createNotebook(
      { title: "Calculo I" },
      deps,
      OWNER_ID,
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await renameNotebook(
      { notebookId: created.value.id, title: "Robado" },
      deps,
      OTHER_OWNER_ID,
    );

    expect(result.ok).toBe(false);
    const stored = await deps.notebooks.findById(created.value.id);
    expect(stored?.title).toBe("Calculo I");
  });
});
