# ADR 0002 — Diferir la Fase 2 (Importación de PDF)

| Campo | Valor |
|---|---|
| Fecha | 2026-09-22 |
| Estado | Revertido el 2026-09-23 (Fase 2 reincorporada e implementada) |
| Revertido por | Entrega de la Fase 2 bajo ODD, fusionada en `main` el 2026-09-23 (PR5 a PR13); ver documento maestro §13, Fase 2 |
| Reemplaza | Parcialmente el punto 7 del ADR 0001 (orden de las fases) |

## Contexto

El documento maestro §13 define ocho fases en orden, y la Fase 2 (Importación de PDF: subida a Storage, `ImportJob`, tarea Trigger.dev con unpdf, conversión de texto a bloques) es la siguiente después del cierre de la Fase 1.

El 2026-09-22 se completó la planificación SDD del change `phase-2-pdf-import` (exploración, propuesta aprobada, specs y diseño validado). Al revisar el diseño, el autor decidió que la importación de PDF no es necesaria para probar el valor central de la plataforma (las tres técnicas de estudio sobre apuntes propios) y que conviene tener toda la plataforma funcionando antes de invertir en ella.

## Decisión

1. La Fase 2 se difiere a una sección "Próximamente". No se implementa hasta que las Fases 3 a 8 estén desplegadas y usables.
2. Las Fases 3 a 8 avanzan en su orden original, comenzando por la Fase 3 (Capa de IA), sin depender de contenido importado desde PDF.
3. Los artefactos SDD ya producidos se conservan íntegros en `openspec/changes/proximamente/phase-2-pdf-import/`, con un README que registra el estado, las decisiones pendientes (C1 a C3, E17) y los pasos para reanudar.
4. El alcance del producto no cambia: la importación de PDF sigue siendo parte de Cogni (documento maestro §3) y sigue sin OCR. Solo cambia el momento.

## Consecuencias

- El documento maestro pasa a la versión 1.0.1: la Fase 2 queda marcada como diferida y §13 incorpora la subsección "Próximamente".
- Todo texto de fases posteriores que hable de "contenido importado" se lee como "contenido escrito en el editor" mientras la Fase 2 esté diferida.
- Al reanudar la Fase 2, sus deltas de specs deben reconciliarse contra los specs canónicos vigentes en ese momento, y la decisión arquitectónica C1 (entry point `server.ts` por módulo para consumidores sin Next.js) requerirá su propio ADR.
- Este ADR no altera el resto de las decisiones del ADR 0001.
