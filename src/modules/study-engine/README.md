# Módulo `study-engine`

## Responsabilidad

Estado SM-2 por ítem, nivel de dominio por página y cálculo de vencimientos
(`docs/documento-maestro.md` §3.4 y §7). Ningún otro módulo calcula fechas de
repaso: todos pasan por este motor.

## Estado

Fase 4 completa (decisiones en `docs/adr/0005-motor-de-repeticion-y-flashcards.md`):
dominio puro cubierto al 100 %, persistencia (`study_items`, `review_logs`,
`page_mastery`, `flashcard_sessions`, `session_feedback`) con puertos, fakes
en memoria y adaptadores Drizzle, la sesión de repaso de flashcards (iniciar,
calificar, terminar), el almacenamiento de la retroalimentación de sesión y
el trabajo diario que recalcula el dominio de todas las páginas.

## Dominio (`domain/`)

| Archivo | Contenido |
|---|---|
| `study-item.ts` | `StudyItem`, `StudyItemKind`, `Sm2State`, `Quality` (0–5), `FLASHCARD_QUALITY` (§7.2: Otra vez 1, Difícil 3, Bien 4, Fácil 5), `MIN_EASINESS` 1.3, `INITIAL_EASINESS` 2.5 y `newStudyItem(...)`, que crea un ítem vencido de inmediato (`intervalDays` 0, `repetitions` 0, `lapses` 0, `dueAt` = `now`). |
| `sm2.ts` | `applySm2(state, quality, now)`: SM-2 exacto según §7.1. Devuelve `Result<Sm2State, DomainError>`; una calidad no entera o fuera de 0–5 produce `STUDY_ENGINE_INVALID_QUALITY`. El intervalo usa la facilidad previa a la revisión, porque la especificación actualiza EF después del intervalo. `dueAt` se calcula en UTC sumando `I × 86 400 000 ms`. |
| `mastery.ts` | `computeMastery(items, now)`: nivel de dominio v1 según §7.3 (solo ítems no suspendidos; estabilidad `min(1, intervalDays / 21)`; acierto si `lastQuality >= 3`; umbrales 0,35 y 0,70). Exporta `MASTERY_LEVELS`, `MasteryLevel` y `MasterySnapshot` (`level`, `score`, `itemsTotal`, `itemsDue`). |
| `review-log.ts` | `ReviewLog` y `SessionKind` (`flashcards` / `exam` / `recall`). |
| `page-mastery.ts` | `PageMastery`, el agregado persistido por página. |
| `flashcard-session.ts` | `FlashcardSession` (`pageId` nulo en la sesión multipágina; abierta mientras `finishedAt` es nulo; solo cuenta repasos y respuestas "Otra vez", nunca tiempo) y `newFlashcardSession(...)`. |
| `session-feedback.ts` | `SessionFeedback` (`status` pending/done/failed, `content`, `generationId`), `newSessionFeedback`, `completeSessionFeedback` y `failSessionFeedback`. |
| `studied-page-reader.ts` | Puerto `StudiedPageReader.listStalePages({ staleBefore, after, limit })`: páginas con ítems cuyo dominio falta o es anterior a `staleBefore`, la más desactualizada primero, paginadas por `(masteryComputedAt, pageId)`. Es el único puerto entre dueños: lo usa solo el trabajo diario y devuelve identificadores. |
| `errors.ts` | Códigos `STUDY_ENGINE_ERROR`, entre ellos `ITEM_NOT_DUE`, `NOTHING_DUE`, `SESSION_NOT_FOUND` y `SESSION_FINISHED`. |
| `study-item-repository.ts` | Puerto `StudyItemRepository`: `save` (inserta o reemplaza el estado SM-2), `findById`, `findBySource(kind, sourceId)`, `listDue(ownerId, now, pageId?)` (no suspendidos con `dueAt <= now`, el más antiguo primero; excluye páginas archivadas y páginas de cuadernos archivados), `listByPage` (incluye suspendidos), `suspend` (idempotente), `lock` (bloqueo de fila hasta el fin de la unidad de trabajo) y `lockPage(pageId, ownerId, timeoutMs)` (bloquea todos los ítems de la página en orden de id y se rinde tras `timeoutMs`). |
| `review-log-repository.ts` | Puerto `ReviewLogRepository`: `append`, `listByItem` y `listBySession` (solo inserción, el más antiguo primero). |
| `session-feedback-repository.ts` | Puerto `SessionFeedbackRepository`: `create` (una fila por sesión; `false` si ya existe), `findBySession`, `settlePending` (escribe `done` o `failed` solo si la fila sigue `pending`; devuelve si se aplicó) y `reclaimStalePending` (toma una fila `pending` abandonada; un solo ganador). |
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
| `record-exam-reviews.ts` | `recordExamReviews({ ownerId, sessionId, pageId, answers: [{ rootId, correct }], now })`: alimenta el motor con un examen terminado, sin conocer el módulo exams. Regla de calidad local (`EXAM_REVIEW_QUALITY` y `examReviewQualityFor`, §7.2 y decisión del usuario 2026-10-05): incorrecta → q = 1 aunque no esté vencida; correcta → q = 4 solo si estaba vencida, si no se omite (sin repaso ni log). Los ítems suspendidos se omiten. Cada repaso guarda el ítem y un `ReviewLog(sessionKind "exam")`; `PageMastery` se recalcula una sola vez, todo en una `StudyUnitOfWork`. Bloquea los ítems en orden de id antes de leerlos. Rechaza sin escribir: raíz sin ítem, ítem ajeno, de otra página o de otra técnica (`ITEM_NOT_FOUND`; exams crea el ítem junto con la pregunta raíz) una raíz repetida (`INVALID_REVIEW_BATCH`) y una sesión que ya tiene logs de examen (`EXAM_SESSION_ALREADY_RECORDED`, comprobado dentro de la misma unidad de trabajo tras los bloqueos). Cualquier rechazo revierte la unidad de trabajo (`runInUnitOfWork`). |
| `run-in-unit-of-work.ts` | `runInUnitOfWork(uow, work)`: ejecuta un trabajo que devuelve `Result` en una `StudyUnitOfWork`; un `err` revierte todo lo escrito (la unidad de trabajo solo revierte ante una excepción) y se devuelve tal cual. Lo usan `gradeFlashcard` y `recordExamReviews`. |
| `finish-flashcard-session.ts` | `finishFlashcardSession({ sessionId })`: cierra la sesión (idempotente) y devuelve sus conteos. |
| `recompute-all-page-mastery.ts` | `recomputeAllPageMastery(deps)`: el trabajo diario (§7.3). Recorre `listStalePages` en lotes de 200 dentro de `timeBudgetMs`; por página, una unidad de trabajo que bloquea los ítems (`lockPage` con `MASTERY_PAGE_LOCK_TIMEOUT_MS`, 5 s), lee el reloj, recalcula con `computeMastery` y hace `upsert`. Una página que falla (incluido el tiempo de espera del bloqueo) se cuenta y se informa con `onPageError` sin detener a las demás. Devuelve `{ pagesRecomputed, pagesFailed, complete }`. |
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
| `infrastructure/` | `DrizzleStudyItemRepository` (`lock` y `lockPage` son `SELECT ... FOR UPDATE`; `lockPage` fija antes un `lock_timeout` local a la transacción con `set_config`), `DrizzleReviewLogRepository`, `DrizzlePageMasteryRepository`, `DrizzleFlashcardSessionRepository`, `DrizzleSessionFeedbackRepository` (reclamo y cierre con `UPDATE` condicional), `DrizzleStudiedPageReader` y `DrizzleStudyUnitOfWork` (una transacción por calificación o por página del trabajo diario). Aceptan la base o una transacción abierta (`DbExecutor`). |
| `server-api.ts` | Exportado por `index.ts`. `createStudyItemRepository(db)`: otros módulos guardan ítems dentro de su propia transacción (flashcards lo usa en `DrizzleDeckUnitOfWork`). `createFlashcardSessionsServerApi({ db, pages, clock, ids })`: `start`, `grade` y `finish`, que llaman las acciones de servidor de flashcards (este módulo no conoce el texto de las tarjetas). `createSessionFeedbackSources(db)`: sesiones, logs, ítems y retroalimentación para el caso de uso `requestSessionFeedback` de flashcards. `createMasteryRecomputeJob({ db, clock, ids, timeBudgetMs, onPageError })`: el trabajo diario que ejecuta la ruta `/api/recompute-mastery`. `createExamReviewRecorder({ db, ids })`: `record` llama a `recordExamReviews`; con `db` = la transacción de exams, corre como savepoint y confirma o revierte junto con el cierre del examen. |

## Trabajo diario

`GET /api/recompute-mastery` (`src/app/api/recompute-mastery/route.ts`) corre
con Vercel Cron a las 06:30 UTC (`vercel.json`). Exige `Authorization: Bearer
$CRON_SECRET` con comparación de tiempo constante (401 si falta o no coincide;
500 si `CRON_SECRET` no está configurado). Declara `maxDuration = 300` y da al
trabajo 240 s; responde `{ ok, pagesRecomputed, pagesFailed, complete }`, y
500 `{ ok: false }` si falla el listado. Una ejecución incompleta deja las
páginas pendientes al frente de la siguiente.

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
concurrentes de la misma tarjeta. `recompute-all-page-mastery.test.ts` cubre
lotes, presupuesto de tiempo, orden por antigüedad, páginas fallidas y el
orden bloquear → leer → escribir; `tests/db/recompute-page-mastery-race.test.ts`
prueba contra Postgres que el trabajo espera la calificación en curso y que
abandona una página cuyo bloqueo supera el `lock_timeout`. Los contratos de
`StudiedPageReader` y `SessionFeedbackRepository` corren contra el fake y
contra Postgres.

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos). El dominio solo
depende de `src/shared/kernel`; la infraestructura usa `src/shared/db`.
