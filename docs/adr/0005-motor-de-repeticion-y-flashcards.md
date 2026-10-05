# ADR 0005 — Motor de repetición espaciada y Flashcards: decisiones de implementación de la Fase 4

| Campo | Valor |
|---|---|
| Fecha | 2026-10-04 |
| Estado | Aceptado |
| Reemplaza | Nada. Precisa §5.2, §6.1, §7 y §13 (Fase 4) del documento maestro 1.2.0; recogido en la versión 1.3.0 |

## Contexto

La Fase 4 construye el motor de repetición espaciada (§7) y la primera técnica que lo usa de punta a punta: flashcards manuales y generadas, sesión de repaso con los cuatro botones de SM-2, retroalimentación con IA al cerrar la sesión, vista "Repasos de hoy" y un trabajo diario que recalcula el nivel de dominio de cada página.

El documento maestro describe qué debe existir, pero no fija varias cuestiones que aparecieron al implementarlo:

- Dónde ocurre el repaso y qué abre cada fila de "Repasos de hoy".
- Qué pasa cuando una tarjeta se califica dos veces (doble clic o reintento de red).
- En qué módulo vive la retroalimentación y si consume el límite diario de IA (ADR 0004).
- Cómo se evita una retroalimentación duplicada o atascada en `pending`.
- Cómo corre el trabajo diario dentro de los límites de Vercel (ADR 0003) sin pisar calificaciones concurrentes.

La fase se construyó con ODD en ocho tareas (T1–T8) y siete PR apiladas sobre `main`; cada commit de trabajo pasó una revisión nativa de confiabilidad.

## Decisión

1. **El repaso ocurre en la propia página del mazo.** `/flashcards/{cuaderno}/{página}` muestra el mazo y, al pulsar "Repasar", el reproductor en el mismo lugar; no hay una ruta de sesión separada. Cada fila de "Repasos de hoy" abre esa página con `?repasar=1`, que inicia el repaso una vez y se retira de la URL con `history.replaceState`. La sesión multipágina (`startFlashcardSession` sin `pageId`, `FlashcardSession.page_id` nulo) existe en el motor, pero no tiene punto de entrada en la interfaz.
2. **Calificar exige que el ítem esté vencido.** `gradeFlashcard` bloquea la fila del ítem (`SELECT ... FOR UPDATE`) y rechaza un ítem no vencido con `STUDY_ENGINE_ITEM_NOT_DUE`, sin escribir. Así un doble envío nunca aplica SM-2 dos veces. Consecuencia en las pruebas: la secuencia de "3 días simulados" repasa los días 0, 1 y 2, y la tercera revisión ocurre el día 7, cuando vence (intervalos 1, 6 y 16 días; EF 2,46).
3. **Sin sesión vacía.** Si no hay ítems vencidos, `startFlashcardSession` responde `STUDY_ENGINE_NOTHING_DUE` y no crea fila; la interfaz muestra "Estás al día".
4. **La retroalimentación vive en `flashcards`.** El caso de uso `requestSessionFeedback` está en `flashcards` (§5.2 le asigna "retroalimentación" y el prompt necesita el anverso de las tarjetas, que `study-engine` no conoce). `study-engine` aporta la entidad `SessionFeedback`, su repositorio y las fuentes de datos (`createSessionFeedbackSources`). Las acciones de sesión (`start`, `grade`, `finish`, `requestSessionFeedback`) también viven en `flashcards`, porque `study-engine` no puede importar módulos de técnicas.
5. **La retroalimentación no gasta el límite diario de IA.** Consulta el límite con `peek` y no la pide si el estudiante ya agotó sus 6 generaciones (ADR 0004), pero no consume una. Solo se pide para una sesión terminada con al menos una respuesta (`FLASHCARDS_FEEDBACK_SESSION_OPEN`, `FLASHCARDS_FEEDBACK_NOTHING_REVIEWED`). El prompt `session_feedback/v1` recibe conteos por botón y hasta 8 anversos difíciles (200 caracteres cada uno), con temperatura 0,3 y sin datos de tiempo.
6. **Retroalimentación idempotente y recuperable.**
   - Una fila por sesión: el único `(session_kind, session_id)` de la migración 0009 y un `insert ... on conflict do nothing` hacen de la primera solicitud la dueña de la fila; las siguientes leen la misma.
   - La espera de la IA se corta a los 25 s (`FEEDBACK_AI_TIMEOUT_MS`); la llamada no se cancela porque el puerto del proveedor no admite señal de aborto.
   - Una fila `pending` sin tocar durante 2 minutos (`STALE_PENDING_MS`) pertenece a una solicitud muerta y otra puede reclamarla con un `UPDATE` condicional (un solo ganador).
   - `done` y `failed` son definitivos: la escritura final solo se aplica mientras la fila sigue `pending` (`settlePending`). Si no se aplica o su resultado es incierto, la solicitud relee la fila y devuelve lo guardado. Una solicitud lenta cuya fila fue reclamada no puede pisar el resultado de otra.
   - Un `failed` nunca se reintenta. Un fallo de la IA nunca impide cerrar la sesión.
