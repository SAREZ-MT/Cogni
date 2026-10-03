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
- `application/` `schemas/` holds the Zod output schema per purpose (§8.4)
  and `outputSchemaFor`; ports and the `generateStructured` use case are
  planned.
- `infrastructure/` (planned) AI SDK providers and Upstash adapters; the only
  place those packages may be imported (enforced by `pnpm depcruise`).

Other modules import only from `index.ts`.
