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
  BudgetStore,
  GenerationRateLimiter,
  IdGenerator,
  QuotaStore,
} from "./application/ports";
import { InMemoryBreakerStore } from "./application/testing/in-memory-breaker-store";
import { InMemoryBudgetStore } from "./application/testing/in-memory-budget-store";
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
  UpstashBudgetStore,
  UpstashQuotaStore,
} from "./infrastructure";

// Model evaluation runs one recall session may take in a day (review F5):
// the first run plus two "Reintentar".
export const AI_EVALUATION_RUNS_PER_SESSION = 3;

export interface AiServerApi {
  generateStructured(
    input: GenerateStructuredInput,
    ownerId: string,
  ): Promise<Result<GenerateStructuredOutput, DomainError>>;
  // `check` consumes one unit per allowed call: invoke once per request.
  generationLimiter: GenerationRateLimiter;
  // Per-owner daily recall sessions evaluated by the model
  // (AI_DAILY_EVALUATIONS), under its own key: one unit per evaluated
  // session (all its written answers go in one call).
  evaluationLimiter: GenerationRateLimiter;
  // Per-owner daily session feedbacks (AI_DAILY_FEEDBACKS), under its own
  // key: one unit per feedback the model is asked for.
  feedbackLimiter: GenerationRateLimiter;
  // Keyed by recall session id, not owner: caps the model evaluation runs of
  // one session at AI_EVALUATION_RUNS_PER_SESSION per day.
  evaluationRunLimiter: GenerationRateLimiter;
  entries: readonly ProviderEntry[];
}

// Quota, breaker and limiter state of fake mode. Server Actions rebuild the
// api on every call, so fake mode keeps this state at module level by
// default; tests pass their own to stay isolated.
export interface FakeAiInfra {
  quota: QuotaStore;
  breakers: BreakerStore;
  limiter: GenerationRateLimiter;
  evaluationLimiter: GenerationRateLimiter;
  feedbackLimiter: GenerationRateLimiter;
  evaluationRunLimiter: GenerationRateLimiter;
  // Unlimited unless a test caps it: fake mode makes no real calls.
  budget: BudgetStore;
}

export function createFakeAiInfra(options?: {
  limit?: number;
  evaluationLimit?: number;
  feedbackLimit?: number;
  clock?: Clock;
}): FakeAiInfra {
  const clock = options?.clock ?? { now: () => new Date() };
  return {
    quota: new InMemoryQuotaStore(),
    breakers: new InMemoryBreakerStore(),
    limiter: createInMemoryGenerationLimiter({
      limit: options?.limit ?? 6,
      clock,
    }),
    evaluationLimiter: createInMemoryGenerationLimiter({
      limit: options?.evaluationLimit ?? 60,
      clock,
    }),
    feedbackLimiter: createInMemoryGenerationLimiter({
      limit: options?.feedbackLimit ?? 20,
      clock,
    }),
    evaluationRunLimiter: createInMemoryGenerationLimiter({
      limit: AI_EVALUATION_RUNS_PER_SESSION,
      clock,
    }),
    budget: new InMemoryBudgetStore(),
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
  let evaluationLimiter: GenerationRateLimiter;
  let feedbackLimiter: GenerationRateLimiter;
  let evaluationRunLimiter: GenerationRateLimiter;
  let budget: BudgetStore;
  if (env.AI_PROVIDER_MODE === "fake") {
    sharedFakeInfra ??= createFakeAiInfra({
      limit: env.AI_DAILY_GENERATIONS,
      evaluationLimit: env.AI_DAILY_EVALUATIONS,
      feedbackLimit: env.AI_DAILY_FEEDBACKS,
      clock,
    });
    const infra = deps.fakeInfra ?? sharedFakeInfra;
    ({
      quota,
      breakers,
      budget,
      evaluationLimiter,
      feedbackLimiter,
      evaluationRunLimiter,
    } = infra);
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
    evaluationLimiter = createDailyGenerationLimiter({
      redis,
      prefix: env.REDIS_KEY_PREFIX,
      limit: env.AI_DAILY_EVALUATIONS,
      scope: "eval",
    });
    feedbackLimiter = createDailyGenerationLimiter({
      redis,
      prefix: env.REDIS_KEY_PREFIX,
      limit: env.AI_DAILY_FEEDBACKS,
      scope: "feedback",
    });
    evaluationRunLimiter = createDailyGenerationLimiter({
      redis,
      prefix: env.REDIS_KEY_PREFIX,
      limit: AI_EVALUATION_RUNS_PER_SESSION,
      scope: "evalrun",
    });
    budget = new UpstashBudgetStore(redis, env.REDIS_KEY_PREFIX, {
      generation: env.AI_GLOBAL_DAILY_GENERATIONS,
      evaluation: env.AI_GLOBAL_DAILY_EVALUATIONS,
      feedback: env.AI_GLOBAL_DAILY_FEEDBACKS,
    });
  }

  return {
    entries,
    generationLimiter,
    evaluationLimiter,
    feedbackLimiter,
    evaluationRunLimiter,
    generateStructured: (input, ownerId) =>
      generateStructured(
        input,
        {
          entries,
          providers,
          quota,
          budget,
          breakers,
          generations,
          clock,
          ids,
        },
        ownerId,
      ),
  };
}
