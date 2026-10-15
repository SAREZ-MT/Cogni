# Doc–code alignment

## Objective
Make the code and the four technical documents (`docs/documentacion-tecnica/01-SRS.md`, `02-SAD.md`, `03-DATA-API.md`, `04-ADR.md`) say the same thing, without breaking any behaviour.

## Problem
Two audits on 2026-10-14 (main 476795c, then origin/main 1156274) found that the documents lag the code for Phases 3–5 and that six code-side items break documented architecture rules or hide a user-facing bug.

## Why
The technical docs are part of the thesis deliverable and the architecture rules only protect what dependency-cruiser actually enforces.

## Scope
- Code (branch `fix/doc-code-alignment`): T1–T6.
- Docs (separate branch after the code PR): T7–T11.
- Out of scope: new features, UI changes, behaviour changes beyond T4's error message.

## Constraints
- Nothing may break: typecheck, biome, depcruise, full Vitest and full Playwright suite must pass before any PR.
- No UI change except the login error copy selected in T4 (existing copy style).
- Ask before every push/PR (user rule).
- RDD is on (global); review per work-unit commit when `review_due`.

## Delivery
- Strategy: `ask-on-risk`. Forecast: code ~250 authored lines (1 PR); docs ~600+ lines (own PR, may be split per document).

## Tasks

### Code
- [x] T1 — `tsPreCompilationDeps: true` in `.dependency-cruiser.cjs`; move `TiptapDoc`/`TiptapNode` to `src/shared/kernel/tiptap-doc.ts` (notebooks re-exports them); editor owns `SavePagePort`; delete `notebooks/domain/save-page-port.ts` and its exports; fix stale comments/README. Route: delegated (multi-file).
- [x] T2 — `src/modules/identity/proxy.ts` light public entry re-exporting `updateSession`; `src/proxy.ts` imports it; new depcruise rule `proxy-via-public-entry`. Route: delegated.
- [x] T3 — remove `shared/redis` from `upstash-only-in-ai-infra` (`pathNot` + comment). Route: delegated (same writer, mechanical).
- [x] T4 — `/auth/callback`: a failed exchange no longer always lands on `/login?error=google`; pick the error by flow (Google vs email/reset link) and show matching copy. Test-first on the route + login page. Route: delegated.
- [x] T4b — carry the Google flow in a short-lived `cogni_auth_flow` cookie instead of `?flow=google`, so Google's `redirectTo` stays byte-identical to main (Supabase matches it against the Redirect URLs allowlist; RDD warnings R3/R4). Route: delegated.
- [x] T5 — single source for mastery thresholds (0.35 / 0.7): move to `src/shared/kernel`; `study-engine/domain/mastery.ts` and `src/shared/ui/mastery-level.ts` import them. Route: delegated.
- [x] T6 — `analytics/application/get-calibration.ts` must not reach `active-recall` Server Actions through its index; expose `calibrationOf` from a domain-only path allowed by the rules. Route: delegated.

### Docs
- [ ] T7 — §0 of the four documents: one consistent status note (Phases 0–7 implemented).
- [ ] T8 — 01-SRS: Phases 3–5 RF/CU to Implemented; RF-EX-02/03/07, CU-08, CU-01 (+ openspec spec + route comment), terms gate, `/terminos`, RNF counts, §2.3/§2.4, Phase 7 nits (N2–N8).
- [ ] T9 — 02-SAD: module statuses, AI stack + Upstash, 20 tables, 10 rules, CSP, 2 crons, env vars, study-engine view (doc 271/389), resilience, PostHog 5 events, deps map, test counts, ADR prefixes.
- [ ] T10 — 03-DATA-API: Phase 3–5 entities/SQL/FKs/enums, profiles terms columns, flashcards/exams actions, `/api/recompute-mastery`, env vars, NotebooksServerApi, Phase 7 nits.
- [ ] T11 — 04-ADR: index statuses, ADR-002/003/004/007/008/009/010/011 updates, new items, distinct prefix vs `docs/adr/`.

## Acceptance criteria
- `pnpm typecheck`, `pnpm exec biome ci`, `pnpm depcruise`, `pnpm test` and the full Playwright suite pass.
- depcruise with `tsPreCompilationDeps` reports 0 violations.
- A re-audit of the four docs reports no MISALIGNED item.

