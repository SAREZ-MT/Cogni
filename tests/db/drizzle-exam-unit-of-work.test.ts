import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createExamQuestion } from "@/modules/exams/application/create-exam-question";
import { retireExamQuestion } from "@/modules/exams/application/retire-exam-question";
import { newExamQuestion } from "@/modules/exams/domain/exam-question";
import { DrizzleExamUnitOfWork } from "@/modules/exams/infrastructure/drizzle-exam-unit-of-work";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import {
  examQuestions,
  notebooks,
  pages,
  profiles,
  studyItems,
} from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// The exam unit of work against the real database: a root question and its
// study item commit or roll back together, and retiring the root suspends
// its item in the same transaction, even when two connections retire the
// last two questions of one lineage at once.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  // A second connection, so two transactions can really overlap.
  const otherConnection = createTestDb();
  const owner = await createTestOwner("exam-uow-owner");
  const notebookId = randomUUID();
  const pageId = randomUUID();
  const NOW = new Date("2026-10-05T10:00:00.000Z");
  const LATER = new Date("2026-10-06T10:00:00.000Z");

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
    } finally {
      await db.$client.end();
      await otherConnection.$client.end();
    }
  });

  await db.insert(profiles).values({ id: owner.id });
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno de la unidad de trabajo de exámenes",
    position: 1,
  });
  await db.insert(pages).values({
    id: pageId,
    ownerId: owner.id,
    notebookId,
    title: "Mitocondria",
    content: { type: "doc", content: [] },
    position: 1,
  });

  const pagesReader = {
    async getPageText(id: string, ownerId: string) {
      return ownerId === owner.id && id === pageId
        ? ok({ title: "Mitocondria", plainText: "" })
        : err(new DomainError("PAGE_NOT_FOUND", id));
    },
  };

  const CONTENT = {
    pageId,
    stem: "¿Qué produce la mitocondria?",
    options: ["ATP", "ADN", "Lípidos", "Almidón"],
    correctIndex: 0,
    explanation: "",
    concept: "Función de la mitocondria",
  };

  async function itemFor(rootId: string) {
    const [row] = await db
      .select()
      .from(studyItems)
      .where(
        and(
          eq(studyItems.kind, "exam_question"),
          eq(studyItems.sourceId, rootId),
        ),
      );
    return row;
  }

  describe("DrizzleExamUnitOfWork", { timeout: 30_000 }, () => {
    it("persists a manual root question together with its due study item", async () => {
      const result = await createExamQuestion(
        CONTENT,
        {
          pages: pagesReader,
          uow: new DrizzleExamUnitOfWork(db),
          clock: createFixedClock(NOW),
          ids: { next: () => randomUUID() },
        },
        owner.id,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(await itemFor(result.value.id)).toMatchObject({
        ownerId: owner.id,
        pageId,
        dueAt: NOW,
        suspendedAt: null,
      });
    });

    it("rolls the question back when its study item cannot be written", async () => {
      const question = newExamQuestion(
        {
          ...CONTENT,
          id: randomUUID(),
          ownerId: owner.id,
          origin: "manual",
          generationId: null,
        },
        NOW,
      );
      if (!question.ok) throw question.error;
      const item = () =>
        newStudyItem({
          id: randomUUID(),
          ownerId: owner.id,
          pageId,
          kind: "exam_question",
          sourceId: question.value.id,
          now: NOW,
        });

      // The second save breaks unique (kind, source_id) after the question
      // was inserted in the same transaction.
      await expect(
        new DrizzleExamUnitOfWork(db).run(async (repositories) => {
          await repositories.questions.save(question.value);
          await repositories.studyItems.save(item());
          await repositories.studyItems.save(item());
        }),
      ).rejects.toThrow();

      const rows = await db
        .select()
        .from(examQuestions)
        .where(eq(examQuestions.id, question.value.id));
      expect(rows).toEqual([]);
      expect(await itemFor(question.value.id)).toBeUndefined();
    });

    it("retires a root and suspends its item in one transaction, idempotently", async () => {
      const created = await createExamQuestion(
        CONTENT,
        {
          pages: pagesReader,
          uow: new DrizzleExamUnitOfWork(db),
          clock: createFixedClock(NOW),
          ids: { next: () => randomUUID() },
        },
        owner.id,
      );
      if (!created.ok) throw created.error;
      const deps = {
        uow: new DrizzleExamUnitOfWork(db),
        clock: createFixedClock(LATER),
      };

      const retired = await retireExamQuestion(
        { questionId: created.value.id },
        deps,
        owner.id,
      );
      const again = await retireExamQuestion(
        { questionId: created.value.id },
        { ...deps, clock: createFixedClock(new Date("2026-10-07T00:00:00Z")) },
        owner.id,
      );

      expect(retired.ok && retired.value.retiredAt).toEqual(LATER);
      expect(again.ok && again.value.retiredAt).toEqual(LATER);
      expect((await itemFor(created.value.id))?.suspendedAt).toEqual(LATER);
    });

    it("suspends the root's item when two connections retire the lineage's last two questions at once", async () => {
      const created = await createExamQuestion(
        CONTENT,
        {
          pages: pagesReader,
          uow: new DrizzleExamUnitOfWork(db),
          clock: createFixedClock(NOW),
          ids: { next: () => randomUUID() },
        },
        owner.id,
      );
      if (!created.ok) throw created.error;
      const root = created.value;
      const variant = {
        ...root,
        id: randomUUID(),
        stem: "¿Qué molécula produce la mitocondria?",
        variantOf: root.id,
      };
      await db.insert(examQuestions).values({
        ...variant,
        options: [...variant.options],
      });
      // Opens the second connection now, so its transaction does not lag
      // behind the first one while it connects.
      await otherConnection.execute(sql`select 1`);

      // The second connection retires the variant and holds its transaction
      // open; meanwhile the first one retires the root. Without a lineage
      // lock each sees the other's question still active and neither
      // suspends the root's item.
      let release: () => void = () => {};
      const held = new Promise<void>((done) => {
        release = done;
      });
      const variantRetire = otherConnection.transaction(async (tx) => {
        const result = await retireExamQuestion(
          { questionId: variant.id },
          {
            uow: new DrizzleExamUnitOfWork(tx),
            clock: createFixedClock(LATER),
          },
          owner.id,
        );
        await held;
        return result;
      });
      const rootRetire = retireExamQuestion(
        { questionId: root.id },
        { uow: new DrizzleExamUnitOfWork(db), clock: createFixedClock(LATER) },
        owner.id,
      );
      // Gives the root's retire time to finish unless the lock holds it.
      await Promise.race([
        rootRetire,
        new Promise((done) => setTimeout(done, 2_000)),
      ]);
      release();

      const [first, second] = await Promise.all([rootRetire, variantRetire]);
      expect(first.ok && second.ok).toBe(true);
      expect((await itemFor(root.id))?.suspendedAt).toEqual(LATER);
    });
  });
}
