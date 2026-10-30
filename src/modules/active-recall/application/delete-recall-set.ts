import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import type {
  RecallSetDeletion,
  RecallSetDeletionPreview,
} from "./recall-set-deletion";

// "Eliminar repaso" of a recall hub card (Phase 8 H19): the confirmation
// first reads what goes, then the delete removes the page's whole recall
// set for real. A foreign or unknown page is RECALL_SET_NOT_FOUND.
export async function previewRecallSetDeletion(
  input: { pageId: string },
  deps: { deletion: RecallSetDeletion },
  ownerId: string,
): Promise<Result<RecallSetDeletionPreview, DomainError>> {
  const preview = await deps.deletion.preview(input.pageId, ownerId);
  if (!preview) {
    return err(new DomainError(RECALL_ERROR.SET_NOT_FOUND, input.pageId));
  }
  return ok(preview);
}

export async function deleteRecallSet(
  input: { pageId: string },
  deps: { deletion: RecallSetDeletion; clock: Clock },
  ownerId: string,
): Promise<Result<{ pageId: string }, DomainError>> {
  const deleted = await deps.deletion.delete(
    input.pageId,
    ownerId,
    deps.clock.now(),
  );
  if (!deleted) {
    return err(new DomainError(RECALL_ERROR.SET_NOT_FOUND, input.pageId));
  }
  return ok({ pageId: input.pageId });
}
