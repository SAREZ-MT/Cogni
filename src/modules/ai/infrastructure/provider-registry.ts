import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { AiProviderMap } from "../application/ports";
import { AI_PURPOSES, type AiPurpose, type ProviderEntry } from "../domain";
import { createAiSdkProvider } from "./ai-sdk-provider";
import {
  createFakeLiveProvider,
  FAKE_MODEL_ID,
  FAKE_PROVIDER_ID,
} from "./fake-live-provider";

// The environment keys the registry reads (all optional).
export interface ProviderRegistryEnv {
  AI_PROVIDER_MODE?: "live" | "fake" | undefined;
  GOOGLE_GENERATIVE_AI_API_KEY?: string | undefined;
  GROQ_API_KEY?: string | undefined;
  CLOUDFLARE_ACCOUNT_ID?: string | undefined;
  CLOUDFLARE_API_TOKEN?: string | undefined;
  OPENROUTER_API_KEY?: string | undefined;
}

const EVALUATION_PURPOSES: readonly AiPurpose[] = [
  "evaluate_recall_answer",
  "session_feedback",
];
const GENERATION_PURPOSES = AI_PURPOSES.filter(
  (purpose) => !EVALUATION_PURPOSES.includes(purpose),
);

// THE provider table: ids, models, free-tier limits (rpm/rpd), capabilities
// and fallback priority live here and nowhere else. Model ids and limits are
// code-level defaults; an env override is a later task. Array order matters
// on equal priority: `selectProvider` is stable, so Groq (evaluation only)
// is listed before Gemini to win the evaluation tie at priority 1.
interface RegistryRow {
  entry: ProviderEntry;
  isConfigured: (env: ProviderRegistryEnv) => boolean;
  createModel: (env: ProviderRegistryEnv) => LanguageModel;
}

function openRouterModel(modelId: string) {
  return (env: ProviderRegistryEnv): LanguageModel =>
    createOpenRouter({ apiKey: env.OPENROUTER_API_KEY }).chat(modelId);
}

const ROWS: readonly RegistryRow[] = [
  {
    entry: {
      id: "groq-gpt-oss",
      model: "openai/gpt-oss-120b",
      capabilities: EVALUATION_PURPOSES,
      rpm: 30,
      rpd: 1000,
      priority: 1,
    },
    isConfigured: (env) => Boolean(env.GROQ_API_KEY),
    createModel: (env) =>
      createGroq({ apiKey: env.GROQ_API_KEY })("openai/gpt-oss-120b"),
  },
  {
    entry: {
      id: "gemini-flash-lite",
      model: "gemini-2.5-flash-lite",
      capabilities: [...GENERATION_PURPOSES, ...EVALUATION_PURPOSES],
      rpm: 10,
      rpd: 20,
      priority: 1,
    },
    isConfigured: (env) => Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY),
    createModel: (env) =>
      createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(
        "gemini-2.5-flash-lite",
      ),
  },
  {
    entry: {
      id: "cloudflare-workers-ai",
      model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      capabilities: GENERATION_PURPOSES,
      rpm: 30,
      rpd: 300,
      priority: 2,
    },
    isConfigured: (env) =>
      Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN),
    createModel: (env) =>
      createOpenAICompatible({
        name: "cloudflare-workers-ai",
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
        apiKey: env.CLOUDFLARE_API_TOKEN,
      }).chatModel("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
  },
  {
    entry: {
      id: "openrouter-qwen",
      model: "qwen/qwen3.8-27b:free",
      capabilities: GENERATION_PURPOSES,
      rpm: 20,
      rpd: 50,
      priority: 3,
    },
    isConfigured: (env) => Boolean(env.OPENROUTER_API_KEY),
    createModel: openRouterModel("qwen/qwen3.8-27b:free"),
  },
  {
    entry: {
      id: "openrouter-nemotron",
      model: "nvidia/nemotron-3-super-120b-a12b:free",
      capabilities: GENERATION_PURPOSES,
      rpm: 20,
      rpd: 50,
      priority: 4,
    },
    isConfigured: (env) => Boolean(env.OPENROUTER_API_KEY),
    createModel: openRouterModel("nvidia/nemotron-3-super-120b-a12b:free"),
  },
];

const FAKE_ENTRY: ProviderEntry = {
  id: FAKE_PROVIDER_ID,
  model: FAKE_MODEL_ID,
  capabilities: AI_PURPOSES,
  rpm: 1_000_000,
  rpd: 1_000_000,
  priority: 1,
};

function activeRows(env: ProviderRegistryEnv): RegistryRow[] {
  return ROWS.filter((row) => row.isConfigured(env));
}

// Configured entries in fallback order; only providers whose keys are present.
// Fake mode returns the fake entry alone.
export function buildProviderEntries(
  env: ProviderRegistryEnv,
): ProviderEntry[] {
  if (env.AI_PROVIDER_MODE === "fake") return [FAKE_ENTRY];
  return activeRows(env).map((row) => row.entry);
}

export function buildProviderMap(env: ProviderRegistryEnv): AiProviderMap {
  if (env.AI_PROVIDER_MODE === "fake") {
    return new Map([[FAKE_PROVIDER_ID, createFakeLiveProvider()]]);
  }
  return new Map(
    activeRows(env).map((row) => [
      row.entry.id,
      createAiSdkProvider({
        id: row.entry.id,
        modelId: row.entry.model,
        model: row.createModel(env),
      }),
    ]),
  );
}
