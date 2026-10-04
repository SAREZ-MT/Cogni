// Manual smoke test of the real AI providers (documento-maestro §13, Phase 3
// done criterion). Run by hand with real keys in .env.local:
//
//   pnpm ai:smoke                         generate, exhaust gemini, generate again
//   pnpm ai:smoke --exhaust <providerId>  exhaust another provider instead
//   pnpm ai:smoke --restore               put the exhausted day counter back
//   pnpm ai:smoke --dry-run               print the plan, no network
//
// It consumes real provider quota (2 calls), never writes ai_generations rows
// (in-memory repository) and never touches per-user rate limit keys.
import nextEnv from "@next/env";
import { generateStructured } from "@/modules/ai/application/generate-structured";
import {
  buildGenerateFlashcardsPrompt,
  GENERATE_FLASHCARDS_PROMPT_VERSION,
} from "@/modules/ai/application/prompts/generate_flashcards/v1";
import {
  buildProviderEntries,
  buildProviderMap,
  type ProviderRegistryEnv,
} from "@/modules/ai/infrastructure/provider-registry";
import {
  evaluateOutcome,
  formatSummary,
  parseArgs,
  planExhaustion,
  type SmokeRow,
} from "@/modules/ai/infrastructure/smoke/lib";
import { UpstashBreakerStore } from "@/modules/ai/infrastructure/upstash-breaker-store";
import { UpstashQuotaStore } from "@/modules/ai/infrastructure/upstash-quota-store";
import { createUpstashRedis } from "@/modules/ai/infrastructure/upstash-redis";
import {
  InMemoryAiGenerationRepository,
  SequentialIds,
} from "@/modules/ai/testing";

// @next/env is CommonJS, hence the default import (same as playwright.config).
nextEnv.loadEnvConfig(process.cwd());

const OWNER_ID = "smoke";
const SAMPLE_TITLE = "La fotosíntesis";
const SAMPLE_TEXT = [
  "La fotosíntesis es el proceso por el cual las plantas, las algas y algunas",
  "bacterias convierten la energía de la luz en energía química. Ocurre en los",
  "cloroplastos, que contienen clorofila, el pigmento que absorbe la luz.",
  "En la fase luminosa se produce ATP y NADPH y se libera oxígeno al dividir",
  "el agua. En el ciclo de Calvin, la planta usa ese ATP y NADPH para fijar",
  "dióxido de carbono y formar glucosa.",
].join(" ");

function fail(message: string): never {
  console.error(`ai-smoke: ${message}`);
  process.exit(1);
}

const parsed = parseArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(`ai-smoke: ${parsed.error}`);
  process.exit(2);
}
const { options } = parsed;

const rawEnv = process.env;
const prefix = rawEnv.REDIS_KEY_PREFIX || "cogni:dev";

// Dry run needs no secrets: pretend every provider is configured so the plan
// can name any registry entry. Never used to build real providers.
const registryEnv: ProviderRegistryEnv = options.dryRun
  ? {
      AI_PROVIDER_MODE: "live",
      GOOGLE_GENERATIVE_AI_API_KEY: "dry-run",
      CLOUDFLARE_ACCOUNT_ID: "dry-run",
      CLOUDFLARE_API_TOKEN: "dry-run",
      OPENROUTER_API_KEY: "dry-run",
      GROQ_API_KEY: "dry-run",
    }
  : {
      AI_PROVIDER_MODE: "live",
      GOOGLE_GENERATIVE_AI_API_KEY: rawEnv.GOOGLE_GENERATIVE_AI_API_KEY,
      GROQ_API_KEY: rawEnv.GROQ_API_KEY,
      CLOUDFLARE_ACCOUNT_ID: rawEnv.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: rawEnv.CLOUDFLARE_API_TOKEN,
      OPENROUTER_API_KEY: rawEnv.OPENROUTER_API_KEY,
    };
const entries = buildProviderEntries(registryEnv);

const plan = planExhaustion({
  prefix,
  providerId: options.exhaust,
  entries,
  now: new Date(),
});
if (!plan.ok) fail(plan.error);
const target = plan.plan;

