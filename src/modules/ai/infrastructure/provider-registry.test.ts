import { describe, expect, it, vi } from "vitest";
import { selectProvider } from "../domain";
import { buildProviderEntries, buildProviderMap } from "./provider-registry";

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
      "openrouter-qwen",
      "openrouter-nemotron",
    ]);
  });

  it("skips Cloudflare unless both account id and token are set", () => {
    const ids = buildProviderEntries({
      ...none,
      CLOUDFLARE_ACCOUNT_ID: "acc",
    }).map((e) => e.id);
    expect(ids).toEqual([]);
  });

  it("orders generation fallbacks Gemini, Cloudflare, Qwen, Nemotron", () => {
    const entries = buildProviderEntries(all);
    const generation = entries
      .filter((e) => e.capabilities.includes("generate_flashcards"))
      .sort((a, b) => a.priority - b.priority)
      .map((e) => [e.id, e.model, e.rpm, e.rpd]);
    expect(generation).toEqual([
      ["gemini-flash-lite", "gemini-3.5-flash-lite", 15, 500],
      [
        "cloudflare-workers-ai",
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        30,
        300,
      ],
      ["openrouter-qwen", "qwen/qwen3.8-27b:free", 20, 50],
      ["openrouter-nemotron", "nvidia/nemotron-3-super-120b-a12b:free", 20, 50],
    ]);
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
