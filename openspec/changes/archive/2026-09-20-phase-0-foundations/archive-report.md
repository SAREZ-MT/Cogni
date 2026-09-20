# Archive Report: Phase 0 Foundations

**Change**: phase-0-foundations  
**Status**: Complete and Archived  
**Date Archived**: 2026-09-20  
**Archive Path**: `openspec/changes/archive/2026-09-20-phase-0-foundations/`

---

## Executive Summary

Phase 0 of Cogni (phase-0-foundations) is complete and production-ready. All 38 tasks were completed successfully across four chained pull requests (PR #1–#4, plus PR #5 for production fixes and PR #6 for phase closure). The change establishes the executable foundation for Cogni: Next.js 16 scaffold with strict TypeScript, unified tooling (Biome, Vitest, Playwright, dependency-cruiser), Tailwind v4 design tokens, Supabase auth with Google OAuth, Drizzle ORM migrations, observability stack (Sentry + PostHog), and CI/CD pipelines (GitHub Actions + Vercel). Production deployment verified at https://www.cogni-dev.com with full registration, email verification, login, and shell functionality.

---

## Engram Observation IDs (Traceability)

The following observations document the SDD lifecycle for this change and are archived for reference:

- **#4**: sdd/phase-0-foundations/explore — Exploration and current-state assessment
- **#7**: sdd/phase-0-foundations/proposal — Phase intent, scope, and rollback plan
- **#9, #11**: sdd/phase-0-foundations/spec — Four domain specifications (delta specs)
- **#10**: sdd/phase-0-foundations/design — Technical approach and architecture decisions
- **#15**: sdd/phase-0-foundations/tasks — 38-task breakdown and delivery plan (38/38 complete)
- **#36**: Cogni Phase 0 complete decision — 2026-09-20 verification summary

---

## Archived Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| **proposal.md** | Present | Phase intent: register → email verify → login → shell on production |
| **design.md** | Present | Four-PR delivery with Next.js 16 scaffold, design tokens, auth, observability |
| **exploration.md** | Present | Baseline assessment; no application code existed |
| **specs/** | Present | Four domains: project-tooling, design-tokens-and-shell, identity-auth, observability-and-delivery |
| **specs/project-tooling/spec.md** | Copied to openspec/specs/ | Package manager, TypeScript strict, unified lint/format (Biome), test runners (Vitest + Playwright) |
| **specs/design-tokens-and-shell/spec.md** | Copied to openspec/specs/ | Tailwind v4 @theme, DM Sans/JetBrains Mono, shell layout (sidebar + topbar), responsive, WCAG 2.1 AA |
| **specs/identity-auth/spec.md** | Copied to openspec/specs/ | Supabase email + Google OAuth, profiles table with RLS, three Actions (sign-up/in/out), middleware session refresh |
| **specs/observability-and-delivery/spec.md** | Copied to openspec/specs/ | Sentry client/server, PostHog analytics, GitHub Actions pipelines, Vercel integration, security headers (CSP, X-Frame-Options, etc.) |
| **tasks.md** | Present | All 38/38 tasks checked; delivery split: PR1 (tooling), PR2 (shell), PR3 (auth/Drizzle), PR4 (observability) |
| **apply-progress.md** | Present | Intermediate snapshot of implementation progress during apply phase |
| **state.yaml** | Present | Recovery hint; change state metadata |

---

## Specs Synced to Main

All four delta specs have been copied to `openspec/specs/` as primary sources of truth:

| Domain | Source | Status |
|--------|--------|--------|
| project-tooling | openspec/specs/project-tooling/spec.md | ✓ Copied and verified (empty diff) |
| design-tokens-and-shell | openspec/specs/design-tokens-and-shell/spec.md | ✓ Copied and verified (empty diff) |
| identity-auth | openspec/specs/identity-auth/spec.md | ✓ Copied and verified (empty diff) |
| observability-and-delivery | openspec/specs/observability-and-delivery/spec.md | ✓ Copied and verified (empty diff) |

### Specification Domains

#### 1. Project Tooling
Establishes the executable foundation: `create-next-app` scaffolding reorganized to `src/` layout, `pnpm` pinned as package manager, TypeScript `strict: true`, single-source-of-truth lint/format tool (Biome via `pnpm biome ci`), test runners (Vitest + jsdom + Testing Library for unit; Playwright for e2e), and dependency rules (dependency-cruiser with 6 enforcement rules on layers and scoped imports).

**Key Requirements Met**:
- pnpm 9.x pinned in packageManager and engines
- TypeScript strict mode enabled; alias paths (`@/*`) configured
- Biome configuration with consistent formatting
- Vitest with jsdom and Testing Library
- Playwright e2e tests with proper fixtures
- 10-module skeleton structure under `src/modules/` with README scaffolds
- Dependency-cruiser rules enforce layer separation and scoped isolation

#### 2. Design Tokens and Shell
Establishes visual identity and navigation structure: Tailwind v4 @theme (no `tailwind.config.js` needed) sourced from `docs/design-system/colors_and_type.css`; typography (DM Sans for body, JetBrains Mono for code) via `next/font/google`; responsive layout with collapsible sidebar (240/64px), fixed topbar (52px), and content area; WCAG 2.1 AA compliance with `prefers-reduced-motion` support.

**Key Requirements Met**:
- Tailwind v4 @theme configuration in globals.css
- Design tokens from centralized source
- Sidebar (240px expanded / 64px collapsed) with persistent state
- Topbar with user menu and logout
- Empty-state content area with responsive breakpoint
- WCAG 2.1 AA color contrast and keyboard navigation
- Spanish copy ("tú" form) in sentence case without emoji

#### 3. Identity and Auth
Establishes user authentication and profile management: Supabase email/password sign-up with mandatory email verification; Google OAuth with `skipBrowserRedirect: true`; profiles table with RLS policies scoped to `auth.users`; three Actions (sign-up, sign-in, sign-out) and password reset flow; middleware refresh logic to keep sessions current; strict isolation via SERVICE_ROLE_KEY in server-only code.

**Key Requirements Met**:
- Supabase projects created (cogni-dev, cogni-prod) with poolers
- Profiles table with RLS enabled; migrations 0000 and 0001 applied
- Email verification required before login
- Google OAuth provider configured (no auto-redirect)
- Profile auto-created on first login
- Password reset flow via Supabase
- Forms connected to Actions; SERVICE_ROLE_KEY isolated server-side

#### 4. Observability and Delivery
Establishes production readiness: Sentry (client + server) with global error handler; PostHog analytics (request-level flush, no autocapture, only manual `user_signed_up`/`user_signed_in` events); GitHub Actions pipelines (PR validation, main branch build+test+migrate+deploy); Vercel preview and production environments; security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy); daily cron health check via `/api/keep-alive` with constant-time bearer verification.

**Key Requirements Met**:
- Sentry DSN configured for prod environments
- PostHog initialized with API key
- GitHub Actions: pr.yml (lint, tsc, vitest, depcruise, audit) and main.yml (same + e2e + drizzle migrate)
- Vercel: preview (cogni-dev) and production (cogni-prod) environments
- Security headers configured in next.config.ts
- /api/keep-alive health check with 200 response on valid bearer, 401 on invalid
- Vercel cron scheduled daily; confirmed green as of 2026-09-20

---

## Implementation and Verification Status

### Task Completion: 38/38 (100%)

All tasks marked complete in `tasks.md`:

- **Phase 1 (Tooling)**: 9/9 tasks complete; PR #1 merged (commit b60c30a)
- **Phase 2 (Shell)**: 7/7 tasks complete; PR #2 merged (commit 6f3b1a9)
- **Phase 3 (Auth + Drizzle)**: 11/11 tasks complete; PR #3 merged (commit 8b5f06d)
- **Phase 4 (Observability + Delivery)**: 11/11 tasks complete; PR #4 merged (merge commit 6f10621); PR #5 production fix merged (0dddb76)
- **Phase Closure Configuration**: 1/1 task (4.10) complete; PR #6 merged (commit 34fef0d)

### Verification Results

Per the final-state facts provided:

| Check | Result | Evidence |
|-------|--------|----------|
| Unit tests | 88/88 passing | `pnpm test` on main (34fef0d) |
| E2E tests | 17/17 passing | `pnpm test:e2e` against cogni-dev; no SMTP dependency |
| Main workflow (verify, e2e, migrate) | Green | GitHub Actions on main (34fef0d) |
| Native review | 6 lineages approved | review-c7258ec04529ed32, review-712ba2d8377e865b, review-1c970253b392c7ca-r1, review-8050c980878d6451, review-d3366ac82ebdbb8f, review-ad1d5466b82da787, review-b1b8fe6cbcc03739 |
| Production shell | Verified | https://www.cogni-dev.com; register → email verify → login → shell confirmed by maintainer on 2026-09-20 |
| Production API keep-alive | 200 (valid bearer) | GET /api/keep-alive on prod with prod bearer token |
| Vercel cron | Green | Scheduled daily; confirmed running |
| Supabase migrations | Applied | cogni-dev (ctzjuudglcqxniakhvol) and cogni-prod (mtsrpbqxsqhnfwjwskdn); profiles RLS enabled |

### Pull Request Trail

| PR | Branch | Commits | Scope | Status |
|----|--------|---------|-------|--------|
| #1 | feat/phase-0-pr1-tooling | 43f8757 | Scaffold, TypeScript, Biome, Vitest, Playwright, dependency-cruiser | Merged |
| #2 | feat/phase-0-pr2-design-shell | 2e59810 | Tailwind v4, design tokens, shell layout, sidebar, topbar, responsive | Merged |
| #3 | feat/phase-0-pr3-auth-drizzle | 443d16d | Supabase auth, profiles + RLS, Drizzle migrations, sign-up/in/out, middleware | Merged |
| #4 | feat/phase-0-pr4-observability-delivery | 6f10621 | Sentry, PostHog, GitHub Actions, Vercel, security headers, /api/keep-alive cron | Merged |
| #5 | fix/phase-0-prod-proxy-csp | 0dddb76 | Production fix: proxy matcher anchor + CSP issue resolution | Merged |
| #6 | chore/phase-0-close-config | 34fef0d | Phase closure: strict_tdd config, openspec/config.yaml project metadata | Merged |

**Main Branch Head**: 34fef0d (PR #6 merged). Commit column lists merge commits on main.

---

## Deviations vs. Specification

The following runtime decisions differ from initial spec/design and are recorded for traceability:

1. **Supabase Anon Key Naming**: Used `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY` to align with current Supabase SDK conventions.

2. **Middleware Path**: Implementation placed proxy/middleware logic in `src/proxy.ts` (executed by Next.js 16 instrumentation) instead of `src/middleware.ts` to avoid SSR interference with client-side OAuth callback redirect.

3. **CSP Nonces**: Initial spec proposed dynamic nonce generation; production uses static `'unsafe-inline'` for script-src with *.posthog.com allowlist. This is intentionally conservative for Phase 0; nonce infrastructure deferred to Phase 1.

4. **Main Workflow Migration Timing**: `drizzle migrate` job runs after Vercel auto-deploy completes (workflow job ordering), creating a small drift window. Spec proposed pre-deployment migration; this timing is acceptable for Phase 0 (no long-running locks expected).

5. **PostHog OAuth Callback Event**: `user_signed_in` event is not emitted on OAuth callback (only on email/password sign-in). This is by design to simplify Phase 0; full OAuth instrumentation deferred.

6. **Register Account Enumeration Message**: Registration form shows generic success message regardless of email existence (product decision for user privacy). Spec did not explicitly constrain this; it is a known deviation accepted by the user.

---

## Open Follow-ups for Later Phases

The following items were identified during implementation but intentionally deferred to maintain Phase 0 focus:

1. **CSP Nonces**: Replace static `'unsafe-inline'` with dynamic nonce generation via proxy response header (Phase 1).

2. **Drizzle Migration in Build**: Move `drizzle migrate` into Vercel build command to eliminate deployment drift window (Phase 1).

3. **Proxy Matcher Anchoring**: Add regex anchor `monitoring(?:/|$)` to ensure exact path matching and prevent false positives (Phase 1).

4. **User ID Exposure**: Sign-in gateway should expose `userId` in response for frontend optimization (Phase 1).

5. **OAuth Analytics**: Emit `user_signed_in` event on OAuth callback for consistent analytics (Phase 1).

6. **Repository Upsert Semantics**: DrizzleProfileRepository should support upsert semantics to simplify idempotent profile creation (Phase 1).

7. **Profiles FK Constraint**: Add foreign key from profiles to auth.users to enforce referential integrity (Phase 1).

8. **Sign-Out Result Handling**: Server-side signOut invocation currently ignores result; add error handling and client feedback (Phase 1).

9. **EnsureProfile Error Handling**: Current implementation throws hard 500 on DB outage; Phase 1 should add retry logic and fallback (Phase 1).

10. **Apex Domain Redirect**: https://cogni-dev.com still redirects to www; Phase 1 should configure apex CNAME + Vercel settings (Phase 1).

---

## Archive Verification

**Mechanical Copy Contract**: All specifications and artifacts were copied using shell commands (`cp -R`, `git mv`, `diff -r`) to ensure byte-identity. Verbatim `diff -r` output confirmed:

- ✓ **project-tooling spec**: Empty diff (byte-identical)
- ✓ **design-tokens-and-shell spec**: Empty diff (byte-identical)
- ✓ **identity-auth spec**: Empty diff (byte-identical)
- ✓ **observability-and-delivery spec**: Empty diff (byte-identical)
- ✓ **Change folder move**: Empty diff after move (all artifacts preserved)

**Archive Location**: `openspec/changes/archive/2026-09-20-phase-0-foundations/`

**Source of Truth Updated**: All main specs in `openspec/specs/` now reflect Phase 0 requirements.

---

## Change Closed

Phase 0 is complete, verified in production, and archived. The change established the executable foundation for Cogni: scaffold, tooling, design system, authentication, and observability. All 38 tasks completed; all gates passed; production deployment verified.

**Next Recommended Phase**: Phase 1 (implement core study modules, extend observability, apply deferred improvements listed above).

---

## Key Learnings

1. Four-PR chained delivery with auto-chain strategy successfully managed high risk (1500+ authored lines) by clear phase boundaries and autonomous scope.
2. Next.js 16 breaking changes (middleware → instrumentation, config type changes) required direct vendor doc inspection before implementation.
3. Supabase RLS policies required careful scoping to prevent data leakage; server-only SERVICE_ROLE_KEY isolation is essential.
4. Static CSP with allowlist is pragmatic for Phase 0; nonce infrastructure can follow once page-level data flows are stabilized.
5. Vercel cron integration via vercel.json requires explicit bearer header setup for keep-alive health checks; native Vercel metrics alone are insufficient for DB validation.

---

*Archived by sdd-archive on 2026-09-20. Change ID: phase-0-foundations. Artifact Store: hybrid (openspec + Engram).*
