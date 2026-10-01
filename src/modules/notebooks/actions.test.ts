import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeStorageGateway } from "./application/testing/fake-storage-gateway";
import { InMemoryNotebookRepository } from "./application/testing/in-memory-notebook-repository";
import { InMemoryPageAssetRepository } from "./application/testing/in-memory-page-asset-repository";
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
const assets = new InMemoryPageAssetRepository();
const storage = new FakeStorageGateway();
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
vi.mock("./infrastructure", () => ({
  DrizzleNotebookRepository: vi.fn(function DrizzleNotebookRepository() {
    return notebooks;
  }),
  DrizzlePageRepository: vi.fn(function DrizzlePageRepository() {
    return pages;
  }),
  DrizzlePageAssetRepository: vi.fn(function DrizzlePageAssetRepository() {
    return assets;
  }),
  SupabaseStorageGateway: vi.fn(function SupabaseStorageGateway() {
    return storage;
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

  // S3 breadcrumb: the page route needs the notebook's title without
  // paying for getNotebookForRoute's full active-pages fetch on every page
  // view.
  describe("getNotebookTitleForRoute", () => {
    beforeEach(() => {
      getCurrentUser.mockResolvedValue({ id: OWNER_ID, email: "a@b.com" });
    });

    it("returns the title of a notebook the caller owns", async () => {
      const { createNotebook, getNotebookTitleForRoute } = await import(
        "./actions"
      );
      const notebook = await createNotebook({ title: "Biología Celular" });

      const result = await getNotebookTitleForRoute(notebook.id);

      expect(result).toBe("Biología Celular");
    });

    it("returns null for a notebook id that does not exist", async () => {
      const { getNotebookTitleForRoute } = await import("./actions");

      const result = await getNotebookTitleForRoute("missing-id");

      expect(result).toBeNull();
    });

    it("returns null for a notebook owned by a different user", async () => {
      const { createNotebook, getNotebookTitleForRoute } = await import(
        "./actions"
      );
      const notebook = await createNotebook({ title: "Ajeno" });

      getCurrentUser.mockResolvedValue({ id: "other-owner", email: "x@y.com" });
      const result = await getNotebookTitleForRoute(notebook.id);

      expect(result).toBeNull();
    });

    it("returns null for an archived notebook", async () => {
      const { createNotebook, archiveNotebook, getNotebookTitleForRoute } =
        await import("./actions");
      const notebook = await createNotebook({ title: "Archivado" });
      await archiveNotebook({ notebookId: notebook.id });

      const result = await getNotebookTitleForRoute(notebook.id);

      expect(result).toBeNull();
    });

    // Review follow-up from S3 (R3-breadcrumb-lookup-throws): a session or
    // repository failure must degrade the breadcrumb to the page's own
    // title alone, like a foreign/archived notebookId, never throw and
    // break the whole page route.
    it("returns null instead of throwing when the session lookup rejects", async () => {
      const { getNotebookTitleForRoute } = await import("./actions");
      getCurrentUser.mockRejectedValue(new Error("session lookup failed"));

      const result = await getNotebookTitleForRoute("any-id");

      expect(result).toBeNull();
    });
  });

  describe("getHomeOverview", () => {
    beforeEach(() => {
      getCurrentUser.mockResolvedValue({ id: OWNER_ID, email: "a@b.com" });
    });

    // Shared repository instances live for the whole file (mocked once at
    // the top), so other tests may have already created notebooks/pages by
    // the time this one runs: assert this notebook's own summary, not
    // exact totals.
    it("reflects real notebooks/pages created through the same Server Actions", async () => {
      const { createNotebook, createPage, getHomeOverview } = await import(
        "./actions"
      );
      const notebook = await createNotebook({
        title: "Biología Celular (Home)",
      });
      await createPage({ notebookId: notebook.id });

      const overview = await getHomeOverview();

      const summary = overview.notebooks.find((n) => n.id === notebook.id);
      expect(summary?.title).toBe("Biología Celular (Home)");
      expect(summary?.pageCount).toBe(1);
      expect(overview.notebookCount).toBeGreaterThanOrEqual(1);
      expect(overview.pageCount).toBeGreaterThanOrEqual(1);
    });

    it("rejects without a session, like every other notebooks Server Action", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { getHomeOverview } = await import("./actions");

      await expect(getHomeOverview()).rejects.toThrow(
        "Debes iniciar sesión para continuar.",
      );
    });
  });

  describe("listPagesForMention", () => {
    beforeEach(() => {
      getCurrentUser.mockResolvedValue({ id: OWNER_ID, email: "a@b.com" });
    });

    it("flattens the owner's pages with their notebook's id, title and color", async () => {
      const { createNotebook, createPage, listPagesForMention } = await import(
        "./actions"
      );
      const notebook = await createNotebook({ title: "Cuaderno mención" });
      const page = await createPage({ notebookId: notebook.id });

      const candidates = await listPagesForMention();

      expect(candidates).toContainEqual({
        id: page.id,
        title: page.title,
        notebookId: notebook.id,
        notebookTitle: "Cuaderno mención",
        notebookColor: notebook.color,
      });
    });

    it("does not list pages owned by another user", async () => {
      const { createNotebook, createPage, listPagesForMention } = await import(
        "./actions"
      );
      const notebook = await createNotebook({ title: "Cuaderno ajeno" });
      const page = await createPage({ notebookId: notebook.id });

      getCurrentUser.mockResolvedValue({
        id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
        email: "otro@b.com",
      });
      const candidates = await listPagesForMention();

      expect(candidates.map((candidate) => candidate.id)).not.toContain(
        page.id,
      );
    });

    it("rejects without a session, like every other notebooks Server Action", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { listPagesForMention } = await import("./actions");

      await expect(listPagesForMention()).rejects.toThrow(
        "Debes iniciar sesión para continuar.",
      );
    });
  });

  // design.md, "notebooks como único puerto de persistencia hacia el
  // editor": saveContent/getCurrentContent must structurally satisfy
  // SavePagePort (Result-returning, never throwing on a domain error) so
  // the page route can pass them directly as the editor's port prop.
  describe("saveContent / getCurrentContent as SavePagePort", () => {
    beforeEach(() => {
      getCurrentUser.mockResolvedValue({ id: OWNER_ID, email: "a@b.com" });
    });

    it("saves and returns ok({ version }) on the expected version", async () => {
      const { createNotebook, createPage, saveContent } = await import(
        "./actions"
      );
      const notebook = await createNotebook({ title: "Cuaderno" });
      const page = await createPage({ notebookId: notebook.id });

      const result = await saveContent({
        pageId: page.id,
        expectedVersion: page.contentVersion,
        content: { type: "doc", content: [] },
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.version).toBe(page.contentVersion + 1);
    });

    it("returns err(PAGE_VERSION_CONFLICT) instead of throwing on a stale version", async () => {
      const { createNotebook, createPage, saveContent } = await import(
        "./actions"
      );
      const notebook = await createNotebook({ title: "Cuaderno" });
      const page = await createPage({ notebookId: notebook.id });

      const result = await saveContent({
        pageId: page.id,
        expectedVersion: page.contentVersion + 99,
        content: { type: "doc", content: [] },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("PAGE_VERSION_CONFLICT");
    });

    // A Server Action's return value crosses the RSC/Flight boundary:
    // React redacts Error subclasses on the wire, so a DomainError instance
    // never survives as one on the client (`instanceof DomainError` would
    // silently become false again there, the root cause the two-tab
    // conflict e2e test hit). saveContent/getCurrentContent must already
    // hand back the plain { code, message } shape isDomainErrorLike() reads,
    // not a DomainError instance, so no instanceof check downstream can
    // ever rely on surviving the boundary.
    it("returns a plain { code, message } error, not a DomainError instance", async () => {
      const { DomainError } = await import("@/shared/kernel/domain-error");
      const { createNotebook, createPage, saveContent } = await import(
        "./actions"
      );
      const notebook = await createNotebook({ title: "Cuaderno" });
      const page = await createPage({ notebookId: notebook.id });

      const result = await saveContent({
        pageId: page.id,
        expectedVersion: page.contentVersion + 99,
        content: { type: "doc", content: [] },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).not.toBeInstanceOf(DomainError);
        expect(result.error).not.toBeInstanceOf(Error);
        expect(result.error).toEqual({
          code: "PAGE_VERSION_CONFLICT",
          message: expect.any(String),
        });
      }
    });

    it("getCurrentContent returns ok({ content, version }) for the caller's own page", async () => {
      const { createNotebook, createPage, getCurrentContent } = await import(
        "./actions"
      );
      const notebook = await createNotebook({ title: "Cuaderno" });
      const page = await createPage({ notebookId: notebook.id });

      const result = await getCurrentContent(page.id);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.version).toBe(page.contentVersion);
    });

    it("getCurrentContent returns err(NOT_FOUND) instead of throwing for a foreign page", async () => {
      const { getCurrentContent } = await import("./actions");

      const result = await getCurrentContent("does-not-exist");

      expect(result.ok).toBe(false);
      // PR3b review advisory: strengthen this assertion to the exact code
      // instead of only checking result.ok.
      if (!result.ok) expect(result.error.code).toBe("PAGE_NOT_FOUND");
    });

    it("getCurrentContent also returns a plain { code, message } error, not a DomainError instance", async () => {
      const { DomainError } = await import("@/shared/kernel/domain-error");
      const { getCurrentContent } = await import("./actions");

      const result = await getCurrentContent("does-not-exist");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).not.toBeInstanceOf(DomainError);
        expect(result.error).not.toBeInstanceOf(Error);
      }
    });
  });

  // PR3b review advisory: saveContent/getCurrentContent must satisfy the
  // Result-returning SavePagePort contract even without a session, instead
  // of throwing like the other (unwrap()-based) Server Actions in this
  // file — a rejected promise is not a shape use-autosave.ts can reconcile.
  describe("saveContent / getCurrentContent without a session", () => {
    beforeEach(() => {
      getCurrentUser.mockResolvedValue(null);
    });

    it("saveContent returns a Result error instead of throwing", async () => {
      const { saveContent } = await import("./actions");

      const result = await saveContent({
        pageId: "does-not-exist",
        expectedVersion: 1,
        content: { type: "doc", content: [] },
      });

      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error.code).toBe("NOTEBOOKS_SESSION_REQUIRED");
    });

    it("getCurrentContent returns a Result error instead of throwing", async () => {
      const { getCurrentContent } = await import("./actions");

      const result = await getCurrentContent("any-page-id");

      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error.code).toBe("NOTEBOOKS_SESSION_REQUIRED");
    });
  });
});
