import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryNotebookRepository } from "./application/testing/in-memory-notebook-repository";
import { InMemoryPageRepository } from "./application/testing/in-memory-page-repository";

// Session and repositories are mocked so this test proves the two Server
// Action scenarios of specs/notebooks/spec.md ("Server Action sin sesión",
// "Entrada inválida en Server Action") without a real database.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
// revalidatePath needs a real Next.js request/static-generation store,
// which does not exist outside `next dev`/`next start`; the mutation
// scenarios under test do not assert on cache revalidation.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const notebooks = new InMemoryNotebookRepository();
const pages = new InMemoryPageRepository();
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
vi.mock("./infrastructure", () => ({
  DrizzleNotebookRepository: vi.fn(function DrizzleNotebookRepository() {
    return notebooks;
  }),
  DrizzlePageRepository: vi.fn(function DrizzlePageRepository() {
    return pages;
  }),
}));

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

describe("notebooks Server Actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
  });

  describe("without a session", () => {
    it("rejects createNotebook without touching application", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { createNotebook } = await import("./actions");

      await expect(createNotebook({ title: "Cuaderno" })).rejects.toThrow(
        "Debes iniciar sesión para continuar.",
      );
      expect(notebooks.count()).toBe(0);
    });

    it("rejects renameNotebook without touching application", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { renameNotebook } = await import("./actions");

      await expect(
        renameNotebook({ notebookId: "any", title: "Nuevo" }),
      ).rejects.toThrow("Debes iniciar sesión para continuar.");
    });
  });

  describe("with a session, invalid input", () => {
    beforeEach(() => {
      getCurrentUser.mockResolvedValue({ id: OWNER_ID, email: "a@b.com" });
    });

    it("rejects a rename with a 200-character title with an actionable Spanish message", async () => {
      const { createNotebook, renameNotebook } = await import("./actions");
      const notebook = await createNotebook({ title: "Cuaderno" });

      const tooLong = "a".repeat(200);
      await expect(
        renameNotebook({ notebookId: notebook.id, title: tooLong }),
      ).rejects.toThrow(
        "El título no puede estar vacío ni superar los 120 caracteres.",
      );
    });

    it("rejects malformed shape input before reaching domain rules", async () => {
      const { createNotebook } = await import("./actions");

      await expect(createNotebook({ title: 123 })).rejects.toThrow(
        "Revisa los datos: algo no tiene el formato esperado.",
      );
    });
  });

  describe("getPageForRoute", () => {
    beforeEach(() => {
      getCurrentUser.mockResolvedValue({ id: OWNER_ID, email: "a@b.com" });
    });

    it("returns null when the page belongs to a different notebook than the route param", async () => {
      const { createNotebook, createPage, getPageForRoute } = await import(
        "./actions"
      );
      const notebookA = await createNotebook({ title: "Cuaderno A" });
      const notebookB = await createNotebook({ title: "Cuaderno B" });
      const page = await createPage({ notebookId: notebookA.id });

      // The route param says notebookB, but the page actually lives under
      // notebookA: this must not resolve, even though pageId/ownerId match.
      const result = await getPageForRoute(notebookB.id, page.id);

      expect(result).toBeNull();
    });

    it("returns the page when it belongs to the notebook in the route param", async () => {
      const { createNotebook, createPage, getPageForRoute } = await import(
        "./actions"
      );
      const notebook = await createNotebook({ title: "Cuaderno" });
      const page = await createPage({ notebookId: notebook.id });

      const result = await getPageForRoute(notebook.id, page.id);

      expect(result?.id).toBe(page.id);
    });
  });
});
