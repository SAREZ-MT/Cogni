import type { RecallQuestion } from "./recall-question";

// Session size is fixed: the player has no selector (user decision
// 2026-10-06).
export const RECALL_SESSION_SIZE = 10;

export interface ComposeRecallSessionInput {
  questions: readonly Pick<RecallQuestion, "id" | "createdAt" | "archivedAt">[];
  // Questions whose study item has been reviewed and is due now, in the
  // order the engine returns them (oldest due first).
  dueIds: readonly string[];
  // Questions whose study item was never reviewed. study-engine creates an
  // item due at its creation time, so a never-reviewed item is technically
  // due too; the application layer splits them by lastReviewedAt so that
  // real reviews come first. An id in both lists counts as due.
  newIds: readonly string[];
  size?: number;
}

// Picks the question ids of a session: due questions first, in the given
// order, then new ones by creation date and id, up to `size`. Archived
// questions, unknown ids, repeated ids and reviewed questions that are not
// due yet are left out, so a session never advances an interval early.
export function composeRecallSession(
  input: ComposeRecallSessionInput,
): string[] {
  const size = input.size ?? RECALL_SESSION_SIZE;
  const active = new Map(
    input.questions
      .filter((question) => question.archivedAt === null)
      .map((question) => [question.id, question]),
  );
  const due = unique(input.dueIds).filter((id) => active.has(id));
  const dueSet = new Set(due);
  const fresh = unique(input.newIds)
    .flatMap((id) => {
      const question = active.get(id);
      return question && !dueSet.has(id) ? [question] : [];
    })
    .sort(byCreation)
    .map((question) => question.id);
  return [...due, ...fresh].slice(0, Math.max(0, size));
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function byCreation(
  a: Pick<RecallQuestion, "id" | "createdAt">,
  b: Pick<RecallQuestion, "id" | "createdAt">,
): number {
  const byDate = a.createdAt.getTime() - b.createdAt.getTime();
  if (byDate !== 0) return byDate;
  return a.id < b.id ? -1 : 1;
}
