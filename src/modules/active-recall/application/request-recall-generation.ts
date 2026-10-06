import {
  AI_ERROR,
  type AiGeneration,
  AiGenerationFailedError,
  buildGenerateRecallQuestionsPrompt,
  GENERATE_RECALL_QUESTIONS_PROMPT_VERSION,
  type GenerateStructuredInput,
  type GenerationRateLimiter,
  recallQuestionsOutput,
  truncateToTokenCap,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import { newStudyItem } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  newRecallQuestion,
  type RecallQuestion,
} from "../domain/recall-question";
import type { RecallQuestionRepository } from "../domain/recall-question-repository";
import { type RecallUnitOfWork, runRecallWork } from "./recall-unit-of-work";

// Questions per generation (user decision 2026-10-06): one model call, well
// under ADR 0006's 15 items per call. An open question with its rubric is
// roughly 80-150 output tokens of JSON, so 10 stay near 1.5K tokens.
export const RECALL_GENERATION_COUNT = 10;

export const RECALL_PAGE_EMPTY_MESSAGE =
  "The page has no text to generate questions from";

// The daily limit error carries when the window resets so the UI can say
// so (same shape as exams' ExamDailyLimitReachedError, which this module
// cannot import: modules only meet through their index).
export class RecallDailyLimitReachedError extends DomainError {
  readonly resetAt: Date;

  constructor(resetAt: Date) {
    super(
      AI_ERROR.DAILY_LIMIT_REACHED,
      "The daily generation limit was reached",
    );
    this.resetAt = resetAt;
  }
}

export interface RequestRecallGenerationDeps {
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
  questions: Pick<RecallQuestionRepository, "listActiveByPage">;
  uow: RecallUnitOfWork;
  clock: Clock;
  ids: { next(): string };
  tokenCap: number;
}

export interface RequestRecallGenerationResult {
  // The new AI questions, in generation order.
  questions: RecallQuestion[];
  // Generated questions dropped: invalid, a duplicate of an active or
  // earlier generated prompt, or beyond RECALL_GENERATION_COUNT.
  skipped: number;
  remainingToday: number;
  truncated: boolean;
  wordsUsed: number;
  wordsTotal: number;
  generationId: string;
  provider: string;
  model: string;
}

// Same comparison as exams' normalizeWording: case, inner whitespace,
// opening ¿¡ and closing punctuation do not make a question new.
function normalizePrompt(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s¿¡]+/, "")
    .replace(/[\s.,;:!?…]+$/, "")
    .toLocaleLowerCase();
}

// Generates AI open questions with their rubric for a page (§3.3, §8.4
// generate_recall_questions). Page and blank text are checked first; the
// daily limit is only PEEKED before the model call and consumed with
// `limiter.check` once the questions are stored, so a failed generation
// (provider failure, unusable output, rollback) costs no unit — the same
// peek-then-check flow as exams' retake variants (master doc §3.3). If the
// limit ran out between the peek and the commit (a concurrent generation),
// the questions stand and remainingToday is 0. The questions are written
// with their study items in ONE unit of work: a failure stores nothing.
export async function requestRecallGeneration(
  input: { pageId: string },
  deps: RequestRecallGenerationDeps,
  ownerId: string,
): Promise<Result<RequestRecallGenerationResult, DomainError>> {
  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;
  if (page.value.plainText.trim() === "") {
    return err(new DomainError(AI_ERROR.PAGE_EMPTY, RECALL_PAGE_EMPTY_MESSAGE));
  }

  const limit = await deps.limiter.peek(ownerId);
  if (!limit.allowed) {
    return err(new RecallDailyLimitReachedError(limit.resetAt));
  }

  const active = await deps.questions.listActiveByPage(input.pageId, ownerId);
  const truncation = truncateToTokenCap(page.value.plainText, deps.tokenCap);
  const prompt = buildGenerateRecallQuestionsPrompt({
    pageTitle: page.value.title,
    pageText: truncation.text,
    count: RECALL_GENERATION_COUNT,
    existing: active,
  });
  const generated = await deps.ai.generateStructured(
    {
      purpose: "generate_recall_questions",
      pageId: input.pageId,
      promptVersion: GENERATE_RECALL_QUESTIONS_PROMPT_VERSION,
      system: prompt.system,
      prompt: prompt.prompt,
      temperature: prompt.temperature,
    },
    ownerId,
  );
  if (!generated.ok) return generated;
  const { generation } = generated.value;

  const parsed = recallQuestionsOutput.safeParse(generated.value.object);
  if (!parsed.success) return err(new AiGenerationFailedError(generation.id));

  const now = deps.clock.now();
  const seen = new Set(active.map((q) => normalizePrompt(q.prompt)));
  const accepted: RecallQuestion[] = [];
  let skipped = 0;
  for (const raw of parsed.data.questions) {
    const candidate =
      accepted.length < RECALL_GENERATION_COUNT
        ? newRecallQuestion(
            {
              id: deps.ids.next(),
              ownerId,
              pageId: input.pageId,
              prompt: raw.prompt,
              rubric: raw.rubric,
              origin: "ai",
              generationId: generation.id,
            },
            // Pages list questions oldest first (createdAt, then id): one
            // millisecond apart keeps the generation order.
            new Date(now.getTime() + accepted.length),
          )
        : null;
    const key = candidate?.ok ? normalizePrompt(candidate.value.prompt) : "";
    if (!candidate?.ok || seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    accepted.push(candidate.value);
  }
  if (accepted.length === 0) {
    return err(new AiGenerationFailedError(generation.id));
  }

  const persisted = await runRecallWork(
    deps.uow,
    async ({ questions, studyItems }) => {
      // Another generation may have landed during the model call.
      const current = new Set(
        (await questions.listActiveByPage(input.pageId, ownerId)).map((q) =>
          normalizePrompt(q.prompt),
        ),
      );
      const fresh = accepted.filter(
        (q) => !current.has(normalizePrompt(q.prompt)),
      );
      if (fresh.length === 0) {
        return err(new AiGenerationFailedError(generation.id));
      }
      await questions.saveMany(fresh);
      for (const question of fresh) {
        await studyItems.save(
          newStudyItem({
            id: deps.ids.next(),
            ownerId,
            pageId: input.pageId,
            kind: "recall_question",
            sourceId: question.id,
            now,
          }),
        );
      }
      return ok(fresh);
    },
  );
  if (!persisted.ok) return persisted;

  const consumed = await deps.limiter.check(ownerId);
  return ok({
    questions: persisted.value,
    skipped: skipped + (accepted.length - persisted.value.length),
    remainingToday: consumed.allowed ? consumed.remaining : 0,
    truncated: truncation.truncated,
    wordsUsed: truncation.wordsUsed,
    wordsTotal: truncation.wordsTotal,
    generationId: generation.id,
    provider: generation.provider,
    model: generation.model,
  });
}
