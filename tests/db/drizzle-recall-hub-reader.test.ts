import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleRecallHubReader } from "@/modules/active-recall/infrastructure";
import { createPageMasteryReader } from "@/modules/study-engine";
import {
  notebooks,
  pageMastery,
  pages,
  profiles,
  recallAnswers,
  recallQuestions,
  recallSessions,
} from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// The active recall hub reader against Postgres (Phase 6 T7, Phase 8 H16):
// pages with active recall questions or a finished session holding
// answers, their finished sessions newest first with the answers' scores,
// owner scoping, archived pages and notebooks left out.
// Also study-engine's page mastery reader the hub averages.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("recall-hub-owner");
  const otherOwner = await createTestOwner("recall-hub-other");
  const T0 = new Date("2026-10-07T10:00:00.000Z");
  const MIN = 60_000;
  let nextPosition = 1;

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
      await deleteTestOwner(otherOwner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values([{ id: owner.id }, { id: otherOwner.id }]);

  async function newNotebook(title: string, ownerId = owner.id) {
    const id = randomUUID();
    await db.insert(notebooks).values({
      id,
      ownerId,
      title,
      color: "green",
      position: nextPosition++,
    });
    return id;
  }

  async function newPage(
    notebookId: string,
    title: string,
    ownerId = owner.id,
  ) {
    const id = randomUUID();
    await db.insert(pages).values({
      id,
      ownerId,
      notebookId,
      title,
      content: { type: "doc", content: [] },
      position: nextPosition++,
    });
    return id;
  }

  async function newQuestion(pageId: string, ownerId = owner.id) {
    const id = randomUUID();
    await db.insert(recallQuestions).values({
      id,
      ownerId,
      pageId,
      prompt: "¿Qué produce la mitocondria?",
      rubric: { keyConcepts: ["ATP"], acceptableAnswerSummary: "ATP." },
      origin: "manual",
    });
    return id;
  }

  // A session started at T0 + `startedMin`, finished `finishedMin` later
  // (null: still open), with one answer per [aiScore, combined] pair
  // (null: pending).
  async function newSession(
    pageId: string,
    startedMin: number,
    finishedMin: number | null,
    scores: [number | null, number | null][],
    ownerId = owner.id,
  ) {
    const id = randomUUID();
    const startedAt = new Date(T0.getTime() + startedMin * MIN);
    await db.insert(recallSessions).values({
      id,
      ownerId,
      pageId,
      startedAt,
      finishedAt:
        finishedMin === null
          ? null
          : new Date(startedAt.getTime() + finishedMin * MIN),
      evaluationStatus: "pending",
    });
    for (const [aiScore, combinedQuality] of scores) {
      const questionId = await newQuestion(pageId, ownerId);
      await db.insert(recallAnswers).values({
        id: randomUUID(),
        ownerId,
        sessionId: id,
        questionId,
        answerText: "ATP",
        selfRating: 3,
        ...(aiScore === null
          ? { evaluationStatus: "pending" as const }
          : {
              evaluationStatus: "done" as const,
              aiEvaluation: { score: aiScore },
              aiScore,
              combinedQuality,
            }),
      });
    }
    return id;
  }

  // Notebook "B …" sorts after "A …"; inside A, "Membrana" before
  // "Mitocondria".
  const nbA = await newNotebook("A biología celular");
  const nbB = await newNotebook("B cálculo");
  const mitocondria = await newPage(nbA, "Mitocondria");
  const membrana = await newPage(nbA, "Membrana");
  const derivadas = await newPage(nbB, "Derivadas");
  const sinSesiones = await newPage(nbA, "Sin sesiones");
  const soloAbierta = await newPage(nbA, "Solo abierta");
  const archivada = await newPage(nbA, "Archivada");
  const soloRetiradas = await newPage(nbA, "Solo retiradas");
  const nbArchived = await newNotebook("A archivado");
  const enArchivado = await newPage(nbArchived, "En cuaderno archivado");
  const nbOther = await newNotebook("A ajeno", otherOwner.id);
  const ajena = await newPage(nbOther, "Ajena", otherOwner.id);

  const older = await newSession(mitocondria, 0, 5, [
    [5, 4],
    [1, 1],
  ]);
  const newer = await newSession(mitocondria, 60, 5, [
    [3, 3],
    [null, null],
    [0, 0],
  ]);
  // Open sessions and finished sessions without answers are left out.
  await newSession(mitocondria, 120, null, [[4, 4]]);
  await newSession(mitocondria, 180, 1, []);
  const membranaSession = await newSession(membrana, 30, 2, [[4, 5]]);
  const derivadasSession = await newSession(derivadas, 10, 2, [[2, 2]]);
  await newQuestion(sinSesiones);
  await newSession(soloAbierta, 0, null, [[5, 5]]);
  // A finished session keeps its page listed after its questions were
  // archived; a page holding only archived questions is left out.
  await db
    .update(recallQuestions)
    .set({ archivedAt: T0 })
    .where(eq(recallQuestions.pageId, membrana));
  await newQuestion(soloRetiradas);
  await db
    .update(recallQuestions)
    .set({ archivedAt: T0 })
    .where(eq(recallQuestions.pageId, soloRetiradas));
  await newSession(archivada, 0, 1, [[5, 5]]);
  await db.update(pages).set({ archivedAt: T0 }).where(eq(pages.id, archivada));
  await newSession(enArchivado, 0, 1, [[5, 5]]);
  await db
    .update(notebooks)
    .set({ archivedAt: T0 })
    .where(eq(notebooks.id, nbArchived));
  await newSession(ajena, 0, 1, [[5, 5]], otherOwner.id);

  describe("DrizzleRecallHubReader", { timeout: 20_000 }, () => {
    const reader = new DrizzleRecallHubReader(db);

    it("lists the owner's pages with finished sessions, newest first, with their answers' scores", async () => {
      const listed = await reader.listRecallPages(owner.id);

      expect(listed.map((page) => page.pageTitle)).toEqual([
        "Membrana",
        "Mitocondria",
        "Sin sesiones",
        "Solo abierta",
        "Derivadas",
      ]);
      const [membranaRow, mitocondriaRow, , , derivadasRow] = listed;
      expect(membranaRow).toMatchObject({
        pageId: membrana,
        notebookId: nbA,
        notebookTitle: "A biología celular",
        notebookColor: "green",
      });
      expect(membranaRow?.sessions.map((s) => s.id)).toEqual([membranaSession]);
      expect(mitocondriaRow?.sessions.map((s) => s.id)).toEqual([newer, older]);
      expect(mitocondriaRow?.sessions[0]?.finishedAt).toEqual(
        new Date(T0.getTime() + 65 * MIN),
      );
      expect(
        [...(mitocondriaRow?.sessions[0]?.answers ?? [])].sort(
          (a, b) => (a.aiScore ?? -1) - (b.aiScore ?? -1),
        ),
      ).toEqual([
        { aiScore: null, combinedQuality: null },
        { aiScore: 0, combinedQuality: 0 },
        { aiScore: 3, combinedQuality: 3 },
      ]);
      expect(derivadasRow?.sessions.map((s) => s.id)).toEqual([
        derivadasSession,
      ]);
    });

    // Phase 8 H16: questions generated from a hub and an abandoned session
    // must not leave the page out of the recall screens.
    it("lists pages with recall questions and no finished session, without sessions", async () => {
      const listed = await reader.listRecallPages(owner.id);

      expect(listed.find((page) => page.pageId === sinSesiones)).toEqual({
        pageId: sinSesiones,
        pageTitle: "Sin sesiones",
        notebookId: nbA,
        notebookTitle: "A biología celular",
        notebookColor: "green",
        sessions: [],
      });
      expect(
        listed.find((page) => page.pageId === soloAbierta)?.sessions,
      ).toEqual([]);
    });

    it("never lists another owner's pages", async () => {
      const listed = await reader.listRecallPages(otherOwner.id);

      expect(listed.map((page) => page.pageId)).toEqual([ajena]);
    });

    it("lists nothing for an owner without sessions", async () => {
      expect(await reader.listRecallPages(randomUUID())).toEqual([]);
    });
  });

  describe("createPageMasteryReader", { timeout: 20_000 }, () => {
    it("reads the owner's page mastery rows only", async () => {
      await db.insert(pageMastery).values([
        {
          id: randomUUID(),
          ownerId: owner.id,
          pageId: mitocondria,
          level: "Consolidando",
          score: 0.5,
          itemsTotal: 4,
          itemsDue: 1,
          computedAt: T0,
        },
        {
          id: randomUUID(),
          ownerId: otherOwner.id,
          pageId: ajena,
          level: "Dominado",
          score: 0.9,
          itemsTotal: 1,
          itemsDue: 0,
          computedAt: T0,
        },
      ]);

      const rows = await createPageMasteryReader(db).listByOwner(owner.id);

      expect(rows.map((row) => [row.pageId, row.score])).toEqual([
        [mitocondria, 0.5],
      ]);
    });
  });
}
