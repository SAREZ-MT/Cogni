# ADR 0001 — Decisiones fundacionales de Cogni

| Campo | Valor |
|---|---|
| Fecha | 2026-09-14 |
| Estado | Aceptado |
| Reemplaza | — |

## Contexto

Cogni se construye desde cero, por una sola persona, con presupuesto de infraestructura cercano a cero y sin fecha límite dura, pero con la intención de avanzar rápido sin sacrificar calidad. Antes de escribir código se negoció, decisión por decisión, el modelo de producto, el stack y la arquitectura, y se registró todo en `docs/documento-maestro.md`.

## Decisión

Se adopta íntegramente el contenido de `docs/documento-maestro.md` versión 1.0.0 como conjunto de decisiones cerradas. En particular:

1. Página como unidad de estudio; cuaderno como agrupación (opción B).
2. Estado SM-2 por ítem y nivel de dominio derivado por página (opción C).
3. Editor construido sobre Tiptap, no desde cero.
4. Monolito modular con arquitectura hexagonal por módulo; `study-engine` es el único que calcula repasos.
5. Stack: pnpm, Next.js + TypeScript, Tailwind + shadcn/ui, Drizzle, Zod, TanStack Query, Zustand, Biome, Vitest, Playwright; Vercel Hobby, Supabase Free, Cloudflare DNS, Upstash Redis, Trigger.dev, Sentry, PostHog; Better Stack diferido.
6. Capa de IA con Vercel AI SDK, rotación multi-proveedor por cuota, salida estructurada obligatoria.
7. Ocho fases (0 a 8), cada una desplegada y usable.
8. Fuera de alcance: colaboración, app nativa, Google Calendar, búsqueda global, gamificación, OCR, API pública, monetización.
9. Flujo de trabajo exclusivamente con gentle-ai (SDD por change) y skills propias del proyecto.

## Consecuencias

- Cualquier cambio a estas decisiones requiere un ADR nuevo que cite a este y lo reemplace parcial o totalmente.
- Las specs SDD de cada change deben ser coherentes con el documento maestro.
- El design system heredado (`docs/design-system/`) aporta solo estilo y UI; no aporta alcance ni versiones.