## Progress / evidence
- 2026-10-14: branch `fix/doc-code-alignment` from main 1156274. RDD: on (global).

- T1 (route: delegated): RED — with `tsPreCompilationDeps: true` on the old code, `pnpm depcruise` → `error domain-is-pure: src/modules/editor/domain/save-page-port.ts → src/modules/notebooks/index.ts` (1 violation). GREEN — typecheck 0 errors; biome ci clean (1159 files); depcruise 0 violations (1142 modules); vitest 415 files / 3824 tests passed. Commit: see `git log` (T1 commit `build(depcruise)`).
- T2 (route: delegated): RED — new rule with the old `src/proxy.ts` import → `error proxy-via-public-entry: src/proxy.ts → src/modules/identity/infrastructure/supabase-proxy-client.ts`. GREEN — typecheck 0 errors; biome ci clean (1160 files); depcruise 0 violations; vitest 415 files / 3824 tests passed (tests/proxy mocks of the infra path still apply through the re-export, left unchanged). Commit: `refactor(identity)` (see `git log`).
- T3 (route: delegated): config-only, no meaningful RED (`src/shared/redis` does not exist; the only `@upstash` importers are in `src/modules/ai/infrastructure/`). GREEN — typecheck 0 errors; biome ci clean; depcruise 0 violations; vitest 415 files / 3824 tests passed. Commit: `build(depcruise)` upstash rule (see `git log`).
- T5 (route: delegated): RED — new threshold tests in `mastery-level.test.ts` and `mastery.test.ts` failed with `Failed to resolve import "@/shared/kernel/mastery-thresholds"`. GREEN — both files 24/24; typecheck 0 errors; biome ci clean (1161 files); depcruise 0 violations (no rule restricts shared/ui → shared/kernel); vitest 415 files / 3826 tests passed. Commit: `refactor(mastery)` (see `git log`).
- T6 (route: delegated): RED — removed the `server-only` mock from `get-calibration.test.ts`; with the index import it failed (`This module cannot be imported from a Client Component module`). GREEN — import via `@/modules/active-recall/calibration` → 2/2 passing without the mock; `domain-entry-is-pure` proven by a temporary `./index` re-export in calibration.ts (flagged, then reverted); typecheck 0 errors; biome ci clean (1162 files); depcruise 0 violations (1145 modules); vitest 415 files / 3826 tests passed. Commit: `refactor(analytics)` (see `git log`).
- T4 (route: delegated): first blocked by a wrong surface path (login lives in `src/app/(public)/login`), then unblocked. Google's `redirectTo` carries `?flow=google`; a failed or code-less callback goes to `error=google` only for that flow, otherwise `error=link` with `AUTH_COPY.linkInvalid` ("El enlace no es válido o ya venció. Pide uno nuevo.") in the same notice as `googleCancelled`. Success path and `user_signed_in` tracking unchanged. RED — new `route.test.ts` (5 cases), 2 login page cases and a `signInWithGoogleAction` test: 4 failed / 14 passed. GREEN — 21/21. e2e `tests/e2e/auth.spec.ts` updated (no-code case expects `error=link`; new `flow=google` case), not yet run. Editor README fix committed separately as `docs(editor)`.
- 2026-10-14: the shared checkout was switched to `main` by another session mid-task; the T4 working tree was carried back to `fix/doc-code-alignment` and verified there.
- T4b (route: delegated): `signInWithGoogleAction` keeps `redirectTo: ${siteUrl()}${AUTH_CALLBACK_PATH}` exactly as main (git diff main shows no redirectTo change) and sets `cogni_auth_flow=google` (httpOnly, secure in production, sameSite=lax, path=/auth/callback, maxAge 600) only after the OAuth URL is obtained; the callback reads it from the request `cookie` header, ignores `?flow=google`, and clears it on every redirect. RED — rewritten `route.test.ts` + 2 action tests: 6 failed / 10 passed. GREEN — 19/19 (route, actions, tests/identity); typecheck 0 errors; biome ci exit 0; depcruise 0 violations (1146 modules); vitest 416 files / 3837 tests passed. e2e Google no-code case now sets the cookie via `context.addCookies` (not run). Commit: `fix(auth): carry the Google flow in a short-lived cookie, not the redirect URL` (see `git log`).

## Next step
Full Playwright suite, RDD assess per commit, then ask the user before push.
