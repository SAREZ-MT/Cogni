# Design: Fase 0 — Cimientos de Cogni

## Technical Approach

`create-next-app` → reorganización a §5.4 → cuatro PRs encadenadas. Código real solo en `src/shared/*` y `src/modules/identity`; los diez módulos restantes quedan como esqueleto verificable. Ninguna decisión del ADR 0001 cambia: no se crea ADR nuevo. El dominio de `identity` no importa Next.js ni Drizzle, así que `pnpm test` corre sin runtime de Next y habilita `strict_tdd: true` al cierre.

## Repository Layout / File Changes

Todo **Create** salvo lo marcado.

```
raíz/               package.json (packageManager+engines)  tsconfig.json  biome.json
                    next.config.ts  .dependency-cruiser.cjs  vitest.config.ts
                    playwright.config.ts  drizzle.config.ts  vercel.json
                    components.json  .env.example  instrumentation-client.ts
                    sentry.server.config.ts   eslint.config.mjs -> DELETE (§4.1)
src/app/            (public)/{login,register,forgot-password}  (app)/{layout,page}
                    auth/callback/route.ts  api/keep-alive/route.ts
                    layout.tsx globals.css global-error.tsx    src/middleware.ts
src/shared/         kernel/{result,domain-error,id,clock}  db/{client,schema}
                    config/env.{server,client}.ts          ui/ (shadcn)
src/modules/identity/
   domain/          profile.ts  profile-repository.ts (puerto)
   application/     ensure-profile  sign-up  sign-in  sign-out  request-password-reset
   infrastructure/  supabase-{server,browser}-client  drizzle-profile-repository
   ui/  index.ts
src/modules/        los DIEZ esqueletos, cada uno index.ts (`export {}`) + README.md
                    ("Pendiente: Fase N"): notebooks  editor  ingestion  ai
                    study-engine  flashcards  exams  active-recall  scheduling  analytics
drizzle/0000_*_profiles.sql   tests/e2e/   .github/workflows/{pr,main}.yml
openspec/config.yaml  **Modify**: strict_tdd: true + projects (último paso)
```

## Architecture Decisions

| Decisión | Elección | Descartado | Justificación |
|---|---|---|---|
| Scaffold | `create-next-app@latest` y reorganizar | scaffold manual | alias, Turbopack y `tsconfig` oficiales sin deriva |
| Esqueleto | 11 módulos desde el día uno (`identity` con lógica + 10 esqueletos) | crear cada uno en su fase | §5.4 lo exige; da carpetas reales a las reglas de CI |
| Reglas §5.3 | dependency-cruiser en CI | Biome `noRestrictedImports`; `eslint-plugin-boundaries` | reglas por patrón de ruta; ESLint contradice §4.1 |
| `profiles` | `EnsureProfile` idempotente en `application`, llamado por el layout de `(app)` | trigger SQL sobre `auth.users` | el trigger vive en el esquema `auth`, que Drizzle no introspecta: quedaría fuera de `drizzle-kit generate` (§6.2) y sin test unitario. El caso de uso se prueba con repositorio en memoria y sirve a correo y OAuth |
| Datos | puerto `ProfileRepository` en `domain`; Drizzle solo en `infrastructure` | `db` desde `application` | §5.3.3; el service role omite RLS y debe quedar aislado |
| Conexión Postgres | `drizzle-orm/postgres-js` con `postgres(DATABASE_URL, { prepare: false })` sobre el pooler de Supabase en modo transaction | pooler en modo session; conexión directa | el modo transaction no soporta prepared statements: omitir `prepare: false` rompe las queries de forma silenciosa. Session y directa agotan el límite de conexiones en serverless |
| Env | `env.server.ts` (`import 'server-only'`) + `env.client.ts` | módulo único | impide que una clave privada entre al bundle |
| PostHog servidor | `posthog-node` instanciado por petición con `flushAt: 1, flushInterval: 0` | cliente singleton de larga vida | las funciones serverless son de vida corta: un buffer sin vaciar pierde eventos |
| Tema | tokens `[data-theme="dark"]` presentes, sin conmutador | omitirlos | evita reescribir `globals.css` en fases futuras |
| Keep-alive | Vercel Cron diario → route handler con bearer | GitHub Actions `curl` | confirmado; no duplica secretos entre proveedores |

