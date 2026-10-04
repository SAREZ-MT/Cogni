import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import {
  BREAKER_FAILURE_THRESHOLD,
  initialBreakerState,
  type ProviderEntry,
} from "../domain";
import { AI_ERROR } from "../domain/errors";
import {
  type GenerateStructuredDeps,
  type GenerateStructuredInput,
  generateStructured,
} from "./generate-structured";
import { FakeAiProvider } from "./testing/fake-ai-provider";
import { InMemoryAiGenerationRepository } from "./testing/in-memory-ai-generation-repository";
import { InMemoryBreakerStore } from "./testing/in-memory-breaker-store";
import { InMemoryQuotaStore } from "./testing/in-memory-quota-store";
import { SequentialIds } from "./testing/sequential-ids";

const OWNER = "owner-1";
const NOW = new Date("2026-10-03T12:00:00.000Z");
const GOOD = { cards: [{ front: "Q", back: "A" }] };

function entry(id: string, priority: number, over?: Partial<ProviderEntry>) {
  return {
    id,
    model: `${id}-model`,
    capabilities: ["generate_flashcards", "evaluate_recall_answer"],
    rpm: 5,
    rpd: 10,
    priority,
    ...over,
  } as ProviderEntry;
}

type Outcome = ConstructorParameters<typeof FakeAiProvider>[2];

function setup(scripts: Record<string, Outcome>, entries?: ProviderEntry[]) {
  const list = entries ?? [entry("a", 1), entry("b", 2), entry("c", 3)];
  const fakes = new Map<string, FakeAiProvider>();
  for (const e of list) {
    fakes.set(e.id, new FakeAiProvider(e.id, e.model, scripts[e.id] ?? []));
  }
  const quota = new InMemoryQuotaStore();
  const breakers = new InMemoryBreakerStore();
  const generations = new InMemoryAiGenerationRepository();
  const deps: GenerateStructuredDeps = {
    entries: list,
    providers: fakes,
    quota,
    breakers,
    generations,
    clock: createFixedClock(NOW),
    ids: new SequentialIds(),
  };
  const totalCalls = () =>
    [...fakes.values()].reduce((n, f) => n + f.calls.length, 0);
  return { deps, fakes, quota, breakers, generations, totalCalls };
}

function input(
  over?: Partial<GenerateStructuredInput>,
): GenerateStructuredInput {
  return {
    purpose: "generate_flashcards",
    pageId: "page-1",
    promptVersion: "generate_flashcards/v1",
    system: "sys",
    prompt: "prompt",
    temperature: 0.7,
    ...over,
  };
}

describe("provider selection", () => {
  it("uses the priority-1 provider and returns the typed object", async () => {
    const t = setup({ a: [{ object: GOOD }] });
    const r = await generateStructured(input(), t.deps, OWNER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.object).toEqual(GOOD);
    expect(r.value.generation.provider).toBe("a");
    expect(r.value.generation.status).toBe("done");
    expect(r.value.generation.inputTokens).toBe(10);
    expect(r.value.generation.outputTokens).toBe(20);
    expect(r.value.generation.latencyMs).toBe(5);
    expect(t.totalCalls()).toBe(1);
  });

  it("skips a provider whose daily quota is exhausted", async () => {
    const t = setup({ b: [{ object: GOOD }] });
    t.quota.seed("a", { day: 10, minute: 0 });
    const r = await generateStructured(input(), t.deps, OWNER);
    expect(r.ok && r.value.generation.provider).toBe("b");
    expect(t.fakes.get("a")?.calls).toHaveLength(0);
  });

  it("skips a provider whose breaker is open", async () => {
    const t = setup({ b: [{ object: GOOD }] });
    await t.breakers.write("a", {
      consecutiveFailures: BREAKER_FAILURE_THRESHOLD,
      openedAt: new Date(NOW.getTime() - 1000),
    });
    const r = await generateStructured(input(), t.deps, OWNER);
    expect(r.ok && r.value.generation.provider).toBe("b");
  });

  it("returns NO_PROVIDER_AVAILABLE with no row and no call", async () => {
    const t = setup({}, [entry("a", 1, { capabilities: [] })]);
    const r = await generateStructured(input(), t.deps, OWNER);
    expect(!r.ok && r.error.code).toBe(AI_ERROR.NO_PROVIDER_AVAILABLE);
    expect(t.generations.all()).toHaveLength(0);
    expect(t.totalCalls()).toBe(0);
  });
});

