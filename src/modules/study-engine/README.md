# Módulo `study-engine`

## Responsabilidad

Estado SM-2 por ítem, nivel de dominio por página y cálculo de vencimientos
(`docs/documento-maestro.md` §3.4 y §7). Ningún otro módulo calcula fechas de
repaso: todos pasan por este motor.

## Estado

Fase 4, tareas T1 a T4: dominio puro cubierto al 100 %, persistencia
(`study_items`, `review_logs`, `page_mastery`, `flashcard_sessions`) con
puertos, fakes en memoria y adaptadores Drizzle, y la sesión de repaso de
flashcards (iniciar, calificar, terminar). La retroalimentación con IA, la
vista "Repasos de hoy" y el trabajo diario llegan en las tareas siguientes.

## Dominio (`domain/`)

| Archivo | Contenido |
|---|---|
| `study-item.ts` | `StudyItem`, `StudyItemKind`, `Sm2State`, `Quality` (0–5), `FLASHCARD_QUALITY` (§7.2: Otra vez 1, Difícil 3, Bien 4, Fácil 5), `MIN_EASINESS` 1.3, `INITIAL_EASINESS` 2.5 y `newStudyItem(...)`, que crea un ítem vencido de inmediato (`intervalDays` 0, `repetitions` 0, `lapses` 0, `dueAt` = `now`). |
| `sm2.ts` | `applySm2(state, quality, now)`: SM-2 exacto según §7.1. Devuelve `Result<Sm2State, DomainError>`; una calidad no entera o fuera de 0–5 produce `STUDY_ENGINE_INVALID_QUALITY`. El intervalo usa la facilidad previa a la revisión, porque la especificación actualiza EF después del intervalo. `dueAt` se calcula en UTC sumando `I × 86 400 000 ms`. |
| `mastery.ts` | `computeMastery(items, now)`: nivel de dominio v1 según §7.3 (solo ítems no suspendidos; estabilidad `min(1, intervalDays / 21)`; acierto si `lastQuality >= 3`; umbrales 0,35 y 0,70). Exporta `MASTERY_LEVELS`, `MasteryLevel` y `MasterySnapshot` (`level`, `score`, `itemsTotal`, `itemsDue`). |
| `review-log.ts` | `ReviewLog` y `SessionKind` (`flashcards` / `exam` / `recall`). |
| `page-mastery.ts` | `PageMastery`, el agregado persistido por página. |
| `flashcard-session.ts` | `FlashcardSession` (`pageId` nulo en la sesión multipágina; abierta mientras `finishedAt` es nulo; solo cuenta repasos y respuestas "Otra vez", nunca tiempo) y `newFlashcardSession(...)`. |
| `errors.ts` | Códigos `STUDY_ENGINE_ERROR`, entre ellos `ITEM_NOT_DUE`, `NOTHING_DUE`, `SESSION_NOT_FOUND` y `SESSION_FINISHED`. |
| `study-item-repository.ts` | Puerto `StudyItemRepository`: `save` (inserta o reemplaza el estado SM-2), `findById`, `findBySource(kind, sourceId)`, `listDue(ownerId, now, pageId?)` (no suspendidos con `dueAt <= now`, el más antiguo primero), `listByPage` (incluye suspendidos), `suspend` (idempotente) y `lock` (bloqueo de fila hasta el fin de la unidad de trabajo). |
| `review-log-repository.ts` | Puerto `ReviewLogRepository`: `append` y `listByItem` (solo inserción, el más antiguo primero). |
| `flashcard-session-repository.ts` | Puerto `FlashcardSessionRepository`: `insert`, `findById`, `recordGrade` (incrementos atómicos) y `finish` (idempotente). |
| `page-mastery-repository.ts` | Puerto `PageMasteryRepository`: `upsert` (una fila por página; conserva el primer `id`), `getByPage` y `listByOwner` (ordenado por `pageId`). |

