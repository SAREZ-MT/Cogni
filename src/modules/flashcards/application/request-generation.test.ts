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
import {
  PAGE_TOO_SHORT_CODE,
  PageTooShortError,
} from "@/shared/kernel/generation-capacity";
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

// A paragraph of `n` distinct words tagged `tag`: since Phase 8 H14 a
// generation needs 100 words of new paragraphs and about 15 per card.
function para(tag: string, n: number): string {
  return Array.from({ length: n }, (_, i) => `${tag}${i}`).join(" ");
}
// 150 words: room for the default 10 cards.
const TEXT = para("p", 150);

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
      // "ok" answers as many cards as the prompt asks for.
      const asked = Number(/exactly (\d+) cards/.exec(input.system)?.[1] ?? 2);
      const object =
        outcome === "ok"
          ? {
              cards: [
                { front: "  P1 ", back: " R1 " },
                { front: "P2", back: "R2" },
                ...Array.from({ length: Math.max(0, asked - 2) }, (_, i) => ({
                  front: `P${i + 3}`,
                  back: `R${i + 3}`,
                })),
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
      plainText: TEXT,
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
      result.value.cards.slice(0, 2).map((c) => [c.front, c.back, c.position]),
    ).toEqual([
      ["P1", "R1", 0],
      ["P2", "R2", 1],
    ]);
    expect(result.value.cards).toHaveLength(10);
    expect(result.value.cards.every((c) => c.generationId === "gen-1")).toBe(
      true,
    );
    expect(result.value.cards.every((c) => c.origin === "ai")).toBe(true);
    expect(result.value).toMatchObject({
      remainingToday: 4,
      truncated: false,
      wordsUsed: 150,
      wordsTotal: 150,
      generationId: "gen-1",
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });
    expect(await flashcards.countByPage(PAGE, OWNER)).toBe(10);
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
    const words = Array.from({ length: 150 }, (_, i) => `w${i}`).join(" ");
    const { deps, ai } = makeDeps({
      pages: stubPages({ title: "Larga", plainText: words }),
      tokenCap: 40, // 30 words
    });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value).toMatchObject({
      truncated: true,
      wordsUsed: 30,
      wordsTotal: 150,
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
    // 300 words carry the 20 cards.
    const { deps, ai } = makeDeps({
      pages: stubPages({ title: "Fotosíntesis", plainText: para("q", 300) }),
    });

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
          plainText: `${TEXT}\n${para("n", 100)}`,
        }),
      },
      OWNER,
    );

    // 100 new words: 6 cards after the first 10.
    expect(second.ok && second.value.cards.map((c) => c.position)).toEqual([
      10, 11, 12, 13, 14, 15,
    ]);
    expect(await flashcards.countByPage(PAGE, OWNER)).toBe(16);
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
    const [a, b] = [para("a", 75), para("b", 75)];
    const { deps, deck } = makeDeps({ pages: withText(`${a}\n\n${b}`) });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    expect((await deck.fingerprints.listByPage(PAGE, OWNER)).sort()).toEqual(
      [fingerprintParagraph(a), fingerprintParagraph(b)].sort(),
    );
  });

  it("answers NO_NEW_CONTENT without calling the AI nor consuming a unit", async () => {
    const [a, b] = [para("Uno", 75), para("Dos", 75)];
    const { deps, deck, limiter, ai } = makeDeps({
      pages: withText(`${a}\n${b}`),
    });
    await requestGeneration({ pageId: PAGE }, deps, OWNER);
    const checksBefore = limiter.checks;

    const again = await requestGeneration(
      { pageId: PAGE },
      {
        ...deps,
        pages: withText(`  ${a.toUpperCase().replace(/ /g, "   ")} \n\n ${b} `),
      },
      OWNER,
    );

    expect(!again.ok && again.error.code).toBe(FLASHCARD_ERROR.NO_NEW_CONTENT);
    expect(ai.calls).toHaveLength(1);
    expect(limiter.checks).toBe(checksBefore);
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(10);
  });

  it("sends only the added and the edited paragraphs, in page order", async () => {
    const [first, second2, added, edited] = [
      `Primero viejo ${para("v", 73)}`,
      `Segundo viejo ${para("w", 73)}`,
      `Nuevo inicio ${para("x", 48)}`,
      `Segundo editado ${para("w", 48)}`,
    ];
    const { deps, ai } = makeDeps({
      pages: withText(`${first}\n${second2}`),
    });
    await requestGeneration({ pageId: PAGE }, deps, OWNER);

    const second = await requestGeneration(
      { pageId: PAGE },
      {
        ...deps,
        pages: withText(`${added}\n${first}\n${edited}`),
      },
      OWNER,
    );

    expect(second.ok).toBe(true);
    const prompt = ai.calls[1]?.prompt ?? "";
    expect(prompt).toContain(`${added}\n${edited}`);
    expect(prompt).not.toContain("Primero viejo");
    expect(second.ok && second.value).toMatchObject({
      wordsUsed: 100,
      wordsTotal: 100,
    });
  });

  it("keeps the paragraphs a truncation cut new for the next generation", async () => {
    const [a, d, g] = [para("a", 100), para("d", 100), para("g", 100)];
    const { deps, deck, ai } = makeDeps({
      pages: withText(`${a}\n${d}\n${g}`),
      tokenCap: 160, // 120 words: the first paragraph whole, 20 of the second
    });

    const first = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(first.ok && first.value.truncated).toBe(true);
    expect(await deck.fingerprints.listByPage(PAGE, OWNER)).toEqual([
      fingerprintParagraph(a),
    ]);

    await requestGeneration({ pageId: PAGE }, deps, OWNER);
    expect(ai.calls[1]?.prompt).toContain(d);
    expect(ai.calls[1]?.prompt).not.toContain(a);
  });

  it("uses a paragraph longer than the cap once: the next Generar has nothing new", async () => {
    const { deps, ai, limiter } = makeDeps({
      pages: withText(para("a", 150)),
      tokenCap: 4, // 3 words: only the start of the one paragraph fits
    });
    await requestGeneration({ pageId: PAGE }, deps, OWNER);
    const checks = limiter.checks;

    const again = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!again.ok && again.error.code).toBe(FLASHCARD_ERROR.NO_NEW_CONTENT);
    expect(ai.calls).toHaveLength(1);
    expect(limiter.checks).toBe(checks);
  });

  it("stores no fingerprint when the generation fails", async () => {
    const { deps, deck } = makeDeps({ ai: makeAi("fail") });

    await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(await deck.fingerprints.listByPage(PAGE, OWNER)).toEqual([]);
  });

  it("sends the whole page when cards exist but no fingerprint (generated before T5c)", async () => {
    const [u, d] = [para("u", 75), para("d", 75)];
    const { deps, deck, ai } = makeDeps({ pages: withText(`${u}\n${d}`) });
    await requestGeneration({ pageId: PAGE }, deps, OWNER);
    // A page generated before the fingerprints existed: cards, no rows.
    deck.fingerprints.store.rows.clear();

    const again = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(again.ok).toBe(true);
    expect(ai.calls[1]?.prompt).toContain(`${u}\n${d}`);
    expect(await deck.flashcards.countByPage(PAGE, OWNER)).toBe(20);
  });
});

