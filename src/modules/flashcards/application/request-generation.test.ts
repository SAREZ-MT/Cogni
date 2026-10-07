import { beforeEach, describe, expect, it } from "vitest";
import {
  AI_ERROR,
  type AiGeneration,
  AiGenerationFailedError,
  type GenerateStructuredInput,
  type GenerationRateLimit,
  type GenerationRateLimiter,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { fingerprintParagraph } from "@/shared/kernel/page-paragraphs";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain";
import {
  DailyLimitReachedError,
  PAGE_EMPTY_MESSAGE,
  type RequestGenerationDeps,
  requestGeneration,
} from "./request-generation";
import { InMemoryDeckUnitOfWork } from "./testing/in-memory-deck-unit-of-work";

const OWNER = "owner-1";
const PAGE = "page-1";
const NOW = new Date("2026-10-04T10:00:00.000Z");
const RESET = new Date("2026-10-05T00:00:00.000Z");

class StubLimiter implements GenerationRateLimiter {
  checks = 0;
  constructor(private remaining = 5) {}
  async check(): Promise<GenerationRateLimit> {
    this.checks += 1;
    if (this.remaining <= 0) {
      return { allowed: false, remaining: 0, resetAt: RESET };
    }
    this.remaining -= 1;
    return { allowed: true, remaining: this.remaining, resetAt: RESET };
  }
  async peek(): Promise<GenerationRateLimit> {
    return {
      allowed: this.remaining > 0,
      remaining: this.remaining,
      resetAt: RESET,
    };
  }
}

function stubPages(text: { title: string; plainText: string } | null) {
  const reader: PageTextReader = {
    async getPageText(pageId, ownerId) {
      if (!text || pageId !== PAGE || ownerId !== OWNER) {
        return err(new DomainError("PAGE_NOT_FOUND", pageId));
      }
      return ok(text);
    },
  };
  return reader;
}

function generation(id = "gen-1"): AiGeneration {
  return {
    id,
    ownerId: OWNER,
    pageId: PAGE,
    purpose: "generate_flashcards",
    provider: "gemini",
    model: "gemini-3.5-flash-lite",
    promptVersion: "generate_flashcards/v1",
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
    status: "done",
    error: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeAi(outcome: "ok" | "fail" | { cards: unknown[] } = "ok") {
  const calls: GenerateStructuredInput[] = [];
  return {
    calls,
    generateStructured: async (
      input: GenerateStructuredInput,
    ): Promise<
      Result<{ object: unknown; generation: AiGeneration }, DomainError>
    > => {
      calls.push(input);
      if (outcome === "fail") return err(new AiGenerationFailedError("gen-x"));
      const object =
        outcome === "ok"
          ? {
              cards: [
                { front: "  P1 ", back: " R1 " },
                { front: "P2", back: "R2" },
              ],
            }
          : outcome;
      return ok({ object, generation: generation() });
    },
  };
}

let ids = 0;
function makeDeps(overrides: Partial<RequestGenerationDeps> = {}) {
  const deck = new InMemoryDeckUnitOfWork();
  const flashcards = deck.flashcards;
  const limiter = new StubLimiter();
  const ai = makeAi();
  const deps: RequestGenerationDeps = {
    limiter,
    pages: stubPages({
      title: "Fotosíntesis",
      plainText: "uno dos tres cuatro",
    }),
    ai,
    deck,
    fingerprints: deck.fingerprints,
    clock: createFixedClock(NOW),
    ids: { next: () => `card-${++ids}` },
    tokenCap: 12000,
    defaultCount: 10,
    ...overrides,
  };
  return { deps, deck, flashcards, limiter, ai };
}

describe("requestGeneration", () => {
  beforeEach(() => {
    ids = 0;
  });

  it("generates, persists trimmed cards and reports the usage", async () => {
    const { deps, flashcards } = makeDeps();

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.cards.map((c) => [c.front, c.back, c.position]),
    ).toEqual([
      ["P1", "R1", 0],
      ["P2", "R2", 1],
    ]);
    expect(result.value.cards.every((c) => c.generationId === "gen-1")).toBe(
      true,
    );
    expect(result.value.cards.every((c) => c.origin === "ai")).toBe(true);
    expect(result.value).toMatchObject({
      remainingToday: 4,
      truncated: false,
      wordsUsed: 4,
      wordsTotal: 4,
      generationId: "gen-1",
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });
    expect(await flashcards.countByPage(PAGE, OWNER)).toBe(2);
  });

  it("creates one due study item per persisted card in the same unit of work", async () => {
    const { deps, deck } = makeDeps();

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deck.runs).toBe(1);
    const items = deck.studyItems.all();
    expect(items.map((item) => item.sourceId)).toEqual(
      result.value.cards.map((card) => card.id),
    );
    expect(
      items.every(
        (item) =>
          item.kind === "flashcard" &&
          item.ownerId === OWNER &&
          item.pageId === PAGE &&
          item.repetitions === 0 &&
          item.dueAt.getTime() === NOW.getTime(),
      ),
    ).toBe(true);
  });

  it("returns DAILY_LIMIT_REACHED with resetAt and calls no AI nor persists", async () => {
    const { deps, flashcards, ai } = makeDeps({ limiter: new StubLimiter(0) });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(AI_ERROR.DAILY_LIMIT_REACHED);
    expect(result.error).toBeInstanceOf(DailyLimitReachedError);
    expect((result.error as DailyLimitReachedError).resetAt).toEqual(RESET);
    expect(ai.calls).toHaveLength(0);
    expect(await flashcards.countByPage(PAGE, OWNER)).toBe(0);
  });

  it("propagates NOT_FOUND without consuming the limit", async () => {
    const { deps, limiter, ai } = makeDeps({ pages: stubPages(null) });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
    expect(limiter.checks).toBe(0);
    expect(ai.calls).toHaveLength(0);
  });

  it("returns PAGE_EMPTY for a blank page before consuming the limit", async () => {
    const { deps, limiter, ai } = makeDeps({
      pages: stubPages({ title: "Vacía", plainText: "  \n " }),
    });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.PAGE_EMPTY);
    expect(!result.ok && result.error.message).toBe(PAGE_EMPTY_MESSAGE);
    expect(limiter.checks).toBe(0);
    expect(ai.calls).toHaveLength(0);
  });

  it("truncates to the token cap and reports it", async () => {
    const words = Array.from({ length: 100 }, (_, i) => `w${i}`).join(" ");
    const { deps, ai } = makeDeps({
      pages: stubPages({ title: "Larga", plainText: words }),
      tokenCap: 40, // 30 words
    });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value).toMatchObject({
      truncated: true,
      wordsUsed: 30,
      wordsTotal: 100,
    });
    expect(ai.calls[0]?.prompt).toContain("w29");
    expect(ai.calls[0]?.prompt).not.toContain("w30");
  });

  it("sends the v1 prompt with the page title and the default count", async () => {
    const { deps, ai } = makeDeps();

    await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(ai.calls[0]).toMatchObject({
      purpose: "generate_flashcards",
      pageId: PAGE,
      promptVersion: "generate_flashcards/v1",
    });
    expect(ai.calls[0]?.prompt).toContain("Fotosíntesis");
    expect(ai.calls[0]?.system).toContain("exactly 10 cards");
  });

  it.each([
    [5, 5],
    [1, 3],
    [99, 20],
  ])("count %i is sent as %i (clamped to 3..20)", async (count, sent) => {
    const { deps, ai } = makeDeps();

    await requestGeneration({ pageId: PAGE, count }, deps, OWNER);

    expect(ai.calls[0]?.system).toContain(`exactly ${sent} cards`);
  });

  it("maps an AI failure to GENERATION_FAILED and persists nothing", async () => {
    const { deps, flashcards } = makeDeps({ ai: makeAi("fail") });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    expect(await flashcards.countByPage(PAGE, OWNER)).toBe(0);
  });

  it("fails with GENERATION_FAILED when a card is blank (the schema rejects the whole answer)", async () => {
    const { deps, flashcards } = makeDeps({
      ai: makeAi({ cards: [{ front: " ", back: "x" }] }),
    });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    expect(await flashcards.countByPage(PAGE, OWNER)).toBe(0);
  });

  it("fails with GENERATION_FAILED when the object does not match the schema", async () => {
    const { deps } = makeDeps({ ai: makeAi({ nope: true } as never) });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(AI_ERROR.GENERATION_FAILED);
  });

  it("continues positions after the existing cards", async () => {
    const { deps, flashcards } = makeDeps();
    await requestGeneration({ pageId: PAGE }, deps, OWNER);

    const second = await requestGeneration(
      { pageId: PAGE },
      {
        ...deps,
        pages: stubPages({
          title: "Fotosíntesis",
          plainText: "uno dos tres cuatro\ncinco seis",
        }),
      },
      OWNER,
    );

    expect(second.ok && second.value.cards.map((c) => c.position)).toEqual([
      2, 3,
    ]);
    expect(await flashcards.countByPage(PAGE, OWNER)).toBe(4);
  });
});

