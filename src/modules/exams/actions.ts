"use server";

import { z } from "zod";
import { createNotebooksServerApi } from "@/modules/notebooks";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { type ActionError, toActionError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  parseInput,
  requireOwnerId,
  revalidateExams,
  withBoundary,
} from "./action-support";
import {
  createExamQuestion,
  editExamQuestion,
  listPageExamQuestions,
  retireExamQuestion,
} from "./application";
import {
  EXAM_OPTION_COUNT,
  type ExamQuestion,
  type ExamQuestionOrigin,
  MAX_CONCEPT_LENGTH,
  MAX_EXPLANATION_LENGTH,
  MAX_OPTION_LENGTH,
  MAX_STEM_LENGTH,
} from "./domain/exam-question";
import {
  DrizzleExamQuestionRepository,
  DrizzleExamUnitOfWork,
} from "./infrastructure";

// Server Actions are the only client-reachable entry point of this module:
// session first, Zod validation, then the use case, and every DomainError
// leaves as the plain ActionError shape. None of them throws to the client.

export interface ExamQuestionView {
  id: string;
  pageId: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  concept: string;
  origin: ExamQuestionOrigin;
}

export interface RetiredExamQuestionView {
  id: string;
}

// The raw texts are only bounded here (twice the limit leaves room for
// surrounding whitespace); the domain applies the real limits to the
// trimmed text and answers EXAMS_INVALID_QUESTION.
const text = (max: number) => z.string().max(max * 2);
const content = {
  stem: text(MAX_STEM_LENGTH),
  options: z.array(text(MAX_OPTION_LENGTH)).length(EXAM_OPTION_COUNT),
  correctIndex: z
    .number()
    .int()
    .min(0)
    .max(EXAM_OPTION_COUNT - 1),
  explanation: text(MAX_EXPLANATION_LENGTH),
  concept: text(MAX_CONCEPT_LENGTH),
};
const pageInput = z.object({ pageId: z.uuid() });
const createInput = z.object({ pageId: z.uuid(), ...content });
const editInput = z.object({ questionId: z.uuid(), ...content });
const questionInput = z.object({ questionId: z.uuid() });

// Adapters are built per call, like flashcards/actions.ts: serverless
// functions are short-lived, so no module-level singletons.
function deps() {
  const db = getDb();
  return {
    pages: createNotebooksServerApi({ db, clock: systemClock }),
    questions: new DrizzleExamQuestionRepository(db),
    uow: new DrizzleExamUnitOfWork(db),
  };
}

function toView(question: ExamQuestion): ExamQuestionView {
  return {
    id: question.id,
    pageId: question.pageId,
    stem: question.stem,
    options: [...question.options],
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    concept: question.concept,
    origin: question.origin,
  };
}

export async function listExamQuestionsAction(
  input: unknown,
): Promise<Result<ExamQuestionView[], ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const { questions } = deps();
    const result = await listPageExamQuestions(
      parsed.value,
      { questions },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    return ok(result.value.map(toView));
  });
}

export async function createExamQuestionAction(
  input: unknown,
): Promise<Result<ExamQuestionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(createInput, input);
    if (!parsed.ok) return parsed;

    const { pages, uow } = deps();
    const result = await createExamQuestion(
      parsed.value,
      { pages, uow, clock: systemClock, ids: { next: createId } },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateExams();
    return ok(toView(result.value));
  });
}

export async function editExamQuestionAction(
  input: unknown,
): Promise<Result<ExamQuestionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(editInput, input);
    if (!parsed.ok) return parsed;

    const { uow } = deps();
    const result = await editExamQuestion(
      parsed.value,
      { uow, clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateExams();
    return ok(toView(result.value));
  });
}

export async function retireExamQuestionAction(
  input: unknown,
): Promise<Result<RetiredExamQuestionView, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(questionInput, input);
    if (!parsed.ok) return parsed;

    const { uow } = deps();
    const result = await retireExamQuestion(
      parsed.value,
      { uow, clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidateExams();
    return ok({ id: result.value.id });
  });
}
