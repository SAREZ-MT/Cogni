# Módulo `study-engine`

## Responsabilidad

Estado SM-2 por ítem, nivel de dominio por página y cálculo de vencimientos
(`docs/documento-maestro.md` §3.4 y §7). Ningún otro módulo calcula fechas de
repaso: todos pasan por este motor.

## Estado

Fase 4, tareas T1 y T2: dominio puro cubierto al 100 % y persistencia
(`study_items`, `review_logs`, `page_mastery`) con puertos, fakes en memoria y
adaptadores Drizzle. Los casos de uso y las acciones de servidor llegan en las
tareas siguientes de la misma fase.

## Dominio (`domain/`)

| Archivo | Contenido |
|---|---|
| `study-item.ts` | `StudyItem`, `StudyItemKind`, `Sm2State`, `Quality` (0–5), `FLASHCARD_QUALITY` (§7.2: Otra vez 1, Difícil 3, Bien 4, Fácil 5), `MIN_EASINESS` 1.3, `INITIAL_EASINESS` 2.5 y `newStudyItem(...)`, que crea un ítem vencido de inmediato (`intervalDays` 0, `repetitions` 0, `lapses` 0, `dueAt` = `now`). |
| `sm2.ts` | `applySm2(state, quality, now)`: SM-2 exacto según §7.1. Devuelve `Result<Sm2State, DomainError>`; una calidad no entera o fuera de 0–5 produce `STUDY_ENGINE_INVALID_QUALITY`. El intervalo usa la facilidad previa a la revisión, porque la especificación actualiza EF después del intervalo. `dueAt` se calcula en UTC sumando `I × 86 400 000 ms`. |
| `mastery.ts` | `computeMastery(items, now)`: nivel de dominio v1 según §7.3 (solo ítems no suspendidos; estabilidad `min(1, intervalDays / 21)`; acierto si `lastQuality >= 3`; umbrales 0,35 y 0,70). Exporta `MASTERY_LEVELS`, `MasteryLevel` y `MasterySnapshot` (`level`, `score`, `itemsTotal`, `itemsDue`). |
| `review-log.ts` | `ReviewLog` y `SessionKind` (`flashcards` / `exam` / `recall`). |
| `page-mastery.ts` | `PageMastery`, el agregado persistido por página. |
| `errors.ts` | Códigos `STUDY_ENGINE_ERROR`. |
| `study-item-repository.ts` | Puerto `StudyItemRepository`: `save` (inserta o reemplaza el estado SM-2), `findById`, `findBySource(kind, sourceId)`, `listDue(ownerId, now, pageId?)` (no suspendidos con `dueAt <= now`, el más antiguo primero), `listByPage` (incluye suspendidos) y `suspend` (idempotente). |
| `review-log-repository.ts` | Puerto `ReviewLogRepository`: `append` y `listByItem` (solo inserción, el más antiguo primero). |
| `page-mastery-repository.ts` | Puerto `PageMasteryRepository`: `upsert` (una fila por página; conserva el primer `id`), `getByPage` y `listByOwner` (ordenado por `pageId`). |

Reglas del dominio: sin Zod, sin base de datos, sin `new Date()`; solo importa
de `@/shared/kernel`. Identificadores y comentarios en inglés.

Todos los puertos filtran por `owner_id`: los datos de otro dueño no se ven
ni se sobrescriben.

## Persistencia

Migración `drizzle/0009_study_engine.sql` (reversión manual en
`0009_study_engine.down.sql`): tablas `study_items` (único `(kind, source_id)`,
índices `(owner_id, due_at)` y `(page_id)`), `review_logs`, `page_mastery`
(única por página), `flashcard_sessions` y `session_feedback` (única por
sesión, `status` pending/done/failed), y la columna `flashcards.archived_at`.
Rellena un `study_item` por cada flashcard existente no archivada, vencido
desde la creación de la tarjeta. RLS activo sin políticas, como el resto de
tablas: solo el servidor accede.

| Capa | Archivos |
|---|---|
| `application/testing/` | Contratos compartidos `*-repository.contract.ts` y fakes `InMemory*Repository` (exportados por `testing.ts`). |
| `infrastructure/` | `DrizzleStudyItemRepository`, `DrizzleReviewLogRepository`, `DrizzlePageMasteryRepository`. Aceptan la base o una transacción abierta (`DbExecutor`). |
| `server-api.ts` | `createStudyItemRepository(db)`, exportado por `index.ts`: otros módulos guardan ítems dentro de su propia transacción (flashcards lo usa en `DrizzleDeckUnitOfWork` para crear la tarjeta y su ítem juntos). |

## Pruebas

`sm2.test.ts` cubre primera, segunda y tercera revisión, fallo tras éxito,
suelo de EF, extremos q = 0 y q = 5, calidad inválida y una secuencia de tres
días simulados con `dueAt` exactos. `mastery.test.ts` cubre página sin ítems,
los límites 0,35 y 0,70, ítems suspendidos y el conteo de vencidos.
`in-memory-study-engine-repositories.contract.test.ts` corre los tres
contratos contra los fakes (el fake de ítems respeta el único `(kind, source_id)` y el de dominio no deja que otro dueño sobrescriba una página); `tests/db/drizzle-study-engine-repositories.contract.test.ts`
los corre contra Postgres y `tests/db/study-engine-schema.smoke.test.ts`
prueba el relleno, las restricciones y la reversión de la migración 0009.

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos). El dominio solo
depende de `src/shared/kernel`; la infraestructura usa `src/shared/db`.
