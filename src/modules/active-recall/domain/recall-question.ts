import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { RECALL_ERROR } from "./errors";

export type RecallQuestionOrigin = "ai" | "manual";

// The rubric the AI evaluation scores an answer against (§8.4): the
// concepts a good answer mentions and a short model answer.
export interface RecallRubric {
  readonly keyConcepts: readonly string[];
  readonly acceptableAnswerSummary: string;
}

// One open question of a page (documento-maestro §6.1). An archived
// question never enters a session again.
export interface RecallQuestion {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string;
  readonly prompt: string;
  readonly rubric: RecallRubric;
  readonly origin: RecallQuestionOrigin;
  // Audited AI generation; null for manual questions.
  readonly generationId: string | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewRecallQuestion {
  id: string;
  ownerId: string;
  pageId: string;
  prompt: string;
  rubric: RecallRubric;
  origin: RecallQuestionOrigin;
  generationId: string | null;
}

// Creates an active question with its text trimmed. Refuses a blank prompt,
// a rubric without key concepts or with a blank one, a blank answer
// summary, an AI question without its generation id and a manual one with
// one.
export function newRecallQuestion(
  input: NewRecallQuestion,
  now: Date,
): Result<RecallQuestion, DomainError> {
  if ((input.origin === "ai") !== (input.generationId !== null)) {
    return invalid(
      "an AI question needs a generation id; a manual one has none",
    );
  }
  const prompt = input.prompt.trim();
  if (prompt.length === 0) return invalid("a question needs a prompt");
  const keyConcepts = input.rubric.keyConcepts.map((concept) => concept.trim());
  if (keyConcepts.length === 0 || keyConcepts.some((c) => c.length === 0)) {
    return invalid("a rubric needs at least one non-blank key concept");
  }
  const acceptableAnswerSummary = input.rubric.acceptableAnswerSummary.trim();
  if (acceptableAnswerSummary.length === 0) {
    return invalid("a rubric needs an acceptable answer summary");
  }
  return ok({
    id: input.id,
    ownerId: input.ownerId,
    pageId: input.pageId,
    prompt,
    rubric: { keyConcepts, acceptableAnswerSummary },
    origin: input.origin,
    generationId: input.generationId,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

function invalid(message: string) {
  return err(new DomainError(RECALL_ERROR.INVALID_QUESTION, message));
}
