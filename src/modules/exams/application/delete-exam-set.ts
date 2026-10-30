import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import type {
  ExamSetDeletion,
  ExamSetDeletionPreview,
} from "./exam-set-deletion";

// "Eliminar examen" of an exams hub card (Phase 8 H19): the confirmation
// first reads what goes, then the delete removes the page's whole exam set
// for real. A foreign or unknown page is EXAMS_SET_NOT_FOUND.
export async function previewExamSetDeletion(
  input: { pageId: string },
  deps: { deletion: ExamSetDeletion },
  ownerId: string,
): Promise<Result<ExamSetDeletionPreview, DomainError>> {
  const preview = await deps.deletion.preview(input.pageId, ownerId);
  if (!preview) {
    return err(new DomainError(EXAM_ERROR.SET_NOT_FOUND, input.pageId));
  }
  return ok(preview);
}

export async function deleteExamSet(
  input: { pageId: string },
  deps: { deletion: ExamSetDeletion; clock: Clock },
  ownerId: string,
): Promise<Result<{ pageId: string }, DomainError>> {
  const deleted = await deps.deletion.delete(
    input.pageId,
    ownerId,
    deps.clock.now(),
  );
  if (!deleted) {
    return err(new DomainError(EXAM_ERROR.SET_NOT_FOUND, input.pageId));
  }
  return ok({ pageId: input.pageId });
}
