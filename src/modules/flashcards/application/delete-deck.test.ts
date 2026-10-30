import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { FLASHCARD_ERROR } from "../domain/errors";
import type { DeckDeletion, DeckDeletionPreview } from "./deck-deletion";
import { deleteDeck, previewDeckDeletion } from "./delete-deck";

const OWNER = "owner-1";
const PAGE = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-10-29T10:00:00.000Z");

// A page owned by OWNER holding a deck of 3 cards reviewed 5 times.
function fakeDeletion(): DeckDeletion & {
  deleted: Array<{ pageId: string; ownerId: string; now: Date }>;
} {
  const deleted: Array<{ pageId: string; ownerId: string; now: Date }> = [];
  const owns = (pageId: string, ownerId: string) =>
    pageId === PAGE && ownerId === OWNER;
  return {
    deleted,
    async preview(pageId, ownerId): Promise<DeckDeletionPreview | null> {
      return owns(pageId, ownerId) ? { cards: 3, reviews: 5 } : null;
    },
    async delete(pageId, ownerId, now) {
      if (!owns(pageId, ownerId)) return false;
      deleted.push({ pageId, ownerId, now });
      return true;
    },
  };
}

describe("deleteDeck (Phase 8 H19: a real delete of the page's deck)", () => {
  it("previews the cards and reviews the delete removes", async () => {
    const result = await previewDeckDeletion(
      { pageId: PAGE },
      { deletion: fakeDeletion() },
      OWNER,
    );
    expect(result).toEqual({ ok: true, value: { cards: 3, reviews: 5 } });
  });

  it("deletes the whole deck of an owned page at the clock's instant", async () => {
    const deletion = fakeDeletion();
    const result = await deleteDeck(
      { pageId: PAGE },
      { deletion, clock: createFixedClock(NOW) },
      OWNER,
    );
    expect(result.ok).toBe(true);
    expect(deletion.deleted).toEqual([
      { pageId: PAGE, ownerId: OWNER, now: NOW },
    ]);
  });

  it("answers not found for a foreign page, deleting nothing", async () => {
    const deletion = fakeDeletion();
    const preview = await previewDeckDeletion(
      { pageId: PAGE },
      { deletion },
      "owner-2",
    );
    const result = await deleteDeck(
      { pageId: PAGE },
      { deletion, clock: createFixedClock(NOW) },
      "owner-2",
    );
    for (const outcome of [preview, result]) {
      expect(outcome.ok).toBe(false);
      if (!outcome.ok)
        expect(outcome.error.code).toBe(FLASHCARD_ERROR.NOT_FOUND);
    }
    expect(deletion.deleted).toEqual([]);
  });
});