## Token Mapping

`colors_and_type.css` se copia a `src/app/globals.css` y se expone a Tailwind v4 con `@theme` (sin `tailwind.config.js`): `--color-primary-*`, `--color-neutral-*`, `--color-pastel-*`, `--font-sans`/`--font-mono`, `--radius-*`, `--shadow-*`. Los tokens semánticos (`--bg-app`, `--fg-default`, `--border-default`) siguen siendo variables CSS y alimentan los nombres que espera shadcn (`--background`, `--card`, `--border`, `--ring`, `--primary`). `shadcn init` corre **sin** `--defaults`, con variables CSS, para no importar `base-nova`. El `@import` de Google Fonts se elimina: las familias se cargan con `next/font/google`. Donde el CSS heredado y §11 discrepan gana el documento maestro: `--bg-app: var(--color-neutral-150)` (`#EDEAE4`).

## Auth Architecture

`identity/infrastructure` expone `createServerClient` con `cookies: { getAll, setAll }` sobre `next/headers`, y `createBrowserClient`. `src/middleware.ts` refresca la sesión antes de los route handlers y protege `(app)`. Registro, login, logout y reset son Server Actions que validan con Zod en el borde; Google usa `signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } })` + `redirect(data.url)`. `ownerId` se toma de la sesión en cada caso de uso, nunca del cliente.

## Data Flow

```
navegador → /auth/callback?code&next → exchangeCodeForSession (infrastructure)
          → EnsureProfile(ownerId) → ProfileRepository.upsert → Postgres
          → redirect(safeNext)   // safeNext solo admite rutas internas

Vercel Cron (diario) → GET /api/keep-alive con bearer CRON_SECRET
          → shared/db client (prepare: false) → select 1 → 200 { ok: true }
```

## Interfaces / Contracts

```js
// .dependency-cruiser.cjs — encodes master document section 5.3
module.exports = {
  forbidden: [
    { name: 'domain-is-pure', severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { pathNot: '^(src/modules/[^/]+/domain|src/shared/kernel)' } },
    { name: 'domain-no-npm', severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { dependencyTypes: ['npm'], pathNot: 'node_modules/zod' } },
    { name: 'application-no-infra-or-ui', severity: 'error',
      from: { path: '^src/modules/[^/]+/application' },
      to: { path: '^src/modules/[^/]+/(infrastructure|ui)' } },
    { name: 'ui-never-touches-infra', severity: 'error',
      from: { path: '^src/(app|modules/[^/]+/ui)' },
      to: { path: '^src/modules/[^/]+/infrastructure' } },
    { name: 'cross-module-via-index', severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/[^/]+/.+',
            pathNot: '^(src/modules/$1/|src/modules/[^/]+/index\\.ts$)' } },
    { name: 'study-engine-knows-no-technique', severity: 'error',
      from: { path: '^src/modules/study-engine/' },
      to: { path: '^src/modules/(flashcards|exams|active-recall)/' } },
  ],
  options: { tsConfig: { fileName: 'tsconfig.json' }, doNotFollow: { path: 'node_modules' } },
};
```

```ts
// src/shared/config/env.server.ts — fail fast at boot
import 'server-only';
const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  CRON_SECRET: z.string().min(32),
  SENTRY_DSN: z.string().url().optional(),
});
export const serverEnv = serverSchema.parse(process.env); // throws on missing vars
```

```ts
// src/shared/db/client.ts — Supabase transaction pooler needs prepare: false
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
// transaction mode has no prepared statements; omitting this breaks queries
const sql = postgres(serverEnv.DATABASE_URL, { prepare: false, max: 1 });
export const db = drizzle(sql, { schema });
```

```ts
// src/app/api/keep-alive/route.ts
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  // constant time compare; never log or echo the secret
  if (!safeEqual(header, `Bearer ${serverEnv.CRON_SECRET}`)) {
    return new Response(null, { status: 401 });
  }
  await db.execute(sql`select 1`);
  return Response.json({ ok: true });
}
```

