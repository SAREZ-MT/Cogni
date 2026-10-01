# ADR 0003 — Reemplazar Trigger.dev por Vercel Fluid Compute y Vercel Cron

| Campo | Valor |
|---|---|
| Fecha | 2026-09-22 |
| Estado | Aceptado |
| Reemplaza | Parcialmente el punto 5 del ADR 0001 (Trigger.dev en el stack) y la regla 5 de §8.1 del documento maestro |

## Contexto

El documento maestro 1.0.0 asigna a Trigger.dev todo el trabajo en segundo plano: procesar PDF, generación por lotes con IA, cálculo diario de repasos y keep-alive (§4.2, §5.4, §5.5, §8.1 regla 5, §10.3).

Al diseñar la Fase 2 (`phase-2-pdf-import`) se midió el costo real de esa decisión para un proyecto de una sola persona con presupuesto cero:

- Un segundo runtime (worker Node) con deploy separado de Vercel, que puede quedar desincronizado del código que lo dispara.
- Claves en tres lugares (`.env.local`, Vercel, GitHub Actions), un worker corriendo en local junto a `pnpm dev` y otro en CI para los e2e.
- Un punto de acoplamiento revelado en el código: los `index.ts` de los módulos reexportan Server Actions y componentes React, así que un worker fuera de Next no puede importarlos sin una segunda entrada pública (`server.ts`) por módulo.
- Cold starts sin medir frente a un presupuesto de 60 segundos.

A la vez, la evidencia técnica muestra que el trabajo previsto cabe en Vercel:

- Con Fluid Compute (modelo por defecto en Vercel desde abril de 2025), el plan Hobby permite hasta 300 segundos por función.
- Extraer el texto de un PDF de 30 páginas con unpdf tarda segundos; generar flashcards de una página con un modelo gratuito tarda entre 10 y 30 segundos; evaluar una respuesta abierta tarda segundos.
- El cálculo diario de repasos y el keep-alive son tareas programadas diarias, que Vercel Cron cubre en el plan Hobby. El keep-alive ya se implementó así en la Fase 0 (`vercel.json`, `/api/keep-alive`).

## Decisión

1. Trigger.dev sale del stack. No se instala `@trigger.dev/sdk`, no existe `src/trigger/` y no hay deploy de tareas en CI.
2. El trabajo que puede tardar más de unos segundos se ejecuta de forma síncrona dentro de la Server Action o del route handler que lo solicita, con `maxDuration` explícito y acotado (máximo 300 segundos). El cliente espera la respuesta y muestra el estado de progreso.
3. Las tareas programadas (keep-alive, cálculo diario de repasos) se ejecutan con Vercel Cron y route handlers protegidos por `CRON_SECRET`.
4. Las entidades de trabajo (`ImportJob`, `AiGeneration`) se conservan para estado, trazabilidad y recarga de la interfaz. El campo `trigger_run_id` se elimina de ambas.
5. Si un trabajo futuro necesita más de 300 segundos o reintentos durables, se reintroduce un servicio de jobs mediante un ADR nuevo; hasta entonces, se trocea el trabajo en unidades que quepan en el presupuesto.
6. La regla 5 de §8.1 pasa a decir: "Todo se ejecuta dentro del presupuesto de una función de Vercel (máximo 300 segundos, con `maxDuration` explícito). Las tareas programadas usan Vercel Cron."

## Consecuencias

- El documento maestro pasa a la versión 1.1.0 con las secciones §4.2, §5.2, §5.3, §5.4, §5.5, §6.1, §8.1, §10.3, §13 y §15 actualizadas.
- La Fase 2 se simplifica: sin worker, sin deploy separado, sin secretos adicionales y sin la decisión de la segunda entrada pública `server.ts`.
- El usuario debe confirmar en Vercel (Settings → Functions) que Fluid Compute está activo en el proyecto; si no lo está, activarlo antes de la Fase 2.
- Pérdidas aceptadas: reintentos automáticos y registro por run que ofrecía Trigger.dev; se compensan con el estado persistido en las tablas de trabajo y con Sentry.
- El acoplamiento de los `index.ts` con Next queda documentado como deuda de modularidad no bloqueante.