describe("retry once on failure", () => {
  it("retries on the next provider after a schema-invalid answer", async () => {
    const t = setup({ a: [{ invalid: true }], b: [{ object: GOOD }] });
    const r = await generateStructured(input(), t.deps, OWNER);
    expect(r.ok && r.value.generation.provider).toBe("b");
    const rows = t.generations.all();
    expect(rows.map((g) => [g.provider, g.status])).toEqual([
      ["a", "failed"],
      ["b", "done"],
    ]);
    expect(t.totalCalls()).toBe(2);
  });

  it("retries on the next provider after a thrown error", async () => {
    const t = setup({
      a: [{ throw: new Error("boom sk-secret") }],
      b: [{ object: GOOD }],
    });
    const r = await generateStructured(input(), t.deps, OWNER);
    expect(r.ok).toBe(true);
    const rows = t.generations.all();
    expect(rows.map((g) => g.status)).toEqual(["failed", "done"]);
    expect(rows[0].error).not.toContain("sk-secret");
    expect(t.totalCalls()).toBe(2);
  });

  it("fails with GENERATION_FAILED after two failures, never a third call", async () => {
    const t = setup({
      a: [{ invalid: true }],
      b: [{ throw: new Error("x") }],
      c: [{ object: GOOD }],
    });
    const r = await generateStructured(input(), t.deps, OWNER);
    expect(!r.ok && r.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    const rows = t.generations.all();
    expect(rows.map((g) => g.status)).toEqual(["failed", "failed"]);
    expect(t.totalCalls()).toBe(2);
    expect(t.fakes.get("c")?.calls).toHaveLength(0);
    if (!r.ok) {
      expect((r.error as { generationId?: string }).generationId).toBe(
        rows[1].id,
      );
    }
  });

  it("fails with GENERATION_FAILED when no provider is left to retry", async () => {
    const t = setup({ a: [{ invalid: true }] }, [entry("a", 1)]);
    const r = await generateStructured(input(), t.deps, OWNER);
    expect(!r.ok && r.error.code).toBe(AI_ERROR.GENERATION_FAILED);
    expect(t.generations.all()).toHaveLength(1);
    expect(t.totalCalls()).toBe(1);
  });
});

describe("circuit breaker", () => {
  it("opens the breaker on the third consecutive failure", async () => {
    const t = setup({ a: [{ invalid: true }], b: [{ object: GOOD }] });
    await t.breakers.write("a", {
      consecutiveFailures: BREAKER_FAILURE_THRESHOLD - 1,
      openedAt: null,
    });
    await generateStructured(input(), t.deps, OWNER);
    const state = await t.breakers.read("a");
    expect(state.consecutiveFailures).toBe(BREAKER_FAILURE_THRESHOLD);
    expect(state.openedAt).toEqual(NOW);
  });

  it("resets the breaker on success", async () => {
    const t = setup({ a: [{ object: GOOD }] });
    await t.breakers.write("a", { consecutiveFailures: 2, openedAt: null });
    await generateStructured(input(), t.deps, OWNER);
    expect(await t.breakers.read("a")).toEqual(initialBreakerState);
  });
});

describe("quota accounting", () => {
  it("records one call per attempt", async () => {
    const t = setup({ a: [{ invalid: true }], b: [{ object: GOOD }] });
    await generateStructured(input(), t.deps, OWNER);
    expect(t.quota.recorded).toEqual([
      { providerId: "a", now: NOW },
      { providerId: "b", now: NOW },
    ]);
  });
});

describe("temperature clamp", () => {
  it("caps generation purposes at 0.7", async () => {
    const t = setup({ a: [{ object: GOOD }] });
    await generateStructured(input({ temperature: 1.5 }), t.deps, OWNER);
    expect(t.fakes.get("a")?.calls[0].temperature).toBe(0.7);
  });

  it("caps evaluation purposes at 0.3", async () => {
    const evalOut = {
      score: 3,
      presentConcepts: [],
      missingConcepts: [],
      misconceptions: [],
      justification: "ok",
    };
    const t = setup({ a: [{ object: evalOut }] });
    await generateStructured(
      input({ purpose: "evaluate_recall_answer", temperature: 0.7 }),
      t.deps,
      OWNER,
    );
    expect(t.fakes.get("a")?.calls[0].temperature).toBe(0.3);
  });

  it("keeps a lower temperature untouched", async () => {
    const t = setup({ a: [{ object: GOOD }] });
    await generateStructured(input({ temperature: 0.2 }), t.deps, OWNER);
    expect(t.fakes.get("a")?.calls[0].temperature).toBe(0.2);
  });
});

describe("ownership and audit", () => {
  it("stores owner, page, purpose and prompt version on every row", async () => {
    const t = setup({ a: [{ invalid: true }], b: [{ object: GOOD }] });
    await generateStructured(input(), t.deps, OWNER);
    for (const g of t.generations.all()) {
      expect(g.ownerId).toBe(OWNER);
      expect(g.pageId).toBe("page-1");
      expect(g.purpose).toBe("generate_flashcards");
      expect(g.promptVersion).toBe("generate_flashcards/v1");
    }
  });

  it("scopes findById to the owner", async () => {
    const t = setup({ a: [{ object: GOOD }] });
    const r = await generateStructured(input(), t.deps, OWNER);
    if (!r.ok) throw new Error("expected ok");
    const id = r.value.generation.id;
    expect(await t.generations.findById(id, OWNER)).not.toBeNull();
    expect(await t.generations.findById(id, "someone-else")).toBeNull();
  });
});
