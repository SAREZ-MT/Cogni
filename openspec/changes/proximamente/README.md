# Próximamente

Changes SDD planificados y diferidos por decisión del usuario. No están activos: `gentle-ai sdd-status` no los detecta aquí y no se implementan hasta que se muevan de vuelta a `openspec/changes/<nombre>/`.

| Change | Fase | Estado al diferir | Diferido el | Motivo |
|---|---|---|---|---|
| `phase-2-pdf-import` | Fase 2 — Importación de PDF | exploración, propuesta aprobada, specs y design escritos y validados; sin tasks ni código | 2026-09-22 | El usuario decidió dejar la importación de PDF para cuando toda la plataforma esté funcionando |

## Cómo reanudar `phase-2-pdf-import`

1. Mover la carpeta: `git mv openspec/changes/proximamente/phase-2-pdf-import openspec/changes/phase-2-pdf-import`.
2. Releer `exploration.md`, `proposal.md`, `design.md` y `specs/` contra el código vigente: las fases 3 a 8 habrán cambiado `notebooks`, `src/shared/`, la CI y los specs canónicos en `openspec/specs/`. Los deltas de `notebooks`, `design-tokens-and-shell`, `observability-and-delivery` y `project-tooling` se escribieron contra los encabezados canónicos del 2026-09-22 y deben reconciliarse.
3. Resolver las decisiones pendientes registradas en `design.md`, sección "Conflictos con la spec que requieren decisión":
   - **C1** (arquitectónica, requiere OK del usuario y ADR): entry point `server.ts` por módulo para consumidores sin Next.js, porque el worker de Trigger.dev no puede importar `notebooks/index.ts` (arrastra `server-only`, Next y Sentry vía `identity/index.ts`). Recomendación registrada: aceptar `server.ts` y ajustar las reglas 5 y 10 del delta de `project-tooling`.
   - **C2** (técnica, resuelta por el orquestador): el deploy de Trigger.dev en `main.yml` también se dispara con cambios en `src/modules/ingestion/**`, la parte no-UI de `notebooks` y `src/shared/**`.
   - **C3** (técnica, resuelta por el orquestador): la vigencia de 10 minutos del permiso de subida la impone la aplicación desde el timestamp del UUID v7; el presupuesto de 60 s se mide con una corrida en producción.
   - Pregunta abierta E17: PDF cuyo único texto son números de página → `failed(no_text_layer)`.
   - Should-fix del validador: la tabla "File Changes" de `design.md` debe listar también `drizzle/meta/0006_snapshot.json`.
4. Revisar versiones: el design fijó `@trigger.dev/sdk` y `trigger.dev` 4.6.4 y `unpdf` 1.8.1 (registry del 2026-09-22); volver a consultar el registry y la documentación de Trigger.dev al reanudar.
5. Continuar con `/gentle-sdd-continue phase-2-pdf-import` (siguiente fase: `tasks`). Preflight usado en la planificación: pace interactive, artifacts hybrid, delivery auto-chain.
6. Los pasos a cargo del usuario (cuenta y proyecto en Trigger.dev, claves en `.env.local`, Vercel y GitHub, bucket `page-pdfs` en Supabase, variables del worker) están detallados en `design.md`, sección "Pasos a cargo del usuario".

Copias en Engram (proyecto `cogni`): `sdd/phase-2-pdf-import/explore` (#234), `.../proposal` (#241), `.../spec` (#246) y `.../spec/deltas` (#247), `.../design` (#253), `.../design-part-2` (#254), `.../design-part-3` (#255), `.../decisions` (#240) y `.../state`.
