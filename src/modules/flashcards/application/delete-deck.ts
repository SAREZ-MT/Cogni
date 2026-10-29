import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain/errors";
import type { DeckDeletion, DeckDeletionPreview } from "./deck-deletion";

// "Eliminar mazo" (Phase 8 H19, replaces H17's archive): the confirmation
// first reads what goes, then the delete removes the whole deck for real.
// A foreign or unknown page is FLASHCARD_NOT_FOUND either way.
export async function previewDeckDeletion(
  input: { pageId: string },
  deps: { deletion: DeckDeletion },
  ownerId: string,
): Promise<Result<DeckDeletionPreview, DomainError>> {
  const preview = await deps.deletion.preview(input.pageId, ownerId);
  if (!preview) {
    return err(new DomainError(FLASHCARD_ERROR.NOT_FOUND, input.pageId));
  }
  return ok(preview);
}

export async function deleteDeck(
  input: { pageId: string },
  deps: { deletion: DeckDeletion; clock: Clock },
  ownerId: string,
): Promise<Result<{ pageId: string }, DomainError>> {
  const deleted = await deps.deletion.delete(
    input.pageId,
    ownerId,
    deps.clock.now(),
  );
  if (!deleted) {
    return err(new DomainError(FLASHCARD_ERROR.NOT_FOUND, input.pageId));
  }
  return ok({ pageId: input.pageId });
}