7. **Trabajo diario `/api/recompute-mastery`.**
   - Vercel Cron a las 06:30 UTC (`30 6 * * *`), protegido con `CRON_SECRET` como `/api/keep-alive`.
   - `maxDuration = 300` (plan Hobby con Fluid Compute) y presupuesto del trabajo de 240 s; responde `{ ok, pagesRecomputed, pagesFailed, complete }`.
   - Recorre primero las páginas más desactualizadas (sin dominio, luego `computed_at` más antiguo) con paginación por `(computed_at, page_id)` y solo mientras su dominio sea anterior al inicio de la ejecución. Una ejecución cortada deja las páginas pendientes al frente de la siguiente.
   - Una transacción por página: bloquea los ítems de la página en orden de id (`lockPage`), lee el reloj después del bloqueo y escribe el dominio. Una calificación en curso termina antes y el trabajo nunca escribe un dominio más viejo que ella.
   - La espera de ese bloqueo está acotada por un `lock_timeout` local a la transacción de 5 s (`MASTERY_PAGE_LOCK_TIMEOUT_MS`). Si se agota, la página cuenta como fallida y se reintenta primero en la siguiente ejecución.
   - Una página que falla se cuenta y se registra sin detener a las demás.
8. **Detalles de modelo** que precisan §6.1: `FlashcardSession` no tiene `status` (abierta mientras `finished_at` es nulo); `Flashcard.archived_at`, que faltaba en la Fase 3, se agrega en la migración 0009; los ítems rellenados para tarjetas existentes usan UUID v4 (`gen_random_uuid()`); archivar una tarjeta suspende su ítem y el último ítem activo de un mazo no se puede archivar (un mazo nunca queda vacío).

## Consecuencias

- El motor es la única fuente de fechas de repaso (§3.4): `scheduling` solo lee `due_at`, y las técnicas califican a través de `study-engine`.
- El nivel de dominio se recalcula en cada calificación y una vez al día; entre ambos momentos `items_due` puede quedar atrasado hasta 24 h para páginas que nadie repasó.
- Con 20 usuarios el trabajo diario termina muy por debajo del presupuesto. Si una ejecución completa llegara a necesitar más de 240 s, se programaría con más frecuencia antes de paralelizar.
- Un bloqueo largo o un interbloqueo con otro escritor solo hace fallar esa página en esa ejecución; Postgres aborta a uno de los lados y el trabajo la reintenta al día siguiente.
- La retroalimentación puede quedar sin contenido (`failed`) sin afectar al repaso; el estudiante ve una nota tranquila en lugar de un error.

### Pendientes

Observaciones de las revisiones, no bloqueantes, para una limpieza posterior:

- `DeckReview` guarda el inicio automático por instancia: una navegación del cliente a `?repasar=1` de otra página sin volver a montar el componente no inicia el repaso, y el parámetro queda en la URL cuando no hay nada que repasar.
- El contrato del lector de "Repasos de hoy" no prueba el desempate por id de página cuando dos páginas tienen el mismo `earliestDueAt`.
- `isAuthorized` está duplicado entre `/api/keep-alive` y `/api/recompute-mastery`.
- La sesión multipágina no tiene punto de entrada en la interfaz.
- Las sesiones abandonadas quedan abiertas (sin `finished_at`).
- El trabajo diario sigue recalculando páginas archivadas (igual que `gradeFlashcard`).
- Los e2e registran "destination stream closed early" tras recargar; la causa no está confirmada.

## Alternativas descartadas

- **Ruta de sesión separada y reproductor multipágina en "Repasos de hoy"**: más interfaz y navegación para la Fase 4; la página del mazo ya tenía el contexto y la vista completa de "Hoy" llega en la Fase 7.
- **Aceptar calificaciones de ítems no vencidos**: un doble envío aplicaría SM-2 dos veces y adelantaría el intervalo.
- **Consumir una generación diaria por retroalimentación**: castigaría al estudiante por repasar; la retroalimentación es corta y opcional.
- **`upsert` condicional por `computed_at` en el trabajo diario**: `gradeFlashcard` lee su reloj antes de esperar el bloqueo, así que una marca de tiempo no ordena las escrituras de forma fiable; el bloqueo por página sí.
- **Recorrer todas las páginas por id en cada ejecución**: una ejecución cortada por el tiempo volvería a empezar por las mismas páginas y las últimas nunca se actualizarían.
- **Esperar el bloqueo sin límite**: una sola transacción retenida podría llevar la ejecución más allá de `maxDuration` y Vercel la cortaría sin informe.
