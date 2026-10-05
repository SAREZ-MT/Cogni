import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "./errors";

// "ai_variant" is a reformulation generated for a retake (§7.5).
export type ExamQuestionOrigin = "ai" | "manual" | "ai_variant";

// Multiple choice with exactly four options and one correct answer (§3.3).
export const EXAM_OPTION_COUNT = 4;

// Upper bounds counted after trimming. They keep a question readable in the
// player and the AI payloads small; the database may mirror them as CHECKs.
export const MAX_STEM_LENGTH = 1000;
export const MAX_OPTION_LENGTH = 300;
export const MAX_EXPLANATION_LENGTH = 2000;
export const MAX_CONCEPT_LENGTH = 120;

// One multiple-choice question of a page (documento-maestro §6.1). Every
// question belongs to a lineage: `rootId` is the original question's id
// (its own id when original) and `variantOf` the question it replaced (null
// when original). The engine's StudyItem points at the root, so every
// variant feeds the same concept's SM-2 state.
export interface ExamQuestion {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string;
  readonly stem: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly explanation: string;
  // Short text naming the concept the question evaluates.
  readonly concept: string;
  readonly rootId: string;
  readonly variantOf: string | null;
  readonly origin: ExamQuestionOrigin;
  // Audited AI generation; null for manual questions.
  readonly generationId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // A retired question never shows again; a retired root suspends its item.
  readonly retiredAt: Date | null;
}

interface QuestionContent {
  stem: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  concept: string;
}

export interface NewExamQuestion extends QuestionContent {
  id: string;
  ownerId: string;
  pageId: string;
  origin: "ai" | "manual";
  generationId: string | null;
}

export interface NewVariantInput {
  id: string;
  stem: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  generationId: string;
}

export type ExamQuestionPatch = Partial<QuestionContent>;

// Creates an original question: its own root, no predecessor. An AI question
// needs its generation id and a manual one must not carry one.
export function newExamQuestion(
  input: NewExamQuestion,
  now: Date,
): Result<ExamQuestion, DomainError> {
  if ((input.origin === "ai") !== (input.generationId !== null)) {
    return invalid(
      "an AI question needs a generation id; a manual one has none",
    );
  }
  const content = validateContent(input);
  if (!content.ok) return content;
  return ok({
    id: input.id,
    ownerId: input.ownerId,
    pageId: input.pageId,
    ...content.value,
    rootId: input.id,
    variantOf: null,
    origin: input.origin,
    generationId: input.generationId,
    createdAt: now,
    updatedAt: now,
    retiredAt: null,
  });
}

// Creates the AI reformulation that replaces `previous` in a retake: same
// page, owner, root and concept; a different wording (§7.5.1). The caller
// retires `previous` afterwards (§7.5.2).
export function newVariant(
  previous: ExamQuestion,
  input: NewVariantInput,
  now: Date,
): Result<ExamQuestion, DomainError> {
  if (previous.retiredAt !== null) return retired(previous.id);
  const content = validateContent({ ...input, concept: previous.concept });
  if (!content.ok) return content;
  if (
    normalizeWording(content.value.stem) === normalizeWording(previous.stem)
  ) {
    return err(
      new DomainError(
        EXAM_ERROR.VARIANT_SAME_WORDING,
        `variant ${input.id} repeats the wording of question ${previous.id}`,
      ),
    );
  }
  return ok({
    id: input.id,
    ownerId: previous.ownerId,
    pageId: previous.pageId,
    ...content.value,
    rootId: previous.rootId,
    variantOf: previous.id,
    origin: "ai_variant",
    generationId: input.generationId,
    createdAt: now,
    updatedAt: now,
    retiredAt: null,
  });
}

// A manual edit changes the question in place: same id, root, lineage and
// origin, so the root's SM-2 history stays attached.
export function editExamQuestion(
  question: ExamQuestion,
  patch: ExamQuestionPatch,
  now: Date,
): Result<ExamQuestion, DomainError> {
  if (question.retiredAt !== null) return retired(question.id);
  const content = validateContent({
    stem: patch.stem ?? question.stem,
    options: patch.options ?? question.options,
    correctIndex: patch.correctIndex ?? question.correctIndex,
    explanation: patch.explanation ?? question.explanation,
    concept: patch.concept ?? question.concept,
  });
  if (!content.ok) return content;
  return ok({ ...question, ...content.value, updatedAt: now });
}

export function retireExamQuestion(
  question: ExamQuestion,
  now: Date,
): Result<ExamQuestion, DomainError> {
  if (question.retiredAt !== null) return retired(question.id);
  return ok({ ...question, retiredAt: now, updatedAt: now });
}

function validateContent(
  input: QuestionContent,
): Result<QuestionContent, DomainError> {
  const stem = input.stem.trim();
  const options = input.options.map((option) => option.trim());
  const explanation = input.explanation.trim();
  const concept = input.concept.trim();

  if (stem === "" || stem.length > MAX_STEM_LENGTH) {
    return invalid(`the stem must hold 1 to ${MAX_STEM_LENGTH} characters`);
  }
  if (options.length !== EXAM_OPTION_COUNT) {
    return invalid(`a question needs exactly ${EXAM_OPTION_COUNT} options`);
  }
  if (options.some((o) => o === "" || o.length > MAX_OPTION_LENGTH)) {
    return invalid(
      `every option must hold 1 to ${MAX_OPTION_LENGTH} characters`,
    );
  }
  if (new Set(options.map(normalizeWording)).size !== options.length) {
    return invalid("the options must be distinct");
  }
  if (
    !Number.isInteger(input.correctIndex) ||
    input.correctIndex < 0 ||
    input.correctIndex >= EXAM_OPTION_COUNT
  ) {
    return invalid(`the correct index must be 0 to ${EXAM_OPTION_COUNT - 1}`);
  }
  if (explanation.length > MAX_EXPLANATION_LENGTH) {
    return invalid(
      `the explanation must hold at most ${MAX_EXPLANATION_LENGTH} characters`,
    );
  }
  if (concept === "" || concept.length > MAX_CONCEPT_LENGTH) {
    return invalid(
      `the concept must hold 1 to ${MAX_CONCEPT_LENGTH} characters`,
    );
  }
  return ok({
    stem,
    options,
    correctIndex: input.correctIndex,
    explanation,
    concept,
  });
}

// Wording comparison ignores case and runs of whitespace.
function normalizeWording(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function invalid(message: string) {
  return err(new DomainError(EXAM_ERROR.INVALID_QUESTION, message));
}

function retired(questionId: string) {
  return err(
    new DomainError(
      EXAM_ERROR.QUESTION_RETIRED,
      `question ${questionId} is retired`,
    ),
  );
}
