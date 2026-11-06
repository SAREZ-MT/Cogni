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

const ALL_PURPOSES = [...GENERATION_PURPOSES, ...EVALUATION_PURPOSES];

// Groq free tier, per model (owner's dashboard, 2026-11-06): 30 RPM and
// 1,000 RPD, but only 8K TPM and 200K TPD, so tokens bind first. A full
// batched evaluation is ~5.5K tokens in and out: 200K / 5.5K ≈ 36 calls a
// day, and 8K TPM leaves room for one such call a minute. A prompt over 7K
// estimated tokens cannot fit the minute window with its answer, so it
// skips Groq.
export const GROQ_MAX_PROMPT_TOKENS = 7000;
const GROQ_LIMITS = {
  rpm: 1,
  rpd: 36,
  maxPromptTokens: GROQ_MAX_PROMPT_TOKENS,
} as const;

// OpenRouter: with $10 of credit the account gets 1,000 requests a day on
// `:free` models, shared account-wide, and 20 RPM. Every `:free` row
// spends this one key.
export const OPENROUTER_FREE_QUOTA_KEY = "openrouter-free";
const OPENROUTER_FREE_LIMITS = {
  rpm: 20,
  rpd: 1000,
  quotaKey: OPENROUTER_FREE_QUOTA_KEY,
} as const;

// THE provider table: ids, models, free-tier limits (rpm/rpd), capabilities
// and fallback priority live here and nowhere else. Model ids and limits are
// code-level defaults; an env override is a later task. Array order matters
// on equal priority: `selectProvider` is stable. Evaluation alternates Groq
// and Gemini (120B, 3.5, 3.1, 20B, Qwen) so the two attempts of one call
// land on two vendors; generation never uses Groq (its 8K TPM is below the
// 12K page cap).
interface RegistryRow {
  entry: ProviderEntry;
  isConfigured: (env: ProviderRegistryEnv) => boolean;
  createModel: (env: ProviderRegistryEnv) => LanguageModel;
}

function groqRow(id: string, modelId: string, priority: number): RegistryRow {
  return {
    entry: {
      id,
      model: modelId,
      capabilities: EVALUATION_PURPOSES,
      priority,
      ...GROQ_LIMITS,
    },
    isConfigured: (env) => Boolean(env.GROQ_API_KEY),
    createModel: (env) => createGroq({ apiKey: env.GROQ_API_KEY })(modelId),
  };
}

// Free-tier limits read by the owner in AI Studio (project Cogni) on
// 2026-11-06; Google no longer publishes them. Model ids checked against
// aistudio.google.com/docs/models the same day.
function geminiRow(
  id: string,
  modelId: string,
  limits: { rpm: number; rpd: number; priority: number },
): RegistryRow {
  return {
    entry: { id, model: modelId, capabilities: ALL_PURPOSES, ...limits },
    isConfigured: (env) => Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY),
    createModel: (env) =>
      createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(
        modelId,
      ),
  };
}

// OpenRouter retires `:free` models without notice; both rows were checked
// against /api/v1/models/<id>/endpoints (structured outputs supported) on
// 2026-10-28. The adapter asks for the purpose's JSON schema the same way
// for every purpose, so they serve evaluation too.
function openRouterRow(
  id: string,
  modelId: string,
  priority: number,
): RegistryRow {
  return {
    entry: {
      id,
      model: modelId,
      capabilities: ALL_PURPOSES,
      priority,
      ...OPENROUTER_FREE_LIMITS,
    },
    isConfigured: (env) => Boolean(env.OPENROUTER_API_KEY),
    createModel: (env) =>
      createOpenRouter({ apiKey: env.OPENROUTER_API_KEY }).chat(modelId),
  };
}

const ROWS: readonly RegistryRow[] = [
  groqRow("groq-gpt-oss", "openai/gpt-oss-120b", 1),
  geminiRow("gemini-flash-lite", "gemini-3.5-flash-lite", {
    rpm: 15,
    rpd: 500,
    priority: 1,
  }),
  geminiRow("gemini-3.1-flash-lite", "gemini-3.1-flash-lite", {
    rpm: 15,
    rpd: 500,
    priority: 1,
  }),
  groqRow("groq-gpt-oss-20b", "openai/gpt-oss-20b", 2),
  {
    entry: {
      id: "cloudflare-workers-ai",
      model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      capabilities: GENERATION_PURPOSES,
      rpm: 30,
      // Free tier is 10K neurons a day: about 13 generation calls of ~12K
      // tokens in and ~2K out.
      rpd: 13,
      priority: 2,
    },
    isConfigured: (env) =>
      Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN),
    createModel: (env) =>
      createOpenAICompatible({
        name: "cloudflare-workers-ai",
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
        apiKey: env.CLOUDFLARE_API_TOKEN,
        // Without this the provider omits `response_format` and Cloudflare
        // returns free text instead of the schema-shaped JSON object.
        supportsStructuredOutputs: true,
      }).chatModel("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
  },
  // Groq lists Qwen as a preview model (may change without notice), so it
  // comes after the production gpt-oss models.
  groqRow("groq-qwen", "qwen/qwen3.8-27b", 3),
  openRouterRow("openrouter-nemotron", "nvidia/nemotron-3.5-super-vl:free", 3),
  openRouterRow("openrouter-dots", "dots-studio/dots-3-note-preview:free", 4),
  // Low-quota tail (20 RPD each): only once everything above is spent.
  geminiRow("gemini-3.8-flash", "gemini-3.8-flash", {
    rpm: 5,
    rpd: 20,
    priority: 5,
  }),
  geminiRow("gemini-3.6-flash", "gemini-3.6-flash", {
    rpm: 5,
    rpd: 20,
    priority: 5,
  }),
  geminiRow("gemini-3-flash", "gemini-3-flash-preview", {
    rpm: 5,
    rpd: 20,
    priority: 5,
  }),
  geminiRow("gemini-2.5-flash-lite", "gemini-2.5-flash-lite", {
    rpm: 10,
    rpd: 20,
    priority: 5,
  }),
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
