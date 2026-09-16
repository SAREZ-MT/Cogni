# Cogni

Plataforma web de estudio con editor de bloques y tres técnicas de estudio
(flashcards, exámenes, recordación activa) unificadas por un motor de
repetición espaciada transversal.

La fuente de verdad de producto y arquitectura es
[`docs/documento-maestro.md`](docs/documento-maestro.md). Cualquier decisión
que lo contradiga requiere un ADR en `docs/adr/`.

## Requisitos

- Node.js 22 o superior.
- pnpm 10 o superior (único gestor de paquetes soportado; `npm install` o
  `yarn install` fallan intencionalmente).

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) para ver la app.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo (Next.js, Turbopack). |
| `pnpm build` | Build de producción. |
| `pnpm lint` / `pnpm biome ci .` | Lint y formato con Biome (única herramienta). |
| `pnpm typecheck` / `pnpm tsc --noEmit` | Chequeo de tipos estricto. |
| `pnpm test` | Tests unitarios y de componentes (Vitest + Testing Library). |
| `pnpm test:e2e` | Tests de extremo a extremo (Playwright). |
| `pnpm depcruise` | Verifica las reglas de dependencia de la arquitectura hexagonal (§5.3). |

## Estructura

Monolito modular con arquitectura hexagonal por módulo. Ver
`docs/documento-maestro.md` §5.4 para la estructura completa de carpetas y
§5.3 para las reglas de dependencia entre capas.
