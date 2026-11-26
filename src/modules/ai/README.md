# Module `ai`

Provider registry, quota-aware rotation, structured output, versioned prompts
and rate limiting (documento-maestro §8).

## Layout

- `domain/` pure rules, no npm imports at all (`domain-is-pure` rejects even
  `zod`):
  - `purpose.ts` the six `AiPurpose` values.
  - `generation.ts` `AiGeneration` entity (§6.1) with guarded status
    transitions (`startGeneration`, `completeGeneration`, `failGeneration`).
  - `provider.ts` `ProviderEntry`, `selectProvider`, `nextProviders`,
    `quotaKeyOf` (entries with the same `quotaKey` share one rpm/rpd budget)
    and the optional `maxPromptTokens` ceiling (a bigger estimated prompt
    skips the entry), and `vendorOf` (the optional `vendor`; a retry passes
    over the failed vendor while another is eligible).
  - `circuit-breaker.ts` 3 failures open a provider for 10 minutes (§8.2).
  - `truncate.ts` `truncateToTokenCap`, word-based page cap, `estimateTokens`
    (ceil(words / 0.75)) and `EVALUATION_PROMPT_TOKEN_BUDGET` (6,500: the
    batched recall evaluation shrinks its page fragments to fit it). Words are counted
    with the shared definition in `src/shared/kernel/words.ts`, the same one
    the incremental generation uses for its paragraph counts (Phase 6).
  - `errors.ts` `AI_ERROR` codes.
