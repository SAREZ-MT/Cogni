import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import type { ExamQuestion } from "../domain/exam-question";
import type { ExamSessionUnitOfWork } from "./exam-session-work";

export interface ExamReviewNotice {
  // The current concepts of the roots failed in the last failed exam, once
  // each, in the page state's order.
  failedConcepts: string[];
}

// "Repasar contenido" (user decision 2026-10-05: review before retaking):
// while the page waits for a retake, the notebook page lists the failed
// concepts with a "Repetir examen" action. Derived from ExamPageState
// (retakePending, failedRootIds) and each root's latest active question,
// never from the URL. Null when no retake is pending or every failed root
// was retired since the exam (starting the retake then clears it).
// Owner-scoped: another owner's page reads as null.
export async function getExamReviewNotice(
  input: { pageId: string },
  deps: { uow: ExamSessionUnitOfWork },
  ownerId: string,
): Promise<Result<ExamReviewNotice | null, DomainError>> {
  return deps.uow.run(async (repos) => {
    const state = await repos.pageStates.get(input.pageId, ownerId);
    if (!state?.retakePending || state.failedRootIds.length === 0) {
      return ok(null);
    }
    const active = await repos.questions.listActiveByPage(
      input.pageId,
      ownerId,
    );
    // The latest active wording of each root carries its current concept.
    const latestByRoot = new Map<string, ExamQuestion>();
    for (const question of active) {
      const current = latestByRoot.get(question.rootId);
      if (!current || question.createdAt >= current.createdAt) {
        latestByRoot.set(question.rootId, question);
      }
    }
    const concepts = new Set<string>();
    for (const rootId of state.failedRootIds) {
      const question = latestByRoot.get(rootId);
      if (question) concepts.add(question.concept);
    }
    return ok(concepts.size > 0 ? { failedConcepts: [...concepts] } : null);
  });
}
