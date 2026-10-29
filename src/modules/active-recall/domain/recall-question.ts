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
  const content = checkedContent(input);
  if (!content.ok) return content;
  const { prompt, rubric } = content.value;
  return ok({
    id: input.id,
    ownerId: input.ownerId,
    pageId: input.pageId,
    prompt,
    rubric,
    origin: input.origin,
    generationId: input.generationId,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

// A manual edit (Phase 8 H18 edit page): same id, origin and generation,
// new prompt and rubric under the same rules as a new question, so the
// question's study item and its history stay attached.
export function editRecallQuestion(
  question: RecallQuestion,
  content: { prompt: string; rubric: RecallRubric },
  now: Date,
): Result<RecallQuestion, DomainError> {
  const checked = checkedContent(content);
  if (!checked.ok) return checked;
  return ok({ ...question, ...checked.value, updatedAt: now });
}

// Trims the prompt and the rubric, refusing a blank prompt, a rubric
// without key concepts or with a blank one, and a blank answer summary.
function checkedContent(content: {
  prompt: string;
  rubric: RecallRubric;
}): Result<{ prompt: string; rubric: RecallRubric }, DomainError> {
  const prompt = content.prompt.trim();
  if (prompt.length === 0) return invalid("a question needs a prompt");
  const keyConcepts = content.rubric.keyConcepts.map((concept) =>
    concept.trim(),
  );
  if (keyConcepts.length === 0 || keyConcepts.some((c) => c.length === 0)) {
    return invalid("a rubric needs at least one non-blank key concept");
  }
  const acceptableAnswerSummary = content.rubric.acceptableAnswerSummary.trim();
  if (acceptableAnswerSummary.length === 0) {
    return invalid("a rubric needs an acceptable answer summary");
  }
  return ok({ prompt, rubric: { keyConcepts, acceptableAnswerSummary } });
}

function invalid(message: string) {
  return err(new DomainError(RECALL_ERROR.INVALID_QUESTION, message));
}