- `application/`
  - `ports.ts` `AiProvider`, `QuotaStore`, `BreakerStore`,
    `AiGenerationRepository`, `IdGenerator`. They live here, not in `domain/`,
    because `AiProvider` needs the Zod type and `domain-is-pure` forbids npm.
  - `generate-structured.ts` the single entry point for model calls: select
    provider, call, validate with the purpose schema, audit every attempt,
    retry once on the next provider (of another vendor when one is
    eligible: `avoidVendors`), never a third call.
  - `prompts/<purpose>/v<n>.ts` versioned prompt builders, registered in
    `application/index.ts`: `generate_flashcards/v2`,
    `generate_exam_questions/v2`, `generate_exam_variants/v2`,
    `session_feedback/v5` (flashcards, a Socratic tutor's voice) and `v4`
    (exams),
    `generate_recall_questions/v2` (10 open questions with a rubric per call,
    lists up to 60 of the page's active questions to avoid repeats,
    temperature 0.7) and `evaluate_recall_answer/v3` (every written answer
    of a recall session in one call, one `<answer_item>` per answer with its
    rubric, page fragment and answer as tagged data, answers capped at 4000
    characters, output `{ evaluations: [{ questionId, … }] }` of at most 10;
    explicit 0–5 rubric scale, Spanish justification, temperature 0.2). Decisions for the recall prompts:
    `docs/adr/0007-recordacion-activa-y-generacion-incremental.md`.
  - `schemas/` Zod output schema per purpose (§8.4) and `outputSchemaFor`.
  - `testing/` in-memory fakes, re-exported by `src/modules/ai/testing.ts`.
- `infrastructure/` the only place the AI SDK and Upstash packages may be
  imported (enforced by `pnpm depcruise`):
  - `provider-registry.ts` the one provider table (ids, models, rpm/rpd,
    capabilities, priority); `buildProviderEntries(env)` and
    `buildProviderMap(env)` include only providers whose keys are set. Groq is
    evaluation-only. Fake mode returns the `fake` entry alone. The table is
    below.
  - `ai-sdk-provider.ts` `createAiSdkProvider` adapts a `LanguageModel` to the
    `AiProvider` port through `generateObject` (injectable for tests).
  - `upstash-quota-store.ts`, `upstash-breaker-store.ts`,
    `upstash-rate-limiter.ts` Redis adapters under `{REDIS_KEY_PREFIX}:ai:*`;
    they depend on the `RedisLike` subset (`redis-like.ts`), with an in-memory
    double in `testing/in-memory-redis.ts`.
  - `fake-live-provider.ts` deterministic provider for `AI_PROVIDER_MODE=fake`;
    `in-memory-rate-limiter.ts` its daily limiters. Its recall evaluation
    scores an answer by the share of the rubric's key concepts it mentions.
    Failure switches for e2e (evaluation batches only): an answer holding
    `[falla-ia]` is left without an evaluation on every call; one holding
    `[falla-ia-una-vez]` is left out the first time that exact answer is seen
    in the server process, then evaluated once (so "Reintentar" can evaluate
    it); a batch where every answer is left out fails the call; at most 100
    failed answers are remembered.
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
  (set together). `GROQ_API_KEY` enables the three evaluation-only Groq
  entries; one Google key serves every Gemini entry and one OpenRouter key
  both `:free` entries.
- `REDIS_KEY_PREFIX` (default `cogni:dev`, `cogni:prod` in production),
  `AI_PAGE_TOKEN_CAP` (default 12000).
- Per-user daily limits (fixed UTC-day windows in Upstash, one key each):
  `AI_DAILY_GENERATIONS` (default 20, key `{prefix}:ai:gen`, one unit per
  model call that generates, so an exam or retake of two batches costs two),
  `AI_DAILY_EVALUATIONS` (default 10 recall sessions evaluated by the model,
  key `{prefix}:ai:eval`, exposed as `evaluationLimiter`) and
  `AI_DAILY_FEEDBACKS` (default 20 session feedbacks, key
  `{prefix}:ai:feedback`, exposed as `feedbackLimiter`). A recall session
  gets at most 3 model evaluation runs a day (`evaluationRunLimiter`, key
  `{prefix}:ai:evalrun`, keyed by session id).
- App-wide daily budgets, all users together, one unit per provider attempt:
  `AI_GLOBAL_DAILY_GENERATIONS` (default 700), `AI_GLOBAL_DAILY_EVALUATIONS`
  (350) and `AI_GLOBAL_DAILY_FEEDBACKS` (700), counted under
  `{prefix}:ai:budget:{group}:{yyyy-mm-dd}`. `generateStructured` charges the
  budget of the purpose's group before each attempt and fails closed: a spent
  budget, or a Redis error while checking it, ends the call with
  `AI_DAILY_BUDGET_EXHAUSTED` and no provider is called. Fake mode has no
  budget.

## Providers

Fallback order is by priority, then table order. `generateStructured` makes at
most 2 attempts per call (each attempt spends quota; the breaker and the next
call skip a failing provider). Limits are the owner's dashboard values of
2026-11-06; for token-bound providers `rpm`/`rpd` are the call counts their
token budget allows.

| id | model | purposes | rpm / rpd | priority |
|---|---|---|---|---|
| `groq-gpt-oss` | `openai/gpt-oss-120b` | evaluation, feedback | 1 / 25, prompt ≤ 7K | 1 |
| `gemini-flash-lite` | `gemini-3.5-flash-lite` | all | 15 / 500 | 1 |
| `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | all | 15 / 500 | 1 |
| `groq-gpt-oss-20b` | `openai/gpt-oss-20b` | evaluation, feedback | 1 / 25, prompt ≤ 7K | 2 |
| `cloudflare-workers-ai` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | generation | 30 / 13 | 2 |
| `groq-qwen` | `qwen/qwen3.8-27b` (Groq preview) | evaluation, feedback | 1 / 25, prompt ≤ 7K | 3 |
| `openrouter-nemotron` | `nvidia/nemotron-3.5-super-vl:free` | all | 20 / 1000 shared | 3 |
| `openrouter-dots` | `dots-studio/dots-3-note-preview:free` | all | 20 / 1000 shared | 4 |
| `gemini-3.8-flash` | `gemini-3.8-flash` | all | 5 / 20 | 5 |
| `gemini-3.6-flash` | `gemini-3.6-flash` | all | 5 / 20 | 5 |
| `gemini-3-flash` | `gemini-3-flash-preview` | all | 5 / 20 | 5 |
| `gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` | all | 10 / 20 | 5 |

- Groq (per model): 30 RPM and 1,000 RPD, but 8K TPM and 200K TPD bind
  first. `GROQ_DAILY_CALLS` sizes the day for the worst admitted call, the
  7K prompt ceiling plus 1K of output: 200K / 8K = 25 calls a day; one full
  call a minute fits 8K TPM. A prompt over 7K estimated tokens skips every
  Groq entry.
- Cloudflare: 10K neurons a day ≈ 13 generation calls (~12K in, ~2K out).
- OpenRouter: $10 of credit gives 1,000 requests a day on `:free` models,
  account-wide; every `:free` row spends the shared quota key
  `openrouter-free` (`{prefix}:ai:quota:openrouter-free:*`).
- Every row has a `vendor` (`groq`, `google`, `cloudflare`, `openrouter`).
  The retry prefers another vendor, so when `groq-gpt-oss` has spent its
  minute and the first attempt lands on `gemini-flash-lite`, the second goes
  to `groq-gpt-oss-20b` (or Qwen, or OpenRouter), not to
  `gemini-3.1-flash-lite` behind the same Google key; only with no other
  vendor eligible does it stay on the same one.
- Left out: `gemini-2.5-flash` (deprecated, new users cannot select it, and
  from 2026-12-01 it routes to 3.5 Flash-Lite) and Gemma 4 (out of scope).

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
`{provider}` is the entry's quota key, so exhausting an OpenRouter entry
exhausts the shared `openrouter-free` budget of both.
It exits 0 only when the serving provider differs from the exhausted one.
Generations use an in-memory repository (no `ai_generations` rows) and the
owner id `smoke`; per-user rate limit keys are never touched.

Always run `pnpm ai:smoke --restore` afterwards: until then the provider looks
exhausted to the app that shares the same `REDIS_KEY_PREFIX`. Restore puts the
saved counter back (or deletes the key if there was none). Pure helpers
(argument parsing, key plan, summary) live in `infrastructure/smoke/lib.ts`
with unit tests.
