import { describe, expect, it, vi } from "vitest";
import {
  AI_PURPOSES,
  nextProviders,
  selectProvider,
  vendorOf,
} from "../domain";
import {
  buildProviderEntries,
  buildProviderMap,
  GROQ_DAILY_CALLS,
  GROQ_MAX_PROMPT_TOKENS,
  GROQ_OUTPUT_HEADROOM_TOKENS,
  GROQ_TOKENS_PER_DAY,
  OPENROUTER_FREE_QUOTA_KEY,
} from "./provider-registry";

const openAiCompatibleSpy = vi.hoisted(() => vi.fn());
vi.mock("@ai-sdk/openai-compatible", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@ai-sdk/openai-compatible")>();
  return {
    ...actual,
    createOpenAICompatible: (
      ...args: Parameters<typeof actual.createOpenAICompatible>
    ) => {
      openAiCompatibleSpy(...args);
      return actual.createOpenAICompatible(...args);
    },
  };
});

const none = { AI_PROVIDER_MODE: "live" as const };
const all = {
  AI_PROVIDER_MODE: "live" as const,
  GOOGLE_GENERATIVE_AI_API_KEY: "g",
  GROQ_API_KEY: "q",
  CLOUDFLARE_ACCOUNT_ID: "acc",
  CLOUDFLARE_API_TOKEN: "tok",
  OPENROUTER_API_KEY: "o",
};

const usage = {};
const ctx = (purpose: Parameters<typeof selectProvider>[1]["purpose"]) => ({
  purpose,
  unhealthyIds: new Set<string>(),
  usage,
});

