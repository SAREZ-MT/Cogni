# Module `ai`

Provider registry, quota-aware rotation, structured output, versioned prompts
and rate limiting (documento-maestro §8).

## Layout

- `domain/` pure rules, no npm imports at all (`domain-is-pure` rejects even
  `zod`):
  - `purpose.ts` the six `AiPurpose` values.
  - `generation.ts` `AiGeneration` entity (§6.1) with guarded status
    transitions (`startGeneration`, `completeGeneration`, `failGeneration`).
  - `provider.ts` `ProviderEntry`, `selectProvider`, `nextProviders`.
  - `circuit-breaker.ts` 3 failures open a provider for 10 minutes (§8.2).
  - `truncate.ts` `truncateToTokenCap`, word-based page cap.
  - `errors.ts` `AI_ERROR` codes.
- `application/`
  - `ports.ts` `AiProvider`, `QuotaStore`, `BreakerStore`,
    `AiGenerationRepository`, `IdGenerator`. They live here, not in `domain/`,
    because `AiProvider` needs the Zod type and `domain-is-pure` forbids npm.
  - `generate-structured.ts` the single entry point for model calls: select
    provider, call, validate with the purpose schema, audit every attempt,
    retry once on the next provider, never a third call.
  - `prompts/<purpose>/v1.ts` versioned prompt builders (`generate_flashcards`,
    `evaluate_recall_answer/v1`: explicit 0–5 rubric scale, page fragment and
    answer sent as tagged data, Spanish justification, temperature 0.2).
  - `schemas/` Zod output schema per purpose (§8.4) and `outputSchemaFor`.
  - `testing/` in-memory fakes, re-exported by `src/modules/ai/testing.ts`.
- `infrastructure/` the only place the AI SDK and Upstash packages may be
  imported (enforced by `pnpm depcruise`):
  - `provider-registry.ts` the one provider table (ids, models, rpm/rpd,
    capabilities, priority); `buildProviderEntries(env)` and
    `buildProviderMap(env)` include only providers whose keys are set. Groq is
    evaluation-only. Fake mode returns the `fake` entry alone.
  - `ai-sdk-provider.ts` `createAiSdkProvider` adapts a `LanguageModel` to the
    `AiProvider` port through `generateObject` (injectable for tests).
  - `upstash-quota-store.ts`, `upstash-breaker-store.ts`,
    `upstash-rate-limiter.ts` Redis adapters under `{REDIS_KEY_PREFIX}:ai:*`;
    they depend on the `RedisLike` subset (`redis-like.ts`), with an in-memory
    double in `testing/in-memory-redis.ts`.
  - `fake-live-provider.ts` deterministic provider for `AI_PROVIDER_MODE=fake`;
    `in-memory-rate-limiter.ts` its daily limiters. Its recall evaluation
    scores an answer by the share of the rubric's key concepts it mentions.
    Failure switches for e2e (evaluation prompts only): an answer holding
    `[falla-ia]` fails on every call; one holding `[falla-ia-una-vez]` fails
    the first time that exact prompt is seen in the server process, then
    succeeds (so "Reintentar" can evaluate it).
  - `drizzle-ai-generation-repository.ts` Postgres adapter.
- `server-api.ts` composition root (`createAiServerApi`), exported from
  `index.ts`; live mode uses Upstash, fake mode keeps in-memory quota, breaker
  and limiter state at module level.

Other modules import only from `index.ts`.

## Environment

Server only, never `NEXT_PUBLIC_*` (validated in `src/shared/config/env.schema.ts`):

- `AI_PROVIDER_MODE` `live` (default) or `fake`. Fake mode needs no keys: the
  registry holds one deterministic provider and quota, breaker and limiter
  state stay in memory. CI and e2e use it.
- Live mode needs `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and at
  least one generation provider: `GOOGLE_GENERATIVE_AI_API_KEY`,
  `OPENROUTER_API_KEY`, or `CLOUDFLARE_ACCOUNT_ID` plus `CLOUDFLARE_API_TOKEN`
  (set together). `GROQ_API_KEY` enables the evaluation-only entry.
- `REDIS_KEY_PREFIX` (default `cogni:dev`, `cogni:prod` in production),
  `AI_DAILY_GENERATIONS` (default 6, key `{prefix}:ai:gen`),
  `AI_DAILY_EVALUATIONS` (default 60 answers evaluated by the model per user
  and day, own key `{prefix}:ai:eval`, exposed as `evaluationLimiter`),
  `AI_PAGE_TOKEN_CAP` (default 12000).

Decisions and dropped providers: `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md`.

Known follow-up: `generateObject` is deprecated in `ai@7.0.127` in favor of
`generateText` with `Output.object`; migrate in `ai-sdk-provider.ts`.

## Manual provider smoke script

`scripts/ai-smoke.mts` proves the Phase 3 done criterion against the real
providers: with one provider's day quota exhausted, the next one serves. It is
manual and never runs in CI: it needs real keys in `.env.local` and consumes
real quota (2 provider calls).

```
pnpm ai:smoke                          # generate, exhaust gemini-flash-lite, generate again
pnpm ai:smoke --exhaust <providerId>   # exhaust another registry entry
pnpm ai:smoke --restore [--exhaust <providerId>]
pnpm ai:smoke --dry-run                # print the plan, no network, no keys needed
```

Step 1 generates 3 flashcards from a built-in sample text and prints
`provider / model / status / tokens / latency`. Step 2 saves the provider's
current day counter under `{prefix}:ai:smoke:backup:{provider}`, sets the day
key `{prefix}:ai:quota:{provider}:{yyyy-mm-dd}` to the provider's `rpd` (same
TTL as the store, key built by the store's `quotaKeys`) and generates again.
It exits 0 only when the serving provider differs from the exhausted one.
Generations use an in-memory repository (no `ai_generations` rows) and the
owner id `smoke`; per-user rate limit keys are never touched.

Always run `pnpm ai:smoke --restore` afterwards: until then the provider looks
exhausted to the app that shares the same `REDIS_KEY_PREFIX`. Restore puts the
saved counter back (or deletes the key if there was none). Pure helpers
(argument parsing, key plan, summary) live in `infrastructure/smoke/lib.ts`
with unit tests.