Reglas del dominio: sin Zod, sin base de datos, sin `new Date()`; solo importa
de `@/shared/kernel`. Identificadores y comentarios en inglés.

Todos los puertos filtran por `owner_id`: los datos de otro dueño no se ven
ni se sobrescriben.

## Casos de uso (`application/`)

| Archivo | Contenido |
|---|---|
| `start-flashcard-session.ts` | `startFlashcardSession({ pageId? })`: comprueba la página con `PageAccess` (que `PageTextReader` de notebooks cumple), lista las flashcards vencidas de esa página o de todas las del dueño, abre la sesión y devuelve cada ítem con `flashcardId` y los días que programaría cada botón. Sin vencidas responde `NOTHING_DUE` y no abre sesión. |
| `grade-flashcard.ts` | `gradeFlashcard({ sessionId, itemId, rating })`: botón → calidad (§7.2), `applySm2`, guarda el ítem, agrega el `ReviewLog`, cuenta la respuesta en la sesión y recalcula `PageMastery`, todo en una `StudyUnitOfWork`. Bloquea el ítem antes de leerlo. Rechaza sin escribir: sesión ajena, desconocida o terminada; ítem ajeno, de otra página, de otra técnica, suspendido (tarjeta archivada) o no vencido (doble envío). |
| `finish-flashcard-session.ts` | `finishFlashcardSession({ sessionId })`: cierra la sesión (idempotente) y devuelve sus conteos. |
| `study-unit-of-work.ts` | Puerto `StudyUnitOfWork`: ítems, logs, dominio y sesiones confirman o revierten juntos. |

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
| `infrastructure/` | `DrizzleStudyItemRepository` (`lock` es `SELECT ... FOR UPDATE`), `DrizzleReviewLogRepository`, `DrizzlePageMasteryRepository`, `DrizzleFlashcardSessionRepository` y `DrizzleStudyUnitOfWork` (una transacción por calificación). Aceptan la base o una transacción abierta (`DbExecutor`). |
| `server-api.ts` | Exportado por `index.ts`. `createStudyItemRepository(db)`: otros módulos guardan ítems dentro de su propia transacción (flashcards lo usa en `DrizzleDeckUnitOfWork`). `createFlashcardSessionsServerApi({ db, pages, clock, ids })`: `start`, `grade` y `finish`, que llaman las acciones de servidor de flashcards (este módulo no conoce el texto de las tarjetas). |

## Pruebas

`sm2.test.ts` cubre primera, segunda y tercera revisión, fallo tras éxito,
suelo de EF, extremos q = 0 y q = 5, calidad inválida y una secuencia de tres
días simulados con `dueAt` exactos. `mastery.test.ts` cubre página sin ítems,
los límites 0,35 y 0,70, ítems suspendidos y el conteo de vencidos.
`in-memory-study-engine-repositories.contract.test.ts` corre los tres
contratos contra los fakes (el fake de ítems respeta el único `(kind, source_id)` y el de dominio no deja que otro dueño sobrescriba una página); `tests/db/drizzle-study-engine-repositories.contract.test.ts`
los corre contra Postgres y `tests/db/study-engine-schema.smoke.test.ts`
prueba el relleno, las restricciones y la reversión de la migración 0009.
Los casos de uso tienen pruebas propias con fakes y reloj fijo;
`flashcard-review.integration.test.ts` recorre iniciar → calificar →
terminar durante 3 días simulados (y el día 7, cuando vence la tercera
revisión) y comprueba intervalos, EF, fechas, logs y dominio exactos.
`tests/db/drizzle-study-unit-of-work.test.ts` prueba contra Postgres que una
calificación escribe todo junto, revierte todo si falla un paso, rechaza el
ítem de otro dueño y aplica SM-2 una sola vez ante dos calificaciones
concurrentes de la misma tarjeta.

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos). El dominio solo
depende de `src/shared/kernel`; la infraestructura usa `src/shared/db`.
