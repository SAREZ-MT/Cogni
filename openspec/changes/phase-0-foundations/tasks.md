# Tasks: Fase 0 — Cimientos de Cogni

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | PR1 ~350-500, PR2 ~250-350, PR3 ~350-450, PR4 ~200-300 (scaffold/lockfile excluidos) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 tooling → PR2 tokens/shell → PR3 auth/Drizzle → PR4 observabilidad/entrega |
| Delivery strategy | auto-chain |
| Chain strategy | pending (stacked-to-main sugerido; orquestador confirma) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Focused test | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Tooling verde | 1 | `pnpm test` | `pnpm dev` | Revertir scaffold |
| 2 | Shell sin auth | 2 | `pnpm test:e2e -- shell` | `pnpm dev` | Revertir shell/tokens |
| 3 | Auth operativo | 3 | `pnpm test -- identity` | `pnpm test:e2e -- auth` | Revertir `identity`+migración |
| 4 | Observabilidad+cron | 4 | `pnpm test -- keep-alive` | `curl .../keep-alive` | Revertir workflows/cron |

## Phase 1: Tooling (PR 1)

- [x] 1.1 Scaffold `create-next-app` (TS, App Router, Tailwind v4); reorganizar a `src/` (§5.4); pnpm en `packageManager`/`engines`.
- [x] 1.2 `tsconfig.json` `strict:true`, alias `@/*`; quitar ESLint/Prettier; Biome (`pnpm biome ci .`).
- [x] 1.3 Vitest+jsdom+Testing Library (`pnpm test`) y Playwright (`pnpm test:e2e`).
- [x] 1.4 `.dependency-cruiser.cjs` (6 reglas §5.3) + `pnpm depcruise`.
- [x] 1.5 Crear `src/app/{(public),(app),api}`, `src/shared/{kernel,db,ui,config}`, `drizzle/`, `tests/e2e/`.
- [x] 1.6 RED `result/domain-error/id/clock.test.ts` → implementar `src/shared/kernel/*`.
- [x] 1.7 Scaffold los 10 módulos restantes de §5.4 (`src/modules/*`): `index.ts`+`README.md` con su fase pendiente.
- [x] 1.8 Scaffold `src/modules/identity/{domain,application,infrastructure,ui}/index.ts` placeholders.
- [x] 1.9 Gate PR1: `install`, `biome ci`, `tsc --noEmit`, `test`, `test:e2e`, `depcruise` verdes.

## Phase 2: Tokens y shell (PR 2)

- [x] 2.1 Tokens en `src/app/globals.css` `@theme` (sin `tailwind.config.js`) desde `docs/design-system/colors_and_type.css`; DM Sans/JetBrains Mono vía `next/font/google`.
- [x] 2.2 `shadcn init` sin `--defaults`, variables CSS, `tailwind.config` vacío; `Button` primario en `#1C1917`.
- [x] 2.3 Shell `(app)`: sidebar 240/64px colapsable persistido, topbar 52px + menú/logout, contenido en estado vacío.
- [x] 2.4 Layout `(public)` panel partido (oscuro/`#FAFAF8`); responsive <768px sin scroll horizontal.
- [x] 2.5 WCAG 2.1 AA + `prefers-reduced-motion`; copy español "tú" sentence-case, sin emoji.
- [x] 2.6 RED `tests/e2e/shell-empty-state.spec.ts` → implementar; sin hex en línea.
- [x] 2.7 Gate PR2: navegable sin auth; `test`/`test:e2e`/`depcruise` verdes.

## Phase 3: Auth y Drizzle (PR 3)

- [x] 3.1 RED `domain/profile.test.ts` → `profile.ts` + puerto `profile-repository.ts`.
- [x] 3.2 Migración `drizzle/0000_*_profiles.sql`; `src/shared/db/{schema,client}.ts` (`prepare:false,max:1`).
- [x] 3.3 RED `application/ensure-profile.test.ts` (repo en memoria) → `EnsureProfile` idempotente desde layout `(app)`.
- [x] 3.4 `infrastructure/drizzle-profile-repository.ts` + `supabase-{server,browser}-client.ts`.
- [x] 3.5 RED `sign-up.test.ts`/`sign-in.test.ts` → Actions (verificación obligatoria; rechazo si no verificado).
- [x] 3.6 `sign-out` Action; RED `request-password-reset.test.ts` → flujo de reset.
- [x] 3.7 Google OAuth (`skipBrowserRedirect:true`) + `src/app/auth/callback/route.ts`.
- [x] 3.8 RED `safeNext.test.ts` (rechaza URLs externas) → `safeNext` en el callback.
- [x] 3.9 `src/middleware.ts`: refresca sesión, protege `(app)`, redirige autenticados fuera de auth.
- [x] 3.10 Formularios `(public)` conectados a las Actions; verificar `SERVICE_ROLE_KEY` fuera del bundle cliente y aislamiento por `ownerId`.
- [x] 3.11 Gate PR3: `test`+e2e registro→login+Google verdes; `cogni-dev`/`cogni-prod` listos. (2026-09-18: unit 58/58, e2e 14/15 contra `cogni-dev`; el e2e de registro depende del SMTP de Supabase y se cierra en 4.11.)

## Phase 4: Observabilidad y entrega (PR 4)

- [x] 4.1 RED `shared/config/env.test.ts` → `env.server.ts` (`server-only`) + `env.client.ts`.
- [x] 4.2 Sentry cliente/servidor + `global-error.tsx` raíz.
- [x] 4.3 PostHog `posthog-node` por petición (`flushAt:1,flushInterval:0`) + init cliente; sin autocaptura, solo `user_signed_up`/`user_signed_in`.
- [x] 4.4 `.github/workflows/pr.yml`: install→`biome ci`→`tsc`→`vitest run`→`depcruise`→`pnpm audit --audit-level=high`.
- [x] 4.5 `.github/workflows/main.yml`: pasos de PR + `pnpm test:db` + Playwright + `drizzle migrate` antes del deploy; RED `tests/db/connection.smoke.test.ts`.
- [ ] 4.6 Integración Vercel: preview→`cogni-dev`, producción→`cogni-prod`; dominio (bloqueado por el usuario).
- [x] 4.7 Cabeceras de seguridad en `next.config.ts` (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- [x] 4.8 RED `api/keep-alive/route.test.ts` (bearer inválido→401; válido→200+`select 1`) → implementar con comparación constante; cron diario en `vercel.json`.
- [ ] 4.9 Verificar sin `${{ secrets.* }}` en logs de CI; gate PR4: `pr.yml`/`main.yml` verdes, cron responde 200. (2026-09-20: workflows verdes y logs sin secretos; falta confirmar el cron 200 en Vercel tras corregir `DATABASE_URL`.)
- [x] 4.10 Cierre de fase: `openspec/config.yaml` `strict_tdd: true` + completar `projects` — solo tras `pnpm test` verde en local y en CI.
- [x] 4.11 SMTP propio en `cogni-dev`/`cogni-prod` (p. ej. Resend) + subir el rate limit de correo; e2e "registers, asks for verification" verde de forma estable. (2026-09-20: verificado en dev por e2e 17/17; prod configurado, pendiente de confirmar con un registro real.)
