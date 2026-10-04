// Composition root of the ai module (no "use server": not a client-reachable
// entry point, like notebooks/server-api.ts). Other modules call it through
// `index.ts`.
import type { ServerEnv } from "@/shared/config/env.schema";
import type { Db } from "@/shared/db/client";
import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import {
  type GenerateStructuredInput,
  type GenerateStructuredOutput,
  generateStructured,
} from "./application/generate-structured";
import type {
  AiGenerationRepository,
  BreakerStore,
  GenerationRateLimiter,
  IdGenerator,
  QuotaStore,
} from "./application/ports";
import { InMemoryBreakerStore } from "./application/testing/in-memory-breaker-store";
import { InMemoryQuotaStore } from "./application/testing/in-memory-quota-store";
import type { ProviderEntry } from "./domain";
import {
  buildProviderEntries,
  buildProviderMap,
  createDailyGenerationLimiter,
  createInMemoryGenerationLimiter,
  createUpstashRedis,
  DrizzleAiGenerationRepository,
  UpstashBreakerStore,
  UpstashQuotaStore,
} from "./infrastructure";

export interface AiServerApi {
  generateStructured(
    input: GenerateStructuredInput,
    ownerId: string,
  ): Promise<Result<GenerateStructuredOutput, DomainError>>;
  // `check` consumes one unit per allowed call: invoke once per request.
  generationLimiter: GenerationRateLimiter;
  entries: readonly ProviderEntry[];
}

// Quota, breaker and limiter state of fake mode. Server Actions rebuild the
// api on every call, so fake mode keeps this state at module level by
// default; tests pass their own to stay isolated.
export interface FakeAiInfra {
  quota: QuotaStore;
  breakers: BreakerStore;
  limiter: GenerationRateLimiter;
}

export function createFakeAiInfra(options?: {
  limit?: number;
  clock?: Clock;
}): FakeAiInfra {
  return {
    quota: new InMemoryQuotaStore(),
    breakers: new InMemoryBreakerStore(),
    limiter: createInMemoryGenerationLimiter({
      limit: options?.limit ?? 6,
      clock: options?.clock ?? { now: () => new Date() },
    }),
  };
}

let sharedFakeInfra: FakeAiInfra | undefined;

export function createAiServerApi(deps: {
  env: ServerEnv;
  db: Db;
  clock: Clock;
  ids: IdGenerator;
  // Defaults to the Drizzle repository, also in fake mode: flashcards
  // reference ai_generations through a foreign key.
  generations?: AiGenerationRepository;
  fakeInfra?: FakeAiInfra;
}): AiServerApi {
  const { env, clock, ids } = deps;
  const entries = buildProviderEntries(env);
  const providers = buildProviderMap(env);
  const generations =
    deps.generations ?? new DrizzleAiGenerationRepository(deps.db);

  let quota: QuotaStore;
  let breakers: BreakerStore;
  let generationLimiter: GenerationRateLimiter;
  if (env.AI_PROVIDER_MODE === "fake") {
    sharedFakeInfra ??= createFakeAiInfra({
      limit: env.AI_DAILY_GENERATIONS,
      clock,
    });
    const infra = deps.fakeInfra ?? sharedFakeInfra;
    ({ quota, breakers } = infra);
    generationLimiter = infra.limiter;
  } else {
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error("Upstash credentials are required in live mode");
    }
    const redis = createUpstashRedis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    quota = new UpstashQuotaStore(redis, env.REDIS_KEY_PREFIX);
    breakers = new UpstashBreakerStore(redis, env.REDIS_KEY_PREFIX);
    generationLimiter = createDailyGenerationLimiter({
      redis,
      prefix: env.REDIS_KEY_PREFIX,
      limit: env.AI_DAILY_GENERATIONS,
    });
  }

  return {
    entries,
    generationLimiter,
    generateStructured: (input, ownerId) =>
      generateStructured(
        input,
        { entries, providers, quota, breakers, generations, clock, ids },
        ownerId,
      ),
  };
}
