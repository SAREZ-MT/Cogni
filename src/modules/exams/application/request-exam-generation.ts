import {
  AI_ERROR,
  type AiGeneration,
  AiGenerationFailedError,
  buildGenerateExamQuestionsPrompt,
  examQuestionsOutput,
  GENERATE_EXAM_QUESTIONS_PROMPT_VERSION,
  type GenerateStructuredInput,
  type GenerationRateLimiter,
  truncateToTokenCap,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import { newStudyItem } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import {
  type ExamQuestion,
  newExamQuestion,
  normalizeWording,
} from "../domain/exam-question";
import type { ExamQuestionRepository } from "../domain/exam-question-repository";
import {
  EXAM_DEFAULT_QUESTIONS,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_QUESTIONS,
  isValidQuestionCount,
} from "../domain/exam-session";
import { type ExamUnitOfWork, runExamWork } from "./exam-unit-of-work";

// At most this many questions per model call. A multiple-choice question
// with its explanation is roughly 120-180 output tokens of JSON, so 15 stay
// near 2-3K tokens: far below Gemini Flash-Lite's output window and small
// enough for the free fallbacks (Workers AI Llama, OpenRouter reasoning
// models) to answer without being cut off. A 30-question request becomes
// two calls; it is still ONE generation of the student's daily limit.
export const EXAM_GENERATION_BATCH_SIZE = 15;

export const EXAM_PAGE_EMPTY_MESSAGE =
  "The page has no text to generate questions from";

// The daily limit error carries when the window resets so the UI can say
// so (same shape as flashcards' DailyLimitReachedError, which this module
// cannot import: modules only meet through their index).
export class ExamDailyLimitReachedError extends DomainError {
  readonly resetAt: Date;

  constructor(resetAt: Date) {
    super(
      AI_ERROR.DAILY_LIMIT_REACHED,
      "The daily generation limit was reached",
    );
    this.resetAt = resetAt;
  }
}

export interface RequestExamGenerationDeps {
  limiter: GenerationRateLimiter;
  pages: PageTextReader;
  ai: {
    generateStructured(
      input: GenerateStructuredInput,
      ownerId: string,
    ): Promise<
      Result<{ object: unknown; generation: AiGeneration }, DomainError>
    >;
  };
  // Reads the page's active questions before the model call (the prompt
  // lists them so the model avoids duplicates).
  questions: Pick<ExamQuestionRepository, "listActiveByPage">;
  uow: ExamUnitOfWork;
  clock: Clock;
  ids: { next(): string };
  tokenCap: number;
}

export interface RequestExamGenerationResult {
  // The new AI roots, in generation order.
  questions: ExamQuestion[];
  // Generated questions dropped: invalid, a duplicate of an active or
  // earlier generated stem, or beyond the requested count.
  skipped: number;
  remainingToday: number;
  truncated: boolean;
  wordsUsed: number;
  wordsTotal: number;
  generationIds: string[];
  provider: string;
  model: string;
}

// Splits `count` into the fewest calls of at most `size`, as even as
// possible (25 → 13 + 12), so no call is a tiny tail.
export function splitIntoBatches(count: number, size: number): number[] {
  const calls = Math.ceil(count / size);
  const base = Math.floor(count / calls);
  const extra = count % calls;
  return Array.from({ length: calls }, (_, i) => base + (i < extra ? 1 : 0));
}

function invalidCount(count: number) {
  return err(
    new DomainError(
      EXAM_ERROR.INVALID_QUESTION_COUNT,
      `a generation asks for ${EXAM_MIN_QUESTIONS} to ${EXAM_MAX_QUESTIONS} questions, got ${count}`,
    ),
  );
}

// Generates AI multiple-choice roots for a page (§3.3 "generadas por IA",
// §8.4 generate_exam_questions). Order matters, as in flashcards'
// requestGeneration: count, page and blank text are checked BEFORE the
// limiter because `limiter.check` consumes one unit; a failed AI call
// after the check keeps the unit consumed (the provider quota was spent
// too). Every call of the request is made before anything is written, and
// the valid questions are written with their study items in ONE unit of
// work: a failure at any point stores nothing.
export async function requestExamGeneration(
  input: { pageId: string; count?: number },
  deps: RequestExamGenerationDeps,
  ownerId: string,
): Promise<Result<RequestExamGenerationResult, DomainError>> {
  const count = input.count ?? EXAM_DEFAULT_QUESTIONS;
  if (!isValidQuestionCount(count)) return invalidCount(count);

  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;
  if (page.value.plainText.trim() === "") {
    return err(new DomainError(AI_ERROR.PAGE_EMPTY, EXAM_PAGE_EMPTY_MESSAGE));
  }

  const limit = await deps.limiter.check(ownerId);
  if (!limit.allowed) return err(new ExamDailyLimitReachedError(limit.resetAt));

  const active = await deps.questions.listActiveByPage(input.pageId, ownerId);
  const truncation = truncateToTokenCap(page.value.plainText, deps.tokenCap);
  const now = deps.clock.now();
  const seen = new Set(active.map((q) => normalizeWording(q.stem)));
  const accepted: ExamQuestion[] = [];
  const generationIds: string[] = [];
  let lastGeneration: AiGeneration | null = null;
  let skipped = 0;

  for (const batchSize of splitIntoBatches(count, EXAM_GENERATION_BATCH_SIZE)) {
    const prompt = buildGenerateExamQuestionsPrompt({
      pageTitle: page.value.title,
      pageText: truncation.text,
      count: batchSize,
      existing: [...active, ...accepted],
    });
    const generated = await deps.ai.generateStructured(
      {
        purpose: "generate_exam_questions",
        pageId: input.pageId,
        promptVersion: GENERATE_EXAM_QUESTIONS_PROMPT_VERSION,
        system: prompt.system,
        prompt: prompt.prompt,
        temperature: prompt.temperature,
      },
      ownerId,
    );
    if (!generated.ok) return generated;
    const { generation } = generated.value;
    lastGeneration = generation;
    generationIds.push(generation.id);

    const parsed = examQuestionsOutput.safeParse(generated.value.object);
    if (!parsed.success) {
      return err(new AiGenerationFailedError(generation.id));
    }

    let keptInBatch = 0;
    for (const raw of parsed.data.questions) {
      const candidate =
        keptInBatch < batchSize
          ? newExamQuestion(
              {
                id: deps.ids.next(),
                ownerId,
                pageId: input.pageId,
                ...raw,
                origin: "ai",
                generationId: generation.id,
              },
              // Pages list questions oldest first (createdAt, then id):
              // one millisecond apart keeps the generation order.
              new Date(now.getTime() + accepted.length),
            )
          : null;
      const stem = candidate?.ok ? normalizeWording(candidate.value.stem) : "";
      if (!candidate?.ok || seen.has(stem)) {
        skipped += 1;
        continue;
      }
      seen.add(stem);
      accepted.push(candidate.value);
      keptInBatch += 1;
    }
  }

  // lastGeneration is set: splitIntoBatches always yields at least one call.
  const lastId = (lastGeneration as AiGeneration).id;
  if (accepted.length === 0) return err(new AiGenerationFailedError(lastId));

  const persisted = await runExamWork(
    deps.uow,
    async ({ questions, studyItems }) => {
      // A manual question may have landed during the model calls.
      const current = new Set(
        (await questions.listActiveByPage(input.pageId, ownerId)).map((q) =>
          normalizeWording(q.stem),
        ),
      );
      const fresh = accepted.filter(
        (q) => !current.has(normalizeWording(q.stem)),
      );
      if (fresh.length === 0) {
        return err(new AiGenerationFailedError(lastId));
      }
      for (const question of fresh) {
        await questions.save(question);
        await studyItems.save(
          newStudyItem({
            id: deps.ids.next(),
            ownerId,
            pageId: input.pageId,
            kind: "exam_question",
            sourceId: question.rootId,
            now,
          }),
        );
      }
      return ok(fresh);
    },
  );
  if (!persisted.ok) return persisted;

  return ok({
    questions: persisted.value,
    skipped: skipped + (accepted.length - persisted.value.length),
    remainingToday: limit.remaining,
    truncated: truncation.truncated,
    wordsUsed: truncation.wordsUsed,
    wordsTotal: truncation.wordsTotal,
    generationIds,
    provider: (lastGeneration as AiGeneration).provider,
    model: (lastGeneration as AiGeneration).model,
  });
}
