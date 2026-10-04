import {
  AI_ERROR,
  type AiGeneration,
  AiGenerationFailedError,
  buildGenerateFlashcardsPrompt,
  flashcardsOutput,
  GENERATE_FLASHCARDS_PROMPT_VERSION,
  type GenerateStructuredInput,
  type GenerationRateLimiter,
  type IdGenerator,
  truncateToTokenCap,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import { newStudyItem } from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { createFlashcard, type Flashcard } from "../domain";
import type { DeckUnitOfWork } from "./deck-unit-of-work";

export const MIN_CARD_COUNT = 3;
export const MAX_CARD_COUNT = 20;
export const PAGE_EMPTY_MESSAGE = "The page has no text to generate cards from";

// The daily limit error carries when the window resets so the UI can say so.
export class DailyLimitReachedError extends DomainError {
  readonly resetAt: Date;

  constructor(resetAt: Date) {
    super(
      AI_ERROR.DAILY_LIMIT_REACHED,
      "The daily generation limit was reached",
    );
    this.resetAt = resetAt;
  }
}

export interface RequestGenerationDeps {
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
  deck: DeckUnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  tokenCap: number;
  defaultCount: number;
}

export interface RequestGenerationResult {
  cards: Flashcard[];
  remainingToday: number;
  truncated: boolean;
  wordsUsed: number;
  wordsTotal: number;
  generationId: string;
  provider: string;
  model: string;
}

function clampCount(count: number): number {
  return Math.min(MAX_CARD_COUNT, Math.max(MIN_CARD_COUNT, Math.trunc(count)));
}

// Order matters: the page is read and checked BEFORE the limiter because
// `limiter.check` consumes one unit; a missing or blank page must never cost
// the student a generation. A failed AI call after the check does keep the
// unit consumed (the provider quota was spent too).
export async function requestGeneration(
  input: { pageId: string; count?: number },
  deps: RequestGenerationDeps,
  ownerId: string,
): Promise<Result<RequestGenerationResult, DomainError>> {
  const page = await deps.pages.getPageText(input.pageId, ownerId);
  if (!page.ok) return page;
  if (page.value.plainText.trim() === "") {
    return err(new DomainError(AI_ERROR.PAGE_EMPTY, PAGE_EMPTY_MESSAGE));
  }

  const limit = await deps.limiter.check(ownerId);
  if (!limit.allowed) return err(new DailyLimitReachedError(limit.resetAt));

  const truncation = truncateToTokenCap(page.value.plainText, deps.tokenCap);
  const prompt = buildGenerateFlashcardsPrompt({
    pageTitle: page.value.title,
    pageText: truncation.text,
    count: clampCount(input.count ?? deps.defaultCount),
  });

  const generated = await deps.ai.generateStructured(
    {
      purpose: "generate_flashcards",
      pageId: input.pageId,
      promptVersion: GENERATE_FLASHCARDS_PROMPT_VERSION,
      system: prompt.system,
      prompt: prompt.prompt,
      temperature: prompt.temperature,
    },
    ownerId,
  );
  if (!generated.ok) return generated;
  const { generation } = generated.value;

  const parsed = flashcardsOutput.safeParse(generated.value.object);
  if (!parsed.success) {
    return err(new AiGenerationFailedError(generation.id));
  }

  // Cards and their study items (§3.4) are written in one unit of work;
  // the deck lock keeps positions unique against a concurrent manual card.
  const now = deps.clock.now();
  const cards = await deps.deck.run(async ({ flashcards, studyItems }) => {
    await flashcards.lockDeck(input.pageId, ownerId);
    const firstPosition = await flashcards.nextPosition(input.pageId, ownerId);
    const valid: Flashcard[] = [];
    for (const raw of parsed.data.cards) {
      const card = createFlashcard(
        {
          id: deps.ids.next(),
          ownerId,
          pageId: input.pageId,
          generationId: generation.id,
          front: raw.front,
          back: raw.back,
          origin: "ai",
          position: firstPosition + valid.length,
        },
        now,
      );
      if (card.ok) valid.push(card.value);
    }
    // A deck is never empty: nothing is persisted when no card is valid.
    if (valid.length === 0) return valid;

    await flashcards.insertMany(valid);
    for (const card of valid) {
      await studyItems.save(
        newStudyItem({
          id: deps.ids.next(),
          ownerId,
          pageId: input.pageId,
          kind: "flashcard",
          sourceId: card.id,
          now,
        }),
      );
    }
    return valid;
  });
  if (cards.length === 0) {
    return err(new AiGenerationFailedError(generation.id));
  }

  return ok({
    cards,
    remainingToday: limit.remaining,
    truncated: truncation.truncated,
    wordsUsed: truncation.wordsUsed,
    wordsTotal: truncation.wordsTotal,
    generationId: generation.id,
    provider: generation.provider,
    model: generation.model,
  });
}
