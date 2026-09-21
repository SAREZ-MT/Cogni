import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNotebook } from "@/modules/notebooks/domain/notebook";
import { createPage } from "@/modules/notebooks/domain/page";
import {
  DrizzleNotebookRepository,
  DrizzlePageRepository,
} from "@/modules/notebooks/infrastructure";
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
});
