import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { COLOR_PALETTE } from "../domain/notebook";
import { createNotebook } from "./create-notebook";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";

const NOW = new Date("2026-09-20T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

function makeDeps() {
  return {
    notebooks: new InMemoryNotebookRepository(),
    clock: createFixedClock(NOW),
  };
}

describe("createNotebook use case", () => {
  it("creates a notebook owned by the caller (Scenario: Creacion con titulo valido)", async () => {
    const deps = makeDeps();

    const result = await createNotebook({ title: "Calculo I" }, deps, OWNER_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ownerId).toBe(OWNER_ID);
    expect(result.value.title).toBe("Calculo I");
    expect(await deps.notebooks.findById(result.value.id)).not.toBeNull();
  });

  describe("color (design pass 2: no flat neutral tile on creation)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("picks the palette entry selected by Math.random when no color is supplied", async () => {
      const deps = makeDeps();
      const last = COLOR_PALETTE.length - 1;
      const random = vi.spyOn(Math, "random");

      random.mockReturnValue(0);
      const first = await createNotebook({ title: "Uno" }, deps, OWNER_ID);
      random.mockReturnValue(0.999999);
      const final = await createNotebook({ title: "Dos" }, deps, OWNER_ID);

      expect(first.ok && first.value.color).toBe(COLOR_PALETTE[0]);
      expect(final.ok && final.value.color).toBe(COLOR_PALETTE[last]);
    });

    it("persists the picked color, never a null one", async () => {
      const deps = makeDeps();
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const result = await createNotebook({ title: "Uno" }, deps, OWNER_ID);

      if (!result.ok) throw new Error("setup failed");
      const stored = await deps.notebooks.findById(result.value.id);
      expect(stored?.color).toBe(
        COLOR_PALETTE[Math.floor(0.5 * COLOR_PALETTE.length)],
      );
    });

    it("treats an explicit null color as not supplied", async () => {
      const deps = makeDeps();
      vi.spyOn(Math, "random").mockReturnValue(0);

      const result = await createNotebook(
        { title: "Uno", color: null },
        deps,
        OWNER_ID,
      );

      expect(result.ok && result.value.color).toBe(COLOR_PALETTE[0]);
    });

    it("keeps an explicitly supplied color instead of picking a random one", async () => {
      const deps = makeDeps();
      const suppliedColor = COLOR_PALETTE[COLOR_PALETTE.length - 1];
      // Would select the first palette entry if the supplied color were ignored.
      vi.spyOn(Math, "random").mockReturnValue(0);

      const result = await createNotebook(
        { title: "Calculo I", color: suppliedColor },
        deps,
        OWNER_ID,
      );

      expect(result.ok && result.value.color).toBe(suppliedColor);
    });

    it("rejects an unknown supplied color instead of replacing it with a random one", async () => {
      const deps = makeDeps();
      vi.spyOn(Math, "random").mockReturnValue(0);

      const result = await createNotebook(
        { title: "Calculo I", color: "neon" },
        deps,
        OWNER_ID,
      );

      expect(result.ok).toBe(false);
      expect(deps.notebooks.count()).toBe(0);
    });
  });

  it("rejects a blank title and persists nothing (Scenario: Titulo vacio rechazado)", async () => {
    const deps = makeDeps();

    const result = await createNotebook({ title: "   " }, deps, OWNER_ID);

    expect(result.ok).toBe(false);
    expect(deps.notebooks.count()).toBe(0);
  });

  it("assigns strictly increasing positions, counting archived siblings (Scenario: Posiciones crecientes)", async () => {
    const deps = makeDeps();

    const first = await createNotebook({ title: "Uno" }, deps, OWNER_ID);
    const second = await createNotebook({ title: "Dos" }, deps, OWNER_ID);
    if (!first.ok || !second.ok) throw new Error("setup failed");
    await deps.notebooks.update({ ...second.value, archivedAt: NOW });
    const third = await createNotebook({ title: "Tres" }, deps, OWNER_ID);

    expect(third.ok && third.value.position).toBeGreaterThan(
      second.value.position,
    );
  });

  it("lists notebooks in ascending position order (Scenario: Listado en orden de creacion)", async () => {
    const deps = makeDeps();

    await createNotebook({ title: "Uno" }, deps, OWNER_ID);
    await createNotebook({ title: "Dos" }, deps, OWNER_ID);
    await createNotebook({ title: "Tres" }, deps, OWNER_ID);

    const titles = (await deps.notebooks.listActiveByOwner(OWNER_ID)).map(
      (notebook) => notebook.title,
    );
    expect(titles).toEqual(["Uno", "Dos", "Tres"]);
  });
});
