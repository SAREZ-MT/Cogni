import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleRecallSetDeletion } from "@/modules/active-recall/infrastructure/drizzle-recall-set-deletion";
import { DrizzleExamSetDeletion } from "@/modules/exams/infrastructure/drizzle-exam-set-deletion";
import { DrizzleDeckDeletion } from "@/modules/flashcards/infrastructure/drizzle-deck-deletion";
import { DrizzleContentDeletion } from "@/modules/notebooks/infrastructure/drizzle-content-deletion";
import {
  aiGenerations,
  examAnswers,
  examPageState,
  examQuestions,
  examSessions,
  flashcardSessions,
  flashcards,
  generationFingerprints,
  importJobs,
  notebooks,
  pageAssets,
  pageMastery,
  pages,
  profiles,
  recallAnswers,
  recallQuestions,
  recallSessions,
  reviewLogs,
  sessionFeedback,
  studyItems,
} from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Phase 8 H19: deleting a notebook, a page or one technique's whole set of
// a page is a real delete. Everything below it goes, including the rows
// with no foreign key to their source (study_items, session_feedback), so
// no metric keeps counting deleted items; Storage paths come back for the
// caller to remove after the commit.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("content-deletion-owner");
  const other = await createTestOwner("content-deletion-other");
  const NOW = new Date("2026-10-29T10:00:00.000Z");
  const DUE = new Date("2026-10-30T10:00:00.000Z");
  let position = 1;
  const fingerprint = () => randomUUID().replaceAll("-", "").padEnd(64, "a");

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
      await deleteTestOwner(other.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values([{ id: owner.id }, { id: other.id }]);

  async function newNotebook(ownerId = owner.id): Promise<string> {
    const id = randomUUID();
    await db.insert(notebooks).values({
      id,
      ownerId,
      title: `Cuaderno ${id}`,
      position: position++,
    });
    return id;
  }

  async function newPage(
    notebookId: string,
    ownerId = owner.id,
  ): Promise<string> {
    const id = randomUUID();
    await db.insert(pages).values({
      id,
      ownerId,
      notebookId,
      title: `Página ${id}`,
      content: { type: "doc", content: [] },
      position: position++,
    });
    return id;
  }

  async function studyItem(
    pageId: string,
    kind: "flashcard" | "exam_question" | "recall_question",
    sourceId: string,
    sessionKind: "flashcards" | "exam" | "recall",
    sessionId: string,
  ): Promise<string> {
    const id = randomUUID();
    await db.insert(studyItems).values({
      id,
      ownerId: owner.id,
      pageId,
      kind,
      sourceId,
      dueAt: DUE,
      intervalDays: 6,
      lastQuality: 4,
    });
    await db.insert(reviewLogs).values({
      id: randomUUID(),
      ownerId: owner.id,
      itemId: id,
      quality: 4,
      reviewedAt: NOW,
      intervalBefore: 1,
      intervalAfter: 6,
      easinessAfter: 2.5,
      sessionKind,
      sessionId,
    });
    return id;
  }

  async function feedback(
    sessionKind: "flashcards" | "exam" | "recall",
    sessionId: string,
  ) {
    await db.insert(sessionFeedback).values({
      id: randomUUID(),
      ownerId: owner.id,
      sessionKind,
      sessionId,
    });
  }

  // Two cards (one archived), each with its study item and a review, a
  // finished review session with its feedback, and the deck's fingerprint.
  async function seedDeck(pageId: string) {
    const sessionId = randomUUID();
    await db.insert(flashcardSessions).values({
      id: sessionId,
      ownerId: owner.id,
      pageId,
      startedAt: NOW,
      finishedAt: NOW,
      reviewedCount: 2,
    });
    await feedback("flashcards", sessionId);
    for (const [index, archivedAt] of [null, NOW].entries()) {
      const id = randomUUID();
      await db.insert(flashcards).values({
        id,
        ownerId: owner.id,
        pageId,
        front: `Frente ${index}`,
        back: `Dorso ${index}`,
        origin: "ai",
        position: index + 1,
        archivedAt,
      });
      await studyItem(pageId, "flashcard", id, "flashcards", sessionId);
    }
    await db.insert(generationFingerprints).values({
      ownerId: owner.id,
      pageId,
      technique: "flashcards",
      fingerprint: fingerprint(),
    });
  }

  async function seedRecall(pageId: string) {
    const questionId = randomUUID();
    await db.insert(recallQuestions).values({
      id: questionId,
      ownerId: owner.id,
      pageId,
      prompt: "¿Qué es?",
      rubric: { keyConcepts: ["Idea"], acceptableAnswerSummary: "Resumen" },
      origin: "manual",
    });
    const sessionId = randomUUID();
    await db.insert(recallSessions).values({
      id: sessionId,
      ownerId: owner.id,
      pageId,
      startedAt: NOW,
      finishedAt: NOW,
      evaluationStatus: "done",
    });
    await db.insert(recallAnswers).values({
      id: randomUUID(),
      ownerId: owner.id,
      sessionId,
      questionId,
      answerText: "Respuesta",
      selfRating: 3,
    });
    await feedback("recall", sessionId);
    await studyItem(pageId, "recall_question", questionId, "recall", sessionId);
    await db.insert(generationFingerprints).values({
      ownerId: owner.id,
      pageId,
      technique: "recall",
      fingerprint: fingerprint(),
    });
  }

  async function seedExam(pageId: string) {
    const questionId = randomUUID();
    await db.insert(examQuestions).values({
      id: questionId,
      ownerId: owner.id,
      pageId,
      stem: "¿Cuál?",
      options: ["Opción A", "Opción B", "Opción C", "Opción D"],
      correctIndex: 0,
      explanation: "Porque sí.",
      concept: "Concepto",
      rootId: questionId,
      origin: "manual",
    });
    const sessionId = randomUUID();
    await db.insert(examSessions).values({
      id: sessionId,
      ownerId: owner.id,
      pageId,
      requestedCount: 10,
      questionIds: [questionId],
      startedAt: NOW,
      finishedAt: NOW,
      total: 1,
      correct: 1,
      score: 1,
      passed: true,
    });
    await db.insert(examAnswers).values({
      ownerId: owner.id,
      sessionId,
      questionId,
      rootId: questionId,
      selectedIndex: 0,
      isCorrect: true,
      answeredAt: NOW,
    });
    await db.insert(examPageState).values({
      pageId,
      ownerId: owner.id,
      retakePending: false,
      failedRootIds: [],
      lastPassedSessionId: sessionId,
    });
    await feedback("exam", sessionId);
    await studyItem(pageId, "exam_question", questionId, "exam", sessionId);
    await db.insert(generationFingerprints).values({
      ownerId: owner.id,
      pageId,
      technique: "exam",
      fingerprint: fingerprint(),
    });
  }

  async function seedPage(notebookId: string) {
    const pageId = await newPage(notebookId);
    await seedDeck(pageId);
    await seedRecall(pageId);
    await seedExam(pageId);
    await db.insert(pageMastery).values({
      id: randomUUID(),
      ownerId: owner.id,
      pageId,
      level: "Consolidando",
      score: 0.5,
      itemsTotal: 4,
      itemsDue: 0,
      computedAt: NOW,
    });
    const assetPath = `${owner.id}/${pageId}/${randomUUID()}.png`;
    await db.insert(pageAssets).values({
      id: randomUUID(),
      ownerId: owner.id,
      pageId,
      storagePath: assetPath,
      mime: "image/png",
      sizeBytes: 10,
    });
    const importPath = `${owner.id}/${randomUUID()}.pdf`;
    await db.insert(importJobs).values({
      id: randomUUID(),
      ownerId: owner.id,
      pageId,
      storagePath: importPath,
      fileName: "apuntes.pdf",
      sizeBytes: 10,
      status: "done",
    });
    const generationId = randomUUID();
    await db.insert(aiGenerations).values({
      id: generationId,
      ownerId: owner.id,
      pageId,
      purpose: "generate_flashcards",
      provider: "fake",
      model: "fake",
      promptVersion: "v1",
      status: "done",
    });
    return { pageId, assetPath, importPath, generationId };
  }

  const ofPage = async (pageId: string) => ({
    flashcards: (
      await db.select().from(flashcards).where(eq(flashcards.pageId, pageId))
    ).length,
    recallQuestions: (
      await db
        .select()
        .from(recallQuestions)
        .where(eq(recallQuestions.pageId, pageId))
    ).length,
    examQuestions: (
      await db
        .select()
        .from(examQuestions)
        .where(eq(examQuestions.pageId, pageId))
    ).length,
    items: (
      await db.select().from(studyItems).where(eq(studyItems.pageId, pageId))
    ).map((item) => item.kind),
    fingerprints: (
      await db
        .select()
        .from(generationFingerprints)
        .where(eq(generationFingerprints.pageId, pageId))
    ).map((row) => row.technique),
    flashcardSessions: (
      await db
        .select()
        .from(flashcardSessions)
        .where(eq(flashcardSessions.pageId, pageId))
    ).length,
    recallSessions: (
      await db
        .select()
        .from(recallSessions)
        .where(eq(recallSessions.pageId, pageId))
    ).length,
    examSessions: (
      await db
        .select()
        .from(examSessions)
        .where(eq(examSessions.pageId, pageId))
    ).length,
    examState: (
      await db
        .select()
        .from(examPageState)
        .where(eq(examPageState.pageId, pageId))
    ).length,
    mastery: (
      await db.select().from(pageMastery).where(eq(pageMastery.pageId, pageId))
    )[0],
  });

  const feedbackKinds = async () =>
    (
      await db
        .select()
        .from(sessionFeedback)
        .where(eq(sessionFeedback.ownerId, owner.id))
    ).map((row) => row.sessionKind);

  const logsOfOwner = async () =>
    (
      await db.select().from(reviewLogs).where(eq(reviewLogs.ownerId, owner.id))
    ).map((row) => row.sessionKind);

  describe("technique set deletes on the database", { timeout: 60_000 }, () => {
    it("previews and deletes a page's whole deck, leaving its other techniques", async () => {
      const notebookId = await newNotebook();
      const { pageId } = await seedPage(notebookId);
      const deletion = new DrizzleDeckDeletion(db);

      expect(await deletion.preview(pageId, owner.id)).toEqual({
        cards: 1,
        reviews: 2,
      });
      expect(await deletion.preview(pageId, other.id)).toBeNull();
      expect(await deletion.delete(pageId, other.id, NOW)).toBe(false);

      expect(await deletion.delete(pageId, owner.id, NOW)).toBe(true);

      const left = await ofPage(pageId);
      expect(left.flashcards).toBe(0);
      expect(left.flashcardSessions).toBe(0);
      expect(left.items.sort()).toEqual(["exam_question", "recall_question"]);
      expect(left.fingerprints.sort()).toEqual(["exam", "recall"]);
      expect(left.recallQuestions).toBe(1);
      expect(left.examQuestions).toBe(1);
      // Rewritten from the two items left (interval 6, last quality 4).
      expect(left.mastery?.itemsTotal).toBe(2);
      expect(left.mastery?.computedAt).toEqual(NOW);
      expect(await feedbackKinds()).not.toContain("flashcards");
      expect(await logsOfOwner()).not.toContain("flashcards");
    });

    it("previews and deletes a page's recall set: questions, sessions, answers, items", async () => {
      const notebookId = await newNotebook();
      const { pageId } = await seedPage(notebookId);
      const deletion = new DrizzleRecallSetDeletion(db);

      expect(await deletion.preview(pageId, owner.id)).toEqual({
        questions: 1,
        sessions: 1,
      });
      expect(await deletion.preview(pageId, other.id)).toBeNull();
      expect(await deletion.delete(pageId, owner.id, NOW)).toBe(true);

      const left = await ofPage(pageId);
      expect(left.recallQuestions).toBe(0);
      expect(left.recallSessions).toBe(0);
      expect(left.items.sort()).toEqual([
        "exam_question",
        "flashcard",
        "flashcard",
      ]);
      expect(left.fingerprints.sort()).toEqual(["exam", "flashcards"]);
      expect(left.mastery?.itemsTotal).toBe(3);
      const answers = await db
        .select()
        .from(recallAnswers)
        .where(eq(recallAnswers.ownerId, owner.id));
      const sessionsLeft = await db
        .select({ id: recallSessions.id })
        .from(recallSessions)
        .where(eq(recallSessions.ownerId, owner.id));
      expect(
        answers.every((a) => sessionsLeft.some((s) => s.id === a.sessionId)),
      ).toBe(true);
    });

    it("previews and deletes a page's exam set: questions, attempts, answers, page state", async () => {
      const notebookId = await newNotebook();
      const { pageId } = await seedPage(notebookId);
      const deletion = new DrizzleExamSetDeletion(db);

      expect(await deletion.preview(pageId, owner.id)).toEqual({
        questions: 1,
        attempts: 1,
      });
      expect(await deletion.preview(pageId, other.id)).toBeNull();
      expect(await deletion.delete(pageId, owner.id, NOW)).toBe(true);

      const left = await ofPage(pageId);
      expect(left.examQuestions).toBe(0);
      expect(left.examSessions).toBe(0);
      expect(left.examState).toBe(0);
      expect(left.items.sort()).toEqual([
        "flashcard",
        "flashcard",
        "recall_question",
      ]);
      expect(left.fingerprints.sort()).toEqual(["flashcards", "recall"]);
    });

    it("drops the page's mastery once its last set is gone", async () => {
      const notebookId = await newNotebook();
      const { pageId } = await seedPage(notebookId);
      await new DrizzleDeckDeletion(db).delete(pageId, owner.id, NOW);
      await new DrizzleRecallSetDeletion(db).delete(pageId, owner.id, NOW);
      await new DrizzleExamSetDeletion(db).delete(pageId, owner.id, NOW);

      const left = await ofPage(pageId);
      expect(left.items).toEqual([]);
      expect(left.mastery).toBeUndefined();
    });
  });

  describe(
    "page and notebook deletes on the database",
    { timeout: 60_000 },
    () => {
      it("previews a page and deletes it with everything below it", async () => {
        const notebookId = await newNotebook();
        const kept = await seedPage(notebookId);
        const gone = await seedPage(notebookId);
        const deletion = new DrizzleContentDeletion(db);

        expect(await deletion.previewPage(gone.pageId, owner.id)).toEqual({
          flashcards: 1,
          recallQuestions: 1,
          examQuestions: 1,
          images: 1,
        });
        expect(await deletion.previewPage(gone.pageId, other.id)).toBeNull();
        expect(await deletion.deletePage(gone.pageId, other.id)).toBeNull();

        const files = await deletion.deletePage(gone.pageId, owner.id);
        expect(files).toEqual({
          assetPaths: [gone.assetPath],
          importPaths: [gone.importPath],
        });

        expect(
          await db.select().from(pages).where(eq(pages.id, gone.pageId)),
        ).toEqual([]);
        const left = await ofPage(gone.pageId);
        expect(left.items).toEqual([]);
        expect(
          left.flashcardSessions + left.recallSessions + left.examSessions,
        ).toBe(0);
        // The generation row stays for the daily AI quota, unlinked.
        const [generation] = await db
          .select()
          .from(aiGenerations)
          .where(eq(aiGenerations.id, gone.generationId));
        expect(generation?.pageId).toBeNull();
        // The kept page and its feedback are untouched.
        expect((await ofPage(kept.pageId)).items).toHaveLength(4);
        const keptSessions = [
          ...(await db
            .select({ id: flashcardSessions.id })
            .from(flashcardSessions)
            .where(eq(flashcardSessions.pageId, kept.pageId))),
          ...(await db
            .select({ id: recallSessions.id })
            .from(recallSessions)
            .where(eq(recallSessions.pageId, kept.pageId))),
          ...(await db
            .select({ id: examSessions.id })
            .from(examSessions)
            .where(eq(examSessions.pageId, kept.pageId))),
        ].map((row) => row.id);
        const ownerFeedback = await db
          .select()
          .from(sessionFeedback)
          .where(eq(sessionFeedback.ownerId, owner.id));
        expect(
          ownerFeedback.filter((row) => keptSessions.includes(row.sessionId)),
        ).toHaveLength(3);
      });

      it("previews a notebook and deletes it with its pages and their feedback", async () => {
        const notebookId = await newNotebook();
        const first = await seedPage(notebookId);
        const second = await seedPage(notebookId);
        const empty = await newPage(notebookId);
        // An archived page counts nowhere in the preview but is deleted too.
        const archived = await newPage(notebookId);
        await db
          .update(pages)
          .set({ archivedAt: NOW })
          .where(eq(pages.id, archived));
        const deletion = new DrizzleContentDeletion(db);

        expect(await deletion.previewNotebook(notebookId, owner.id)).toEqual({
          pages: 3,
          decks: 2,
          recallSets: 2,
          examSets: 2,
        });
        expect(await deletion.previewNotebook(notebookId, other.id)).toBeNull();
        expect(await deletion.deleteNotebook(notebookId, other.id)).toBeNull();

        const sessionIds = [
          ...(await db
            .select({ id: flashcardSessions.id })
            .from(flashcardSessions)
            .where(
              inArray(flashcardSessions.pageId, [first.pageId, second.pageId]),
            )),
        ].map((row) => row.id);

        const files = await deletion.deleteNotebook(notebookId, owner.id);
        expect(files?.assetPaths.sort()).toEqual(
          [first.assetPath, second.assetPath].sort(),
        );
        expect(files?.importPaths.sort()).toEqual(
          [first.importPath, second.importPath].sort(),
        );

        expect(
          await db.select().from(notebooks).where(eq(notebooks.id, notebookId)),
        ).toEqual([]);
        expect(
          await db
            .select()
            .from(pages)
            .where(
              inArray(pages.id, [first.pageId, second.pageId, empty, archived]),
            ),
        ).toEqual([]);
        expect(
          await db
            .select()
            .from(sessionFeedback)
            .where(
              and(
                eq(sessionFeedback.ownerId, owner.id),
                inArray(sessionFeedback.sessionId, sessionIds),
              ),
            ),
        ).toEqual([]);
      });
    },
  );
}
