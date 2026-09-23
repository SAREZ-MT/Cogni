import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNotebook } from "@/modules/notebooks/domain/notebook";
import { createPage } from "@/modules/notebooks/domain/page";
// Imported from their concrete files, not the "@/modules/notebooks/
// infrastructure" barrel: that barrel also exports SupabaseStorageGateway,
// which starts with `import "server-only"` — fine under Next's build (only
// resolved from a Server Component/Action graph), but vitest.db.config.ts
// runs with plain Node module resolution, where "server-only" throws
// unconditionally at import time.
import { DrizzleNotebookRepository } from "@/modules/notebooks/infrastructure/drizzle-notebook-repository";
import { DrizzlePageRepository } from "@/modules/notebooks/infrastructure/drizzle-page-repository";
import { profiles } from "@/shared/db/schema";
import { systemClock } from "@/shared/kernel/clock";
import { createTestDb } from "./helpers/test-db";
import {
  createTestOwner,
  deleteTestOwner,
  type TestOwner,
} from "./helpers/test-owner";

// Covers 2.2: create/read/archive a notebook and a page through the
// Drizzle repositories, plus owner_id isolation, against real `cogni-dev`
// Postgres (specs/notebooks/spec.md, "Aislamiento por owner").
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("Drizzle notebook/page repositories", () => {
  let ownerA: TestOwner;
  let ownerB: TestOwner;
  const db = createTestDb();
  const notebookRepo = new DrizzleNotebookRepository(db);
  const pageRepo = new DrizzlePageRepository(db);

  beforeAll(async () => {
    ownerA = await createTestOwner("notebook-repo-a");
    ownerB = await createTestOwner("notebook-repo-b");
    await db.insert(profiles).values([{ id: ownerA.id }, { id: ownerB.id }]);
  });

  afterAll(async () => {
    // profiles/notebooks/pages cascade on delete from auth.users, but the
    // FK direction is profiles -> auth.users, so deleting the auth user
    // cascades into profiles (and from there into notebooks/pages).
    await deleteTestOwner(ownerA.id);
    await deleteTestOwner(ownerB.id);
  });

  it("creates, reads and archives a notebook and a page", async () => {
    const position = await notebookRepo.nextPosition(ownerA.id);
    const notebook = createNotebook(
      {
        id: randomUUID(),
        ownerId: ownerA.id,
        title: "Cuaderno de prueba",
        position,
      },
      systemClock,
    );
    expect(notebook.ok).toBe(true);
    if (!notebook.ok) return;
    await notebookRepo.create(notebook.value);

    const found = await notebookRepo.findById(notebook.value.id);
    expect(found?.title).toBe("Cuaderno de prueba");
    expect(found?.archivedAt).toBeNull();

    const pagePosition = await pageRepo.nextPosition(notebook.value.id);
    const page = createPage(
      {
        id: randomUUID(),
        ownerId: ownerA.id,
        notebookId: notebook.value.id,
        position: pagePosition,
      },
      systemClock,
    );
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    await pageRepo.create(page.value);

    const activePages = await pageRepo.listActiveByNotebook(notebook.value.id);
    expect(activePages.map((p) => p.id)).toEqual([page.value.id]);

    const archivedAt = new Date();
    await notebookRepo.update({
      ...notebook.value,
      archivedAt,
      updatedAt: archivedAt,
    });
    const archivedNotebook = await notebookRepo.findById(notebook.value.id);
    expect(archivedNotebook?.archivedAt).not.toBeNull();

    const activeAfterArchive = await notebookRepo.listActiveByOwner(ownerA.id);
    expect(
      activeAfterArchive.find((n) => n.id === notebook.value.id),
    ).toBeUndefined();
  });

  it("isolates listActiveByOwner by owner_id", async () => {
    const positionA = await notebookRepo.nextPosition(ownerA.id);
    const notebookA = createNotebook(
      {
        id: randomUUID(),
        ownerId: ownerA.id,
        title: "De A",
        position: positionA,
      },
      systemClock,
    );
    const positionB = await notebookRepo.nextPosition(ownerB.id);
    const notebookB = createNotebook(
      {
        id: randomUUID(),
        ownerId: ownerB.id,
        title: "De B",
        position: positionB,
      },
      systemClock,
    );
    if (!notebookA.ok || !notebookB.ok) throw new Error("setup failed");
    await notebookRepo.create(notebookA.value);
    await notebookRepo.create(notebookB.value);

    const listA = await notebookRepo.listActiveByOwner(ownerA.id);
    const listB = await notebookRepo.listActiveByOwner(ownerB.id);
    expect(listA.some((n) => n.id === notebookB.value.id)).toBe(false);
    expect(listB.some((n) => n.id === notebookA.value.id)).toBe(false);
  });

  // T4 review follow-up (R3-archived-toctou): writeImportedContent's write
  // (notebooks/application/write-imported-content.ts) reads the page,
  // checks it is not archived, then calls updateIfVersion. Between those
  // two steps another actor (e.g. the user archiving the page from the
  // sidebar) could archive it. updateIfVersion's conditional UPDATE
  // already filters `archived_at IS NULL` (drizzle-page-repository.ts), so
  // this proves that guard holds against real Postgres, not just the
  // in-memory double: archiving the page directly stands in for that
  // concurrent actor, landing strictly after the page was created with
  // fresh content and strictly before the conditional UPDATE below runs.
  it("updateIfVersion refuses to overwrite a page archived after it was last read (TOCTOU)", async () => {
    const position = await notebookRepo.nextPosition(ownerA.id);
    const notebook = createNotebook(
      {
        id: randomUUID(),
        ownerId: ownerA.id,
        title: "Cuaderno para TOCTOU",
        position,
      },
      systemClock,
    );
    if (!notebook.ok) throw new Error("setup failed");
    await notebookRepo.create(notebook.value);

    const pagePosition = await pageRepo.nextPosition(notebook.value.id);
    const page = createPage(
      {
        id: randomUUID(),
        ownerId: ownerA.id,
        notebookId: notebook.value.id,
        position: pagePosition,
      },
      systemClock,
    );
    if (!page.ok) throw new Error("setup failed");
    await pageRepo.create(page.value);

    await pageRepo.update({ ...page.value, archivedAt: new Date() });

    const result = await pageRepo.updateIfVersion({
      pageId: page.value.id,
      ownerId: ownerA.id,
      expectedVersion: page.value.contentVersion,
      content: { type: "doc", content: [{ type: "text", text: "importado" }] },
      plainText: "importado",
      updatedAt: new Date(),
    });

    // Scoped exactly like a nonexistent/other-owner page: the fallback
    // "current version" report never reveals a real contentVersion for a
    // row the WHERE clause excluded (drizzle-page-repository.ts comment).
    expect(result).toEqual({ updated: false, currentVersion: 0 });
    const stored = await pageRepo.findById(page.value.id);
    expect(stored?.content).toEqual(page.value.content);
    expect(stored?.contentVersion).toBe(page.value.contentVersion);
  });
});
