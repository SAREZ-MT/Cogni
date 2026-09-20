# Proposal: Fase 0 — Cimientos de Cogni

**Fase 0** (§13). **Hecho cuando**: registro, verificación de correo, login con Google y shell vacío en producción; CI verde.

## Intent

Solo existe documentación. Falta la base ejecutable (§4, §5.4, §9, §10) y `pnpm test` operativo para TDD estricto.

## Scope

### In Scope
- Scaffold `create-next-app` reorganizado a §5.4; pnpm; TS estricto; Biome; Vitest + Testing Library; Playwright; dependency-cruiser (§5.3).
- Tokens de `colors_and_type.css` vía `@theme` (Tailwind v4); `shadcn init` sin `--defaults`; shell autenticado vacío; esqueleto de 11 módulos (código real solo en `identity` y `shared`).
- Supabase Auth (`@supabase/ssr`): registro con verificación (SMTP por defecto), login, Google OAuth, rutas protegidas; `profiles` con migración Drizzle (`prepare: false`); proyectos `cogni-dev` y `cogni-prod`.
- Sentry, PostHog, GitHub Actions (§10.2), env con Zod, cabeceras de seguridad, deploy Vercel con dominio, keep-alive diario (Vercel Cron → route handler autenticado, `select 1`).
- Cierre: `strict_tdd: true` y `projects:` en `openspec/config.yaml`.

### Out of Scope
- Landing pública; SMTP propio (Fase 8); Trigger.dev (Fase 3); buckets de Storage (Fase 1); Better Stack; toda lógica de producto.

## Capabilities

### New Capabilities
- `project-tooling`: scaffold, pnpm, TS, Biome, tests, reglas de dependencia.
- `design-tokens-and-shell`: tokens, shadcn, shell, esqueleto de módulos.
- `identity-auth`: Supabase Auth, sesión por cookies, `profiles`, rutas protegidas.
- `observability-and-delivery`: Sentry, PostHog, CI, env, deploy, keep-alive.

### Modified Capabilities
- None

## Approach

`create-next-app` + reorganizar; esqueleto completo; dependency-cruiser; Drizzle/postgres-js; `@supabase/ssr`. Auto-chain en PRs ≤ 400 líneas (4 slices tentativos: tooling, tokens/shell, auth/Drizzle, observabilidad/deploy; `sdd-tasks` fija el corte). Versiones: última estable al aplicar.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| Config raíz (`package.json`, Biome, TS, Vitest, Playwright, dependency-cruiser, `vercel.json`) | New | Tooling, cron |
| `src/app/{(public),(app),api/keep-alive}`, `src/modules/*`, `src/shared/*` | New | Auth, shell, esqueleto |
| `drizzle/`, `.github/workflows/` | New | Migración `profiles`, CI |
| `openspec/config.yaml` | Modified | `strict_tdd`, `projects` |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Google Cloud Console bloquea OAuth | Med | Credenciales del usuario antes del PR de auth |
| Pausa de Supabase antes del keep-alive | Med | Cron en el mismo PR del deploy |
| `prepare: false` omitido; preset de shadcn | Low | Test de conexión en CI; `--css-variables` |

## Rollback Plan

- Migración: `drop table profiles` versionado; `cogni-dev` se recrea.
- Auth: deshabilitar Google en Supabase.
- Deploy: revert en `main`; retirar cron.
- SDD: revertir `openspec/config.yaml`.

## Dependencies

- Google OAuth y dominio (usuario); cuentas Vercel, Supabase, Sentry, PostHog; Docker.

## Success Criteria

- [ ] CI verde: Biome, `tsc --noEmit`, Vitest, dependency-cruiser, `pnpm audit`; Playwright en `main`.
- [ ] Keep-alive ejecuta `select 1` diario.
- [ ] `openspec/config.yaml`: `strict_tdd: true`, `projects` completo (último paso, tras `pnpm test` verde).
