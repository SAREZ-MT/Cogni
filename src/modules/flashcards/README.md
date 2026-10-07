# Module `flashcards`

Flashcards generated from a page or written by hand (documento-maestro §3.3,
§8). Every card owns a `StudyItem` of the `study-engine` module (§3.4),
created with the card and suspended when the card is archived. Review
sessions are scheduled by `study-engine`; this module adds the card text.

## Layout

- `domain/`
  - `flashcard.ts` `Flashcard` entity (`archivedAt` is the logical delete),
    `createFlashcard` (trims, rejects an empty front or back with
    `FLASHCARD_EMPTY`) and `MAX_FLASHCARD_SIDE_LENGTH` (1000, manual cards).
  - `flashcard-repository.ts` `FlashcardRepository` port: `insertMany`,
    `findById`, `listByPage`, `countByPage`, `nextPosition`,
    `countByOwnerGroupedByPage`, `archive`, `lockDeck`. Every read except
    `findById` and `nextPosition` ignores archived cards.
  - `errors.ts` error codes.
- `application/` use cases, `(input, deps, ownerId)` returning `Result`:
  - `deck-unit-of-work.ts` `DeckUnitOfWork` port: runs a deck change against
    the flashcard repository and the study items (`DeckStudyItems`, a slice of
    `StudyItemRepository`) so both commit or roll back together.
  - `createManualFlashcard` checks the page through `PageTextReader`, enforces
    the trimmed side limit (`FLASHCARD_TOO_LONG`), and adds the card at the end
    of the deck with its due study item. A page without cards has no deck; its
    first card starts it.
  - `archiveFlashcard` archives the card and suspends its study item. The
    deck's last active card is refused with `FLASHCARD_LAST_CARD` (a deck is
    never empty); the deck is locked before counting.
  - `requestGeneration` reads the page text through the notebooks
    `PageTextReader` port, answers `PAGE_EMPTY` for a blank page, consumes one
    unit of the per-user daily limit (`DAILY_LIMIT_REACHED` with `resetAt`),
    truncates to `AI_PAGE_TOKEN_CAP`, calls `ai.generateStructured` with the
    `generate_flashcards/v1` prompt and persists the cards with consecutive
    positions and their study items in one unit of work. The page is read
    before the limiter, so a missing or blank page
    never costs a generation. Zero valid cards is `GENERATION_FAILED` and
    nothing is persisted. Incremental (Phase 6 T5c): only the paragraphs
    flashcards has not used on the page yet (new or edited, by fingerprint in
    `generation_fingerprints`) are sent; their fingerprints are stored with
    the cards. Nothing new answers `FLASHCARDS_NO_NEW_CONTENT` with no AI call
    and no unit; a page generated before T5c sends every paragraph once.
  - `listFlashcardsByPage`, `listDecks` (one deck per page, count derived from
    its cards), `getGenerationStatus` (remaining generations, does not consume).
  - `requestSessionFeedback` (§3.3, §8.4) asks the AI for feedback on a
    finished session with at least one graded answer
    (`FLASHCARDS_FEEDBACK_SESSION_OPEN`, `FLASHCARDS_FEEDBACK_NOTHING_REVIEWED`)
    using the `session_feedback/v1` prompt (counts per button and up to 8
    hardest fronts, never study time). It only peeks the daily AI limit and
    never consumes it. Idempotent per session: the first request claims the
    session's single `SessionFeedback` row, later ones read it back; a
    `pending` row untouched for `STALE_PENDING_MS` (2 min) is reclaimed; the
    AI wait is capped at `FEEDBACK_AI_TIMEOUT_MS` (25 s). The final write uses
    `settlePending`, so a `done` or `failed` row is never overwritten: when
    the write did not apply or its outcome is unknown, the stored row is
    returned. Any failure ends as `failed` and still returns `ok`, so it never
    blocks closing the session. See ADR 0005.
- `infrastructure/` `DrizzleFlashcardRepository` (table `flashcards`), checked
  by the same contract as the in-memory fake in `testing.ts`;
  `DrizzleDeckUnitOfWork` runs each deck change in one Postgres transaction
  and builds both repositories on it (`lockDeck` is `SELECT ... FOR UPDATE`
  on the page row).
- `actions.ts` (`"use server"`): `generateFlashcardsAction`,
  `listFlashcardsAction`, `listDecksAction`, `getGenerationStatusAction`,
  `createFlashcardAction`, `archiveFlashcardAction` (both revalidate the
  `/flashcards` layout). They
  validate session and input, return `Result<T, ActionError>`, report failures
  to Sentry and emit the `generation_requested` event. `maxDuration` is declared
  on the page route that hosts the action.
- `session-actions.ts` (`"use server"`), the review session (§3.3, §7.2):
  `startFlashcardSessionAction` (`{ pageId? }`, the due cards of one page or
  of every page, with their text and the days each button would schedule),
  `gradeFlashcardAction` (`{ sessionId, itemId, rating }`, rating
  `again | hard | good | easy`; returns the session counts and the page's
  mastery level, no revalidation mid-session) and
  `finishFlashcardSessionAction` (counts only, never study time; revalidates
  the `/flashcards` layout) and `requestSessionFeedbackAction`
  (`{ sessionId }`, returns the feedback `status` and `content`). Scheduling
  goes through study-engine's `createFlashcardSessionsServerApi`; feedback
  reads its data through `createSessionFeedbackSources`.
- `action-support.ts` the boundary helpers both action files share (session,
  Zod parsing, never-throw wrapper, deck revalidation).

## Environment

Read through the validated server env: `AI_DAILY_GENERATIONS` (default 6),
`AI_PAGE_TOKEN_CAP` (default 12000) and `AI_PROVIDER_MODE` (`fake` in CI and
e2e, no provider keys needed). Provider keys and Redis variables belong to the
`ai` module; see `src/modules/ai/README.md`, including the manual smoke script
that exercises real providers.

## UI

`src/app/(app)/flashcards/`: the deck page reviews in place (`DeckReview`,
`FlashcardPlayer` with the four SM-2 buttons, `SessionFeedbackPanel` at the
end) and starts once when opened with `?repasar=1`; `/flashcards` shows
"Repasos de hoy" (`DueTodayList`, from the `scheduling` module) and the due
count of every deck; `NewFlashcardDialog` adds manual cards.

## Next phase

Phase 4 is closed (documento-maestro §13, ADR 0005). Exams (Phase 5) reuse
the same study engine.
