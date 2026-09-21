import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createNotebook } from "./create-notebook";
import { setNotebookAppearance } from "./set-notebook-appearance";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";

const NOW = new Date("2026-09-20T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

function makeDeps() {
  return {
    notebooks: new InMemoryNotebookRepository(),
    clock: createFixedClock(NOW),
  };
}

describe("setNotebookAppearance use case", () => {
  it("updates icon and color", async () => {
    const deps = makeDeps();
    const created = await createNotebook(
      { title: "Calculo I" },
      deps,
      OWNER_ID,
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await setNotebookAppearance(
      { notebookId: created.value.id, icon: "📘", color: "blue" },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.icon).toBe("📘");
    expect(result.value.color).toBe("blue");
  });

  it("rejects a color outside the palette, keeping the previous color (Scenario: Color fuera de la paleta rechazado)", async () => {
    const deps = makeDeps();
    const created = await createNotebook(
      { title: "Calculo I", color: "mint" },
      deps,
      OWNER_ID,
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await setNotebookAppearance(
      { notebookId: created.value.id, color: "red" },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    const stored = await deps.notebooks.findById(created.value.id);
    expect(stored?.color).toBe("mint");
  });
});