// Incremental generation (Phase 6 T5c): only paragraphs this technique has
// not sent yet reach the model; nothing new means no call and no unit.
describe("requestGeneration — incremental", () => {
  beforeEach(() => {
    ids = 0;
  });

  function withText(plainText: string) {
    return stubPages({ title: "Fotosíntesis", plainText });
  }

  it("stores the fingerprints of the sent paragraphs with the cards", async () => {
    const { deps, deck } = makeDeps({ pages: withText("Uno dos\n\nTres") });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    expect((await deck.fingerprints.listByPage(PAGE, OWNER)).sort()).toEqual(
      [fingerprintParagraph("uno dos"), fingerprintParagraph("tres")].sort(),
    );
  });

  it("answers NO_NEW_CONTENT without calling the AI nor consuming a unit", async () => {
    const { deps, deck, limiter, ai } = makeDeps({
      pages: withText("Uno dos\nTres"),
    });
    await requestGeneration({ pageId: PAGE }, deps, OWNER);
    const checksBefore = limiter.checks;

    const again = await requestGeneration(
      { pageId: PAGE },
      { ...deps, pages: withText("  UNO   dos \n\n tres ") },
      OWNER,
    );

    expect(!again.ok && again.error.code).toBe(FLASHCARD_ERROR.NO_NEW_CONTENT);
    expect(ai.calls).toHaveLength(1);
    expect(limiter.checks).toBe(checksBefore);
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(2);
  });

  it("sends only the added and the edited paragraphs, in page order", async () => {
    const { deps, ai } = makeDeps({
      pages: withText("Primero viejo\nSegundo viejo"),
    });
    await requestGeneration({ pageId: PAGE }, deps, OWNER);

    const second = await requestGeneration(
      { pageId: PAGE },
      {
        ...deps,
        pages: withText("Nuevo inicio\nPrimero viejo\nSegundo editado"),
      },
      OWNER,
    );

    expect(second.ok).toBe(true);
    const prompt = ai.calls[1]?.prompt ?? "";
    expect(prompt).toContain("Nuevo inicio\nSegundo editado");
    expect(prompt).not.toContain("Primero viejo");
    expect(second.ok && second.value).toMatchObject({
      wordsUsed: 4,
      wordsTotal: 4,
    });
  });

  it("keeps the paragraphs a truncation cut new for the next generation", async () => {
    const { deps, deck, ai } = makeDeps({
      pages: withText("a b c\nd e f\ng h i"),
      tokenCap: 6, // 4 words: "a b c" whole, "d" of the second paragraph
    });

    const first = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(first.ok && first.value.truncated).toBe(true);
    expect(await deck.fingerprints.listByPage(PAGE, OWNER)).toEqual([
      fingerprintParagraph("a b c"),
    ]);

    await requestGeneration({ pageId: PAGE }, deps, OWNER);
    expect(ai.calls[1]?.prompt).toContain("d e f");
    expect(ai.calls[1]?.prompt).not.toContain("a b c");
  });

  it("stores no fingerprint when the generation fails", async () => {
    const { deps, deck } = makeDeps({ ai: makeAi("fail") });

    await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(await deck.fingerprints.listByPage(PAGE, OWNER)).toEqual([]);
  });

  it("sends the whole page when cards exist but no fingerprint (generated before T5c)", async () => {
    const { deps, deck, ai } = makeDeps({ pages: withText("Uno\nDos") });
    await requestGeneration({ pageId: PAGE }, deps, OWNER);
    // A page generated before the fingerprints existed: cards, no rows.
    deck.fingerprints.store.rows.clear();

    const again = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(again.ok).toBe(true);
    expect(ai.calls[1]?.prompt).toContain("Uno\nDos");
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(4);
  });
});
