# Module `flashcards`

Flashcards generated from a page (documento-maestro §3.3, §8). Phase 3 ships
generation and listing only; review sessions and SM-2 arrive in Phase 4.

## Layout

- `domain/`
  - `flashcard.ts` `Flashcard` entity and `createFlashcard` (trims, rejects an
    empty front or back with `FLASHCARD_EMPTY`).
  - `flashcard-repository.ts` `FlashcardRepository` port: `insertMany`,
    `listByPage`, `countByPage`, `nextPosition`, `countByOwnerGroupedByPage`.
  - `errors.ts` error codes.
- `application/` use cases, `(input, deps, ownerId)` returning `Result`:
  - `requestGeneration` reads the page text through the notebooks
    `PageTextReader` port, answers `PAGE_EMPTY` for a blank page, consumes one
    unit of the per-user daily limit (`DAILY_LIMIT_REACHED` with `resetAt`),
    truncates to `AI_PAGE_TOKEN_CAP`, calls `ai.generateStructured` with the
    `generate_flashcards/v1` prompt and persists the cards with consecutive
    positions. The page is read before the limiter, so a missing or blank page
    never costs a generation. Zero valid cards is `GENERATION_FAILED` and
    nothing is persisted.
  - `listFlashcardsByPage`, `listDecks` (one deck per page, count derived from
    its cards), `getGenerationStatus` (remaining generations, does not consume).
- `infrastructure/` `DrizzleFlashcardRepository` (table `flashcards`), checked
  by the same contract as the in-memory fake in `testing.ts`.
- `actions.ts` (`"use server"`): `generateFlashcardsAction`,
  `listFlashcardsAction`, `listDecksAction`, `getGenerationStatusAction`. They
  validate session and input, return `Result<T, ActionError>`, report failures
  to Sentry and emit the `generation_requested` event. `maxDuration` is declared
  on the page route that hosts the action.

## Environment

Read through the validated server env: `AI_DAILY_GENERATIONS` (default 6),
`AI_PAGE_TOKEN_CAP` (default 12000) and `AI_PROVIDER_MODE` (`fake` in CI and
e2e, no provider keys needed). Provider keys and Redis variables belong to the
`ai` module; see `src/modules/ai/README.md`, including the manual smoke script
that exercises real providers.

## Next phase

Phase 4: spaced repetition engine and review sessions (documento-maestro §13).
