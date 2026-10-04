# Módulo `study-engine`

## Responsabilidad

Estado SM-2 por ítem, nivel de dominio por página y cálculo de vencimientos
(`docs/documento-maestro.md` §3.4 y §7). Ningún otro módulo calcula fechas de
repaso: todos pasan por este motor.

## Estado

Fase 4, tarea T1: dominio puro implementado y cubierto al 100 %. La
persistencia (`study_items`, `review_logs`, `page_mastery`), los casos de uso y
las acciones de servidor llegan en las tareas siguientes de la misma fase.

## Dominio (`domain/`)

| Archivo | Contenido |
|---|---|
| `study-item.ts` | `StudyItem`, `StudyItemKind`, `Sm2State`, `Quality` (0–5), `FLASHCARD_QUALITY` (§7.2: Otra vez 1, Difícil 3, Bien 4, Fácil 5), `MIN_EASINESS` 1.3, `INITIAL_EASINESS` 2.5 y `newStudyItem(...)`, que crea un ítem vencido de inmediato (`intervalDays` 0, `repetitions` 0, `lapses` 0, `dueAt` = `now`). |
| `sm2.ts` | `applySm2(state, quality, now)`: SM-2 exacto según §7.1. Devuelve `Result<Sm2State, DomainError>`; una calidad no entera o fuera de 0–5 produce `STUDY_ENGINE_INVALID_QUALITY`. El intervalo usa la facilidad previa a la revisión, porque la especificación actualiza EF después del intervalo. `dueAt` se calcula en UTC sumando `I × 86 400 000 ms`. |
| `mastery.ts` | `computeMastery(items, now)`: nivel de dominio v1 según §7.3 (solo ítems no suspendidos; estabilidad `min(1, intervalDays / 21)`; acierto si `lastQuality >= 3`; umbrales 0,35 y 0,70). Exporta `MASTERY_LEVELS`, `MasteryLevel` y `MasterySnapshot` (`level`, `score`, `itemsTotal`, `itemsDue`). |
| `review-log.ts` | `ReviewLog` y `SessionKind` (`flashcards` / `exam` / `recall`). |
| `page-mastery.ts` | `PageMastery`, el agregado persistido por página. |
| `errors.ts` | Códigos `STUDY_ENGINE_ERROR`. |

Reglas del dominio: sin Zod, sin base de datos, sin `new Date()`; solo importa
de `@/shared/kernel`. Identificadores y comentarios en inglés.

## Pruebas

`sm2.test.ts` cubre primera, segunda y tercera revisión, fallo tras éxito,
suelo de EF, extremos q = 0 y q = 5, calidad inválida y una secuencia de tres
días simulados con `dueAt` exactos. `mastery.test.ts` cubre página sin ítems,
los límites 0,35 y 0,70, ítems suspendidos y el conteo de vencidos.

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos). Hoy el módulo solo
depende de `src/shared/kernel`.