if (options.dryRun) {
  console.log("ai-smoke dry run (no network)");
  console.log(`prefix: ${prefix}`);
  if (options.mode === "restore") {
    console.log(`would read ${target.backupKey}`);
    console.log("would put the saved day counter back (or delete the key)");
    console.log(`would delete ${target.backupKey}`);
  } else {
    console.log("step 1: generate 3 flashcards, print provider/model/status");
    console.log(
      `save previous value of ${target.dayKey} in ${target.backupKey}`,
    );
    console.log(
      `step 2: set ${target.dayKey} = ${target.value} (ttl ${target.ttlSeconds} s), generate again`,
    );
    console.log(`pass when the serving provider is not ${target.providerId}`);
    console.log("then run: pnpm ai:smoke --restore");
  }
  process.exit(0);
}

const url = rawEnv.UPSTASH_REDIS_REST_URL;
const token = rawEnv.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  fail("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
}
const redis = createUpstashRedis({ url, token });

// The backup holds the day key too, so --restore still finds it after UTC
// midnight.
interface Backup {
  dayKey: string;
  previous: number | null;
}

async function restore(): Promise<void> {
  const raw = await redis.get<string | Backup>(target.backupKey);
  if (raw === null) {
    console.log("ai-smoke: nothing to restore");
    return;
  }
  const backup: Backup = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (backup.previous === null) {
    await redis.del(backup.dayKey);
  } else {
    await redis.set(backup.dayKey, backup.previous, {
      ex: target.ttlSeconds,
    });
  }
  await redis.del(target.backupKey);
  console.log(
    `ai-smoke: restored ${backup.dayKey} to ${backup.previous ?? "unset"}`,
  );
}

if (options.mode === "restore") {
  await restore();
  process.exit(0);
}

if (entries.length === 0) {
  fail("no generation provider is configured in .env.local");
}

const generations = new InMemoryAiGenerationRepository();
const deps = {
  entries,
  providers: buildProviderMap(registryEnv),
  quota: new UpstashQuotaStore(redis, prefix),
  breakers: new UpstashBreakerStore(redis, prefix),
  generations,
  clock: { now: () => new Date() },
  ids: new SequentialIds(),
};

async function generate(step: string): Promise<SmokeRow> {
  const built = buildGenerateFlashcardsPrompt({
    pageTitle: SAMPLE_TITLE,
    pageText: SAMPLE_TEXT,
    count: 3,
  });
  const result = await generateStructured(
    {
      purpose: "generate_flashcards",
      pageId: null,
      promptVersion: GENERATE_FLASHCARDS_PROMPT_VERSION,
      ...built,
    },
    deps,
    OWNER_ID,
  );
  const rows = generations.all();
  const last = rows[rows.length - 1];
  if (result.ok) {
    const g = result.value.generation;
    return {
      step,
      provider: g.provider,
      model: g.model,
      status: g.status,
      tokens: g.inputTokens + g.outputTokens,
      latencyMs: g.latencyMs,
    };
  }
  return {
    step,
    provider: last?.provider ?? "-",
    model: last?.model ?? "-",
    status: `failed (${result.error.code})`,
    tokens: 0,
    latencyMs: last?.latencyMs ?? 0,
  };
}

const rows: SmokeRow[] = [];
let exitCode = 0;
try {
  rows.push(await generate("1 baseline"));

  const previousRaw = await redis.get<number | string>(target.dayKey);
  const backup: Backup = {
    dayKey: target.dayKey,
    previous: previousRaw === null ? null : Number(previousRaw),
  };
  await redis.set(target.backupKey, JSON.stringify(backup), {
    ex: target.ttlSeconds,
  });
  await redis.set(target.dayKey, target.value, {
    ex: target.ttlSeconds,
  });
  console.log(
    `ai-smoke: ${target.providerId} day quota set to ${target.value}`,
  );

  rows.push(await generate(`2 ${target.providerId} exhausted`));

  console.log(formatSummary(rows));
  const outcome = evaluateOutcome(
    target.providerId,
    rows[0] as SmokeRow,
    rows[1] as SmokeRow,
  );
  if (outcome.pass) {
    console.log("ai-smoke: PASS, the next provider served");
  } else {
    console.error(`ai-smoke: FAIL, ${outcome.reason}`);
    exitCode = 1;
  }
} catch (error) {
  // Error names only: provider messages can echo request data or secrets.
  const name = error instanceof Error ? error.name : "UnknownError";
  console.error(`ai-smoke: FAIL, ${name}`);
  if (rows.length > 0) console.log(formatSummary(rows));
  exitCode = 1;
}
console.log("ai-smoke: run `pnpm ai:smoke --restore` to put the quota back");
process.exit(exitCode);
