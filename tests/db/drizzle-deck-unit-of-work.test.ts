import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { applyDeckEdits } from "@/modules/flashcards/application/apply-deck-edits";
import { archiveFlashcard } from "@/modules/flashcards/application/archive-flashcard";
import { createManualFlashcard } from "@/modules/flashcards/application/create-manual-flashcard";
import { FLASHCARD_ERROR } from "@/modules/flashcards/domain/errors";
import { createFlashcard } from "@/modules/flashcards/domain/flashcard";
import { DrizzleDeckUnitOfWork } from "@/modules/flashcards/infrastructure/drizzle-deck-unit-of-work";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import {
  flashcards,
  generationFingerprints,
  notebooks,
  pages,
  profiles,
  reviewLogs,
  studyItems,
} from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// The deck unit of work against the real database: a card and its study
// item commit or roll back together, and the deck lock keeps "a deck is
// never empty" under two concurrent connections.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  // A second connection, so two transactions can really overlap.
  const otherConnection = createTestDb();
  const owner = await createTestOwner("deck-uow-owner");
  const notebookId = randomUUID();
  let nextPagePosition = 1;
  const NOW = new Date("2026-10-04T10:00:00.000Z");

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
    title: "Cuaderno de la unidad de trabajo del mazo",
    position: 1,
  });

  async function newPage(): Promise<string> {
    const id = randomUUID();
    await db.insert(pages).values({
      id,
      ownerId: owner.id,
      notebookId,
      title: `Página ${id}`,
      content: { type: "doc", content: [] },
      position: nextPagePosition++,
    });
    return id;
  }

  const pagesReader = {
    async getPageText(pageId: string, ownerId: string) {
      return ownerId === owner.id
        ? ok({ title: "Página", plainText: "" })
        : err(new DomainError("PAGE_NOT_FOUND", pageId));
    },
  };

  function createDeps(executor = db) {
    return {
      pages: pagesReader,
      deck: new DrizzleDeckUnitOfWork(executor),
      clock: createFixedClock(NOW),
      ids: { next: () => randomUUID() },
    };
  }

  async function itemFor(cardId: string) {
    const [row] = await db
      .select()
      .from(studyItems)
      .where(
        and(eq(studyItems.kind, "flashcard"), eq(studyItems.sourceId, cardId)),
      );
    return row;
  }

  // Each case runs several transactions against the remote database.
  describe("DrizzleDeckUnitOfWork", { timeout: 30_000 }, () => {
    it("persists a manual card together with its due study item", async () => {
      const pageId = await newPage();

      const result = await createManualFlashcard(
        { pageId, front: "Frente", back: "Reverso" },
        createDeps(),
        owner.id,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const item = await itemFor(result.value.id);
      expect(item).toMatchObject({
        ownerId: owner.id,
        pageId,
        repetitions: 0,
        intervalDays: 0,
        easiness: 2.5,
        dueAt: NOW,
        suspendedAt: null,
      });
    });

    it("rolls the card back when its study item cannot be written", async () => {
      const pageId = await newPage();
      const card = createFlashcard(
        {
          id: randomUUID(),
          ownerId: owner.id,
          pageId,
          generationId: null,
          front: "Frente",
          back: "Reverso",
          origin: "manual",
          position: 0,
        },
        NOW,
      );
      if (!card.ok) throw card.error;
      const item = (id: string) =>
        newStudyItem({
          id,
          ownerId: owner.id,
          pageId,
          kind: "flashcard",
          sourceId: card.value.id,
          now: NOW,
        });

      // The second save breaks unique (kind, source_id) after the card
      // was inserted in the same transaction.
      await expect(
        new DrizzleDeckUnitOfWork(db).run(async (repositories) => {
          await repositories.flashcards.insertMany([card.value]);
          await repositories.fingerprints.addMany({
            ownerId: owner.id,
            pageId,
            fingerprints: ["f".repeat(64)],
            now: NOW,
          });
          await repositories.studyItems.save(item(randomUUID()));
          await repositories.studyItems.save(item(randomUUID()));
        }),
      ).rejects.toThrow();

      const cards = await db
        .select()
        .from(flashcards)
        .where(eq(flashcards.id, card.value.id));
      expect(cards).toEqual([]);
      expect(await itemFor(card.value.id)).toBeUndefined();
      // The generation's paragraph fingerprints roll back with the cards.
      expect(
        await db
          .select()
          .from(generationFingerprints)
          .where(eq(generationFingerprints.pageId, pageId)),
      ).toEqual([]);
    });

    it("archives a card and suspends its item, then refuses the last card", async () => {
      const pageId = await newPage();
      const deps = createDeps();
      const first = await createManualFlashcard(
        { pageId, front: "Uno", back: "1" },
        deps,
        owner.id,
      );
      const second = await createManualFlashcard(
        { pageId, front: "Dos", back: "2" },
        deps,
        owner.id,
      );
      if (!first.ok || !second.ok) throw new Error("seed failed");

      const archived = await archiveFlashcard(
        { flashcardId: second.value.id },
        deps,
        owner.id,
      );
      const refused = await archiveFlashcard(
        { flashcardId: first.value.id },
        deps,
        owner.id,
      );

      expect(archived).toEqual({ ok: true, value: { pageId, remaining: 1 } });
      expect((await itemFor(second.value.id))?.suspendedAt).toEqual(NOW);
      expect(!refused.ok && refused.error.code).toBe(FLASHCARD_ERROR.LAST_CARD);
      expect((await itemFor(first.value.id))?.suspendedAt).toBeNull();
      const [row] = await db
        .select()
        .from(flashcards)
        .where(eq(flashcards.id, first.value.id));
      expect(row?.archivedAt).toBeNull();
    });

    it("never empties a deck when two connections archive its two cards at once", async () => {
      const pageId = await newPage();
      const deps = createDeps();
      const a = await createManualFlashcard(
        { pageId, front: "A", back: "a" },
        deps,
        owner.id,
      );
      const b = await createManualFlashcard(
        { pageId, front: "B", back: "b" },
        deps,
        owner.id,
      );
      if (!a.ok || !b.ok) throw new Error("seed failed");

      const results = await Promise.all([
        archiveFlashcard({ flashcardId: a.value.id }, createDeps(db), owner.id),
        archiveFlashcard(
          { flashcardId: b.value.id },
          createDeps(otherConnection),
          owner.id,
        ),
      ]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      const refused = results.find((result) => !result.ok);
      expect(refused && !refused.ok && refused.error.code).toBe(
        FLASHCARD_ERROR.LAST_CARD,
      );
    });

    // Phase 8 H18: the edit page saves its whole draft in one transaction;
    // a deleted card takes its study item and review history with it.
    describe("applyDeckEdits", () => {
      async function seedCard(pageId: string, front: string) {
        const created = await createManualFlashcard(
          { pageId, front, back: `${front} reverso` },
          createDeps(),
          owner.id,
        );
        if (!created.ok) throw new Error("seed failed");
        const item = await itemFor(created.value.id);
        if (!item) throw new Error("no study item");
        await db.insert(reviewLogs).values({
          id: randomUUID(),
          ownerId: owner.id,
          itemId: item.id,
          quality: 4,
          reviewedAt: NOW,
          intervalBefore: 0,
          intervalAfter: 1,
          easinessAfter: 2.5,
          sessionKind: "flashcards",
          sessionId: randomUUID(),
        });
        return { card: created.value, item };
      }

      it("edits, adds and deletes for real: the deleted card's item and logs are gone", async () => {
        const pageId = await newPage();
        const kept = await seedCard(pageId, "Queda");
        const gone = await seedCard(pageId, "Se va");

        const result = await applyDeckEdits(
          {
            pageId,
            updates: [{ id: kept.card.id, front: "Queda editada", back: "r" }],
            creates: [{ front: "Nueva", back: "n" }],
            deletes: [gone.card.id],
          },
          createDeps(),
          owner.id,
        );

        expect(result.ok && result.value.cards.map((c) => c.front)).toEqual([
          "Queda editada",
          "Nueva",
        ]);
        const goneRows = await db
          .select()
          .from(flashcards)
          .where(eq(flashcards.id, gone.card.id));
        expect(goneRows).toHaveLength(0);
        expect(await itemFor(gone.card.id)).toBeUndefined();
        const goneLogs = await db
          .select()
          .from(reviewLogs)
          .where(eq(reviewLogs.itemId, gone.item.id));
        expect(goneLogs).toHaveLength(0);
        const keptLogs = await db
          .select()
          .from(reviewLogs)
          .where(eq(reviewLogs.itemId, kept.item.id));
        expect(keptLogs).toHaveLength(1);
        expect((await itemFor(kept.card.id))?.id).toBe(kept.item.id);
      });

      it("rolls the whole save back when a deletion would empty the deck", async () => {
        const pageId = await newPage();
        const only = await seedCard(pageId, "Única");

        const result = await applyDeckEdits(
          {
            pageId,
            updates: [{ id: only.card.id, front: "Cambiada", back: "r" }],
            creates: [],
            deletes: [only.card.id],
          },
          createDeps(),
          owner.id,
        );

        expect(!result.ok && result.error.code).toBe(FLASHCARD_ERROR.LAST_CARD);
        const [row] = await db
          .select()
          .from(flashcards)
          .where(eq(flashcards.id, only.card.id));
        expect(row?.front).toBe("Única");
        expect(await itemFor(only.card.id)).toBeDefined();
      });
    });
  });
}