```yaml
# .github/workflows/pr.yml
# main.yml adds: pnpm test:db (pooler smoke), playwright, drizzle migrate, then deploy
on: { pull_request: { branches: [main] } }
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint        # biome ci
      - run: pnpm typecheck   # tsc --noEmit
      - run: pnpm test        # vitest run
      - run: pnpm depcruise
      - run: pnpm audit --audit-level=high
```

`next.config.ts` añade CSP básica, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` restrictiva (HSTS lo pone Vercel).

## Testing Strategy

Comandos: `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm depcruise`.

| Capa | Qué se prueba | Cómo |
|---|---|---|
| Unit | env, `Result`/`DomainError`, `EnsureProfile`, `safeNext` | Vitest puro, sin jsdom ni Next |
| Arquitectura | las 6 reglas de §5.3 | `pnpm depcruise` bloquea el PR |
| Integración | formularios de auth; repositorio Drizzle contra `supabase start` | Testing Library + jsdom |
| Conexión | mitigación de `prepare: false`: `tests/db/connection.smoke.test.ts` hace `select 1` contra el pooler de `cogni-dev` | `pnpm test:db` en el workflow de `main` (`secrets.DATABASE_URL`; no corre en PRs de fork) |
| E2E | registro → verificación (stub) → login; botón de Google; `(app)` → `/login` | Playwright + `webServer`, Chromium, en `main` |

## Threat Matrix

Fronteras presentes: enrutamiento (route handlers, middleware, callback OAuth) y CI. Las cinco filas de referencia —rutas tipo documentación, selección de repositorio git, estado de commit, estado de push y comandos de PR— son **N/A**: la aplicación no clasifica archivos ejecutables ni invoca shell, git o automatización de PR; el deploy lo dispara la integración Git de Vercel.

| Frontera aplicable | Comportamiento seguro / de fallo | Test RED |
|---|---|---|
| Redirección abierta en `next` del callback | solo rutas internas que abran con `/` y no con `//` ni `/\`; el resto cae a `/` | `safeNext` rechaza `https://evil.tld`, `//evil.tld`, `/\evil.tld`; acepta `/dashboard` |
| Auth del cron | bearer ausente o distinto → `401` sin cuerpo; comparación en tiempo constante | `/api/keep-alive` sin header o inválido → `401`; válido → `200` |
| Alcance del middleware | matcher excluye estáticos; `(app)` sin sesión → `/login` | petición sin cookie a `(app)` redirige a `/login` |
| Secretos en logs de CI | solo vía `secrets.*`; sin `env` global, sin `set -x`, sin secretos en argumentos | ningún paso hace eco de `${{ secrets.* }}` |
| Fuga de env al cliente | `server-only` en `env.server.ts`; solo `NEXT_PUBLIC_*` en cliente | importar `env.server` desde un componente cliente rompe el build |

## Migration / Rollout

Sin migración de datos: `profiles` es tabla nueva. Preview y local apuntan a `cogni-dev`; producción, a `cogni-prod` (§10.1: el plan free admite dos proyectos activos). Cuatro PRs encadenadas (auto-chain, ≤ 400 líneas; `sdd-tasks` fija el corte):

1. **Tooling** — deja `lint/typecheck/test/depcruise` verdes.
2. **Tokens y shell** — deja la app navegable sin auth.
3. **Auth y Drizzle** — deja el ciclo registro/login operativo.
4. **Observabilidad y entrega** — Sentry, PostHog, CI, cabeceras, cron, dominio; cierra con `strict_tdd: true`.

Cada PR es revertible sin tocar las anteriores; la migración, con `drop table profiles` versionado.

## Open Questions

- [ ] Dominio de Cloudflare pendiente antes de la PR 4 (bloquea solo ese paso).
- [ ] Si el boilerplate de `create-next-app` cuenta en el presupuesto de 400 líneas: lo decide el forecast de `sdd-tasks`.
- [ ] Versión mayor de Next.js y del CLI de shadcn: se reverifica en `sdd-apply`.
- [ ] Verificación de correo en previews: `NEXT_PUBLIC_SITE_URL` por entorno vs. lista de redirect URLs en Supabase.
