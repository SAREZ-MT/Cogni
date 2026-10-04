import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { buildGenerateFlashcardsPrompt } from "./application/prompts/generate_flashcards/v1";
import { InMemoryAiGenerationRepository } from "./application/testing/in-memory-ai-generation-repository";
import { SequentialIds } from "./application/testing/sequential-ids";
import { createAiServerApi, createFakeAiInfra } from "./server-api";

const env = {
  AI_PROVIDER_MODE: "fake" as const,
  AI_DAILY_GENERATIONS: 2,
  REDIS_KEY_PREFIX: "cogni:test",
} as never;

function build() {
  const generations = new InMemoryAiGenerationRepository();
  const api = createAiServerApi({
    env,
    db: {} as never,
    clock: createFixedClock(new Date("2026-10-03T10:00:00Z")),
    ids: new SequentialIds(),
    generations,
    fakeInfra: createFakeAiInfra({ limit: 2 }),
  });
  return { api, generations };
}

const built = buildGenerateFlashcardsPrompt({
  pageTitle: "Célula",
  pageText: "La mitocondria produce energía. El núcleo guarda el ADN.",
  count: 2,
});
const input = {
  purpose: "generate_flashcards" as const,
  pageId: "page-1",
  promptVersion: "generate_flashcards/v1",
  ...built,
};

describe("createAiServerApi in fake mode", () => {
  it("exposes only the fake entry", () => {
    expect(build().api.entries.map((e) => e.id)).toEqual(["fake"]);
  });

  it("generates end to end and audits the generation", async () => {
    const { api, generations } = build();
    const result = await api.generateStructured(input, "owner-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.generation.provider).toBe("fake");
    expect(result.value.generation.status).toBe("done");
    const stored = await generations.findById(
      result.value.generation.id,
      "owner-1",
    );
    expect(stored?.status).toBe("done");
  });

  it("limits generations per owner and day", async () => {
    const { api } = build();
    const first = await api.generationLimiter.check("owner-1");
    expect(first).toMatchObject({ allowed: true, remaining: 1 });
    await api.generationLimiter.check("owner-1");
    const third = await api.generationLimiter.check("owner-1");
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect((await api.generationLimiter.check("owner-2")).allowed).toBe(true);
  });
});