describe("buildProviderEntries", () => {
  it("is empty when no key is present", () => {
    expect(buildProviderEntries(none)).toEqual([]);
    expect(buildProviderMap(none).size).toBe(0);
  });

  it("builds only entries whose keys are present", () => {
    const ids = buildProviderEntries({
      ...none,
      GOOGLE_GENERATIVE_AI_API_KEY: "g",
      OPENROUTER_API_KEY: "o",
    }).map((e) => e.id);
    expect(ids).toEqual([
      "gemini-flash-lite",
      "gemini-3.1-flash-lite",
      "openrouter-nemotron",
      "openrouter-dots",
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3-flash",
      "gemini-2.5-flash-lite",
    ]);
  });

  it("skips Cloudflare unless both account id and token are set", () => {
    const ids = buildProviderEntries({
      ...none,
      CLOUDFLARE_ACCOUNT_ID: "acc",
    }).map((e) => e.id);
    expect(ids).toEqual([]);
  });

  it("orders generation: Gemini Flash-Lite, Cloudflare, OpenRouter, Gemini tail", () => {
    const entries = buildProviderEntries(all);
    const generation = nextProviders(entries, ctx("generate_flashcards")).map(
      (e) => [e.id, e.model, e.rpm, e.rpd],
    );
    expect(generation).toEqual([
      ["gemini-flash-lite", "gemini-3.5-flash-lite", 15, 500],
      ["gemini-3.1-flash-lite", "gemini-3.1-flash-lite", 15, 500],
      [
        "cloudflare-workers-ai",
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        30,
        13,
      ],
      ["openrouter-nemotron", "nvidia/nemotron-3.5-super-vl:free", 20, 1000],
      ["openrouter-dots", "dots-studio/dots-3-note-preview:free", 20, 1000],
      ["gemini-3.8-flash", "gemini-3.8-flash", 5, 20],
      ["gemini-3.6-flash", "gemini-3.6-flash", 5, 20],
      ["gemini-3-flash", "gemini-3-flash-preview", 5, 20],
      ["gemini-2.5-flash-lite", "gemini-2.5-flash-lite", 10, 20],
    ]);
  });

  it("orders evaluation by priority, Groq 120B first", () => {
    const entries = buildProviderEntries(all);
    for (const purpose of [
      "evaluate_recall_answer",
      "session_feedback",
    ] as const) {
      const ids = nextProviders(entries, ctx(purpose)).map((e) => e.id);
      expect(ids).toEqual([
        "groq-gpt-oss",
        "gemini-flash-lite",
        "gemini-3.1-flash-lite",
        "groq-gpt-oss-20b",
        "groq-qwen",
        "openrouter-nemotron",
        "openrouter-dots",
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3-flash",
        "gemini-2.5-flash-lite",
      ]);
    }
  });

  it("keeps Groq out of generation and first for evaluation", () => {
    const entries = buildProviderEntries(all);
    const groq = entries.find((e) => e.id === "groq-gpt-oss");
    expect(groq?.capabilities).toEqual([
      "evaluate_recall_answer",
      "session_feedback",
    ]);
    expect(selectProvider(entries, ctx("generate_flashcards"))?.id).toBe(
      "gemini-flash-lite",
    );
    expect(selectProvider(entries, ctx("evaluate_recall_answer"))?.id).toBe(
      "groq-gpt-oss",
    );
  });

  it("limits every Groq model by its token budget, not its 1,000 RPD", () => {
    const groq = buildProviderEntries(all).filter((e) =>
      e.id.startsWith("groq-"),
    );
    expect(groq.map((e) => [e.id, e.model])).toEqual([
      ["groq-gpt-oss", "openai/gpt-oss-120b"],
      ["groq-gpt-oss-20b", "openai/gpt-oss-20b"],
      ["groq-qwen", "qwen/qwen3.8-27b"],
    ]);
    for (const entry of groq) {
      // 200K TPD / (7K prompt ceiling + 1K output); 8K TPM allows one full
      // call a minute.
      expect(entry.rpd).toBe(GROQ_DAILY_CALLS);
      expect(entry.rpm).toBe(1);
      expect(entry.maxPromptTokens).toBe(GROQ_MAX_PROMPT_TOKENS);
      expect(entry.quotaKey).toBeUndefined();
    }
    expect(GROQ_MAX_PROMPT_TOKENS).toBe(7000);
    expect(GROQ_DAILY_CALLS).toBe(25);
    // A day of calls at the prompt ceiling plus output fits the TPD.
    expect(
      GROQ_DAILY_CALLS * (GROQ_MAX_PROMPT_TOKENS + GROQ_OUTPUT_HEADROOM_TOKENS),
    ).toBeLessThanOrEqual(GROQ_TOKENS_PER_DAY);
    expect(GROQ_TOKENS_PER_DAY).toBe(200_000);
  });

  it("tags every entry with its vendor", () => {
    const vendors = Object.fromEntries(
      buildProviderEntries(all).map((e) => [e.id, vendorOf(e)]),
    );
    expect(vendors).toEqual({
      "groq-gpt-oss": "groq",
      "gemini-flash-lite": "google",
      "gemini-3.1-flash-lite": "google",
      "groq-gpt-oss-20b": "groq",
      "cloudflare-workers-ai": "cloudflare",
      "groq-qwen": "groq",
      "openrouter-nemotron": "openrouter",
      "openrouter-dots": "openrouter",
      "gemini-3.8-flash": "google",
      "gemini-3.6-flash": "google",
      "gemini-3-flash": "google",
      "gemini-2.5-flash-lite": "google",
    });
  });

  it("spreads the two evaluation attempts over two vendors when groq-gpt-oss is skipped", () => {
    const entries = buildProviderEntries(all);
    const minuteSpent = { day: 1, minute: 1 };
    const cases: Record<string, typeof minuteSpent>[] = [
      { "groq-gpt-oss": minuteSpent },
      // Every Groq model spent its minute: OpenRouter takes the retry.
      {
        "groq-gpt-oss": minuteSpent,
        "groq-gpt-oss-20b": minuteSpent,
        "groq-qwen": minuteSpent,
      },
    ];
    for (const usage of cases) {
      const base = { ...ctx("evaluate_recall_answer"), usage };
      const first = selectProvider(entries, base);
      expect(first?.id).toBe("gemini-flash-lite");
      if (!first) return;
      const second = selectProvider(entries, {
        ...base,
        exclude: [first.id],
        avoidVendors: [vendorOf(first)],
      });
      expect(second).not.toBeNull();
      expect(vendorOf(second ?? first)).not.toBe(vendorOf(first));
    }
  });

  it("skips every Groq model for an evaluation prompt over its ceiling", () => {
    const entries = buildProviderEntries(all);
    const big = { ...ctx("evaluate_recall_answer"), promptTokens: 7001 };
    expect(selectProvider(entries, big)?.id).toBe("gemini-flash-lite");
    const fits = { ...ctx("evaluate_recall_answer"), promptTokens: 7000 };
    expect(selectProvider(entries, fits)?.id).toBe("groq-gpt-oss");
  });

  it("skips a Groq model once its daily budget is spent", () => {
    const entries = buildProviderEntries(all);
    const spent = {
      ...ctx("evaluate_recall_answer"),
      usage: { "groq-gpt-oss": { day: GROQ_DAILY_CALLS, minute: 0 } },
    };
    expect(nextProviders(entries, spent)[0]?.id).toBe("gemini-flash-lite");
    expect(nextProviders(entries, spent).map((e) => e.id)).toContain(
      "groq-gpt-oss-20b",
    );
  });

  it("caps Cloudflare at its 10K neurons a day (~13 generation calls)", () => {
    const cloudflare = buildProviderEntries(all).find(
      (e) => e.id === "cloudflare-workers-ai",
    );
    expect(cloudflare?.rpd).toBe(13);
    const spent = {
      ...ctx("generate_flashcards"),
      usage: {
        "gemini-flash-lite": { day: 500, minute: 0 },
        "gemini-3.1-flash-lite": { day: 500, minute: 0 },
        "cloudflare-workers-ai": { day: 13, minute: 0 },
      },
    };
    expect(selectProvider(buildProviderEntries(all), spent)?.id).toBe(
      "openrouter-nemotron",
    );
  });

  it("shares one 1,000/day OpenRouter budget across every :free entry", () => {
    const entries = buildProviderEntries(all);
    const openRouter = entries.filter((e) => e.id.startsWith("openrouter-"));
    expect(openRouter).toHaveLength(2);
    for (const entry of openRouter) {
      expect(entry.model.endsWith(":free")).toBe(true);
      expect(entry.quotaKey).toBe(OPENROUTER_FREE_QUOTA_KEY);
      expect(entry.rpd).toBe(1000);
      expect(entry.rpm).toBe(20);
      expect(entry.capabilities).toEqual(
        expect.arrayContaining([...AI_PURPOSES]),
      );
    }
    const spent = {
      ...ctx("generate_flashcards"),
      usage: { [OPENROUTER_FREE_QUOTA_KEY]: { day: 1000, minute: 0 } },
    };
    const ids = nextProviders(entries, spent).map((e) => e.id);
    expect(ids.some((id) => id.startsWith("openrouter-"))).toBe(false);
  });

  it("builds one AiProvider per entry, keyed by entry id", () => {
    const entries = buildProviderEntries(all);
    const map = buildProviderMap(all);
    expect([...map.keys()].sort()).toEqual(entries.map((e) => e.id).sort());
    for (const entry of entries) {
      expect(map.get(entry.id)?.model).toBe(entry.model);
    }
  });

  it("enables structured outputs for Cloudflare so JSON schemas are sent", () => {
    openAiCompatibleSpy.mockClear();
    buildProviderMap(all);
    expect(openAiCompatibleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "cloudflare-workers-ai",
        supportsStructuredOutputs: true,
      }),
    );
  });

  it("uses only the fake entry and provider in fake mode", () => {
    const env = { ...all, AI_PROVIDER_MODE: "fake" as const };
    const entries = buildProviderEntries(env);
    expect(entries.map((e) => e.id)).toEqual(["fake"]);
    expect(entries[0]?.capabilities).toContain("generate_flashcards");
    expect([...buildProviderMap(env).keys()]).toEqual(["fake"]);
  });
});