// Phase 8 H14 (user 2026-10-29): 100 words minimum, about 15 per card.
describe("requestGeneration — page content thresholds", () => {
  beforeEach(() => {
    ids = 0;
  });

  function withText(plainText: string) {
    return stubPages({ title: "Fotosíntesis", plainText });
  }

  it("answers AI_PAGE_TOO_SHORT under 100 words, before the limiter and the AI", async () => {
    const { deps, limiter, ai } = makeDeps({ pages: withText(para("c", 99)) });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(PAGE_TOO_SHORT_CODE);
    expect(!result.ok && result.error).toBeInstanceOf(PageTooShortError);
    expect(!result.ok && result.error).toMatchObject({
      words: 99,
      minWords: 100,
      maxItems: 6,
    });
    expect(limiter.checks).toBe(0);
    expect(ai.calls).toHaveLength(0);
  });

  it("counts only the new paragraphs", async () => {
    const old = para("o", 150);
    const { deps, limiter } = makeDeps({ pages: withText(old) });
    await requestGeneration({ pageId: PAGE }, deps, OWNER);
    const checks = limiter.checks;

    const again = await requestGeneration(
      { pageId: PAGE },
      { ...deps, pages: withText(`${old}\n${para("n", 40)}`) },
      OWNER,
    );

    expect(!again.ok && again.error).toMatchObject({
      code: PAGE_TOO_SHORT_CODE,
      words: 40,
    });
    expect(limiter.checks).toBe(checks);
  });

  it("refuses a requested count the words cannot carry", async () => {
    const { deps, limiter } = makeDeps({ pages: withText(para("c", 120)) });

    const result = await requestGeneration(
      { pageId: PAGE, count: 10 },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error).toMatchObject({
      code: PAGE_TOO_SHORT_CODE,
      words: 120,
      minWords: 150,
      maxItems: 8,
    });
    expect(limiter.checks).toBe(0);
  });

  it("asks for one card per 15 words: a 100-word page yields 6", async () => {
    const { deps, ai } = makeDeps({ pages: withText(para("c", 100)) });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.cards).toHaveLength(6);
    expect(ai.calls[0]?.system).toContain("exactly 6 cards");
  });

  it("marks only the share of the sent paragraphs the returned cards cover", async () => {
    const [a, b] = [para("a", 75), para("b", 75)];
    const { deps, deck } = makeDeps({
      pages: withText(`${a}\n${b}`),
      // 5 of the 10 cards asked for come back: half the words.
      ai: makeAi({
        cards: Array.from({ length: 5 }, (_, i) => ({
          front: `F${i}`,
          back: `B${i}`,
        })),
      }),
    });

    const result = await requestGeneration({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.cards).toHaveLength(5);
    expect(await deck.fingerprints.listByPage(PAGE, OWNER)).toEqual([
      fingerprintParagraph(a),
    ]);
  });
});
