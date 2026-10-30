# ADR 0006 — Exámenes y repetición con variantes: decisiones de implementación de la Fase 5

| Campo | Valor |
|---|---|
| Fecha | 2026-10-06 |
| Estado | Aceptado |
| Enmiendas | 2026-10-29 (Fase 8, H13, H14, H17, H18 y H19): ver "Enmienda del 2026-10-29" al final; las decisiones 9, 17 y la consecuencia sobre el retiro quedan precisadas allí |
| Reemplaza | §7.5, punto 3 ("se completan hasta 5"), del documento maestro 1.3.1. Precisa §3.3, §6.1, §7.2, §8.4 y §13 (Fase 5); recogido en la versión 1.4.0 |

## Contexto

La Fase 5 construye la segunda técnica: preguntas de opción múltiple manuales y generadas, sesión de examen con corrección determinista, alimentación del motor SM-2, `ExamPageState`, repetición con variantes cuando la nota es menor a 70 % (§7.5) y retroalimentación con IA.

El documento maestro fija el qué, pero dejó abiertas varias cuestiones que aparecieron al implementarlo:

- Cuántas preguntas tiene un examen y en qué orden.
- Cómo alimenta el motor un examen que se rinde sin nada vencido (repetirlo varias veces no debe inflar los intervalos).
- Qué pasa con una repetición que ya no se puede armar: preguntas retiradas, pocas preguntas o un proveedor caído.
- Cuándo se pide retroalimentación y cuándo se reutiliza.
- Cómo se evitan dos inicios, dos respuestas o un cierre duplicado en carrera.

La fase se construyó con ODD en diez tareas (T1–T10) y nueve PR apiladas sobre `main` (#78–#85 y la de cierre); cada commit de trabajo pasó una revisión nativa de confiabilidad. Las decisiones de producto son del usuario (2026-10-05 y 2026-10-06).

## Decisión

### Producto

1. **Tamaño y orden.** El estudiante elige N entre 10 y 30 (por defecto 10). Orden: raíces falladas en el último examen, luego vencidas (la más antigua primero), luego las vistas hace más tiempo (nunca vistas primero); una pregunta por raíz, desempate por id. Una página con menos de 10 raíces activas no tiene examen (`EXAMS_NOT_ENOUGH_QUESTIONS`); con 10 o más, el examen tiene `min(N, raíces)` preguntas. Se aprueba con `correct × 100 ≥ total × 70` (aritmética entera).
2. **Alimentación del motor.** Un examen se rinde en cualquier momento. Incorrecta → q = 1 siempre (vence al día siguiente y la página aparece en "Hoy"). Correcta → q = 4 solo si el ítem de la raíz estaba vencido; si no, SM-2 no se toca. Es un caso de uso nuevo de `study-engine` (`recordExamReviews`, regla `examReviewQualityFor`), neutral respecto de la técnica; `gradeFlashcard` no cambia.
3. **Repetición reformulada.** Las raíces falladas vuelven primero con una redacción nueva (mismo concepto, nunca una redacción anterior de su linaje, retiradas incluidas; nunca otro tema) y luego el resto de la página hasta N. Reemplaza el "completar hasta 5" de §7.5. N no puede ser menor que los conceptos fallados que siguen en la página (`EXAMS_INVALID_QUESTION_COUNT`); la interfaz ofrece `max(10, fallados)` como mínimo.
4. **Costo de la repetición.** Generar las variantes cuesta una generación del límite diario (6) y solo si la generación tuvo éxito y la sesión se guardó. Una variante activa que nunca se mostró se reutiliza sin IA. Si todos los proveedores fallan, la respuesta no sirve o repite una redacción, la repetición se bloquea (`EXAMS_RETAKE_VARIANT_MISSING`): nunca se reutiliza la redacción original.
5. **Callejones sin salida de la repetición.**
   - Todas las raíces falladas retiradas desde el examen → la repetición pendiente se borra y la página vuelve a tener un examen normal (resultado `{ kind: "cleared" }`, "No queda nada por repetir").
   - Repetición imposible de armar (menos de 10 raíces o N menor que los fallados) → se rechaza con una composición de prueba **antes** de llamar a la IA, sin consumir nada; la interfaz muestra "Agrega o genera preguntas para repetir el examen".
   - Raíces falladas retiradas solo en parte → se repiten las que quedan.
6. **Cronómetro.** El reproductor muestra el tiempo transcurrido desde el inicio y los resultados el tiempo total. Excepción acotada a la regla de no mostrar tiempo de estudio: solo en la sesión y sus resultados; el dashboard sigue sin tiempo. La duración se deriva de `started_at` y `finished_at`. Sin límite de tiempo; una sesión abandonada queda abierta y se retoma.
7. **Política de retroalimentación** (`decideFeedback`). Fallo → nueva. Primera aprobación → nueva. Aprobación tras otra aprobación → sin IA: se muestra la guardada de la aprobación más reciente (marcada `reused`). Fallo tras aprobar → nueva.
8. **Repasar antes de repetir.** Un resultado fallado ofrece "Repasar contenido", que abre la página del cuaderno (`?repaso=examen`) con un aviso de los conceptos fallados y "Repetir examen".
9. **Edición y retiro.** Editar cambia la pregunta en el lugar y conserva su raíz. Retirar nunca borra; suspende el ítem de la raíz solo cuando su linaje no tiene otra pregunta activa.

### Técnica

10. **Una sola lista por sesión.** Al iniciar se guardan los ids de las preguntas en orden (`exam_sessions.question_ids`, migración 0011). Responder, cerrar y leer usan solo esa lista: un cambio posterior en las preguntas o en los vencimientos nunca mueve un examen abierto.
11. **Inicios serializados.** Los inicios de examen y de repetición de una página toman un bloqueo consultivo de transacción (`pg_advisory_xact_lock`) y vuelven a planificar dentro de él; una sesión abierta se retoma en lugar de abrir otra.
12. **Bloqueos de linaje y de sesión.** Retirar y crear variantes bloquean el linaje (`lockLineage`, `SELECT ... FOR UPDATE` en orden de id), así dos retiros concurrentes no dejan un ítem sin suspender. Responder y cerrar bloquean la fila de la sesión: una respuesta por pregunta y ninguna en una sesión cerrada.
13. **Cierre atómico.** `completeExamSession` exige todas las preguntas respondidas (`EXAMS_SESSION_INCOMPLETE`) y en una transacción guarda el resultado, `ExamPageState` y los repasos (`recordExamReviews` como savepoint). Un error revierte todo, incluso cuando el caso de uso devuelve `err` en lugar de lanzar (`runInUnitOfWork`, `runExamWork`). Una sesión ya registrada se rechaza (`STUDY_ENGINE_EXAM_SESSION_ALREADY_RECORDED`).
14. **Prompts.** `generate_exam_questions/v1` (con las preguntas activas para no duplicar), `generate_exam_variants/v1` (id de raíz, concepto, respuesta correcta y todas las redacciones anteriores) y `session_feedback/v2` (hasta 10 preguntas falladas y el texto de la página). Como máximo 15 preguntas o variantes por llamada al modelo.
15. **Analítica y retroalimentación nunca bloquean.** Un evento de analítica rechazado se informa a Sentry y se descarta (`trackSafely`). Un error al leer la retroalimentación deja `feedback: null` y no oculta la nota. La retroalimentación sigue el patrón de flashcards (ADR 0005): una fila por sesión reclamada una vez, tiempo de espera de 25 s y sin consumir el límite diario.
16. **Modelo de datos.** `requested_count` 10–30; respuestas atadas a su raíz por clave foránea `(question_id, root_id)`; `ExamPageState` guarda `owner_id` y su `upsert` no escribe en páginas ajenas; claves de linaje NO ACTION (las preguntas se retiran, no se borran).
17. **Hub.** `/exams` y la vista por cuaderno leen `ExamHubReader` (dos consultas por dueño) y las preguntas vencidas de `scheduling` (`createSchedulingServerApi`). Si la lista de vencidas falla, el hub se muestra sin ese dato (`dueToday: null`, informado a Sentry).

## Consecuencias

- Fallar un examen hace vencer al día siguiente los ítems de las raíces falladas; repetir exámenes aprobados no adelanta intervalos.
- El estudiante nunca ve dos veces la misma redacción de un concepto fallado, a costa de depender de la IA para repetir: sin proveedor disponible, la repetición espera.
- Una repetición imposible no gasta generaciones ni llamadas al modelo, y ninguna página queda bloqueada sin salida.
- La lista guardada hace los exámenes abiertos estables y reproducibles, pero una pregunta borrada físicamente impediría cerrar la sesión: por eso las preguntas solo se retiran.
- El cronómetro es la única métrica de tiempo de la aplicación y vive solo dentro del examen.

### Pendientes

Observaciones de las revisiones, no bloqueantes, para una limpieza posterior:

- La vista por cuaderno de `/exams` lee todo el listado del dueño y luego filtra (rendimiento).
- El atributo `dueCount` de `DeckSummaryCard` no se usa en el hub de exámenes; las páginas vencidas se marcan en `ExamPageCard`.
- La diferencia visual de las pantallas de exámenes y flashcards con el sistema de diseño queda para la Fase 8 (regla de interfaz congelada durante la Fase 5).
- El prompt de variantes lista todas las redacciones anteriores de cada raíz sin tope.
- Unas 10 idas y vueltas a la base por respuesta (varios segundos en `cogni-dev`); vigilar la latencia en producción.
- `NewFlashcardDialog` (Fase 4) todavía permite "Cancelar" mientras guarda.
- Tras recargar, la alerta y el aviso de "faltan preguntas" de la repetición muestran la misma frase.
- "Repasos de hoy" en `/flashcards` lista solo flashcards; la vista "Hoy" con todas las técnicas llega en la Fase 7.
- El e2e del criterio de "hecho" no inyecta un reloj del día siguiente; el vencimiento a 24 h lo prueban los casos de uso y las pruebas de base de datos.
- Dos generaciones concurrentes de preguntas en la misma página no se serializan (pueden quedar enunciados casi duplicados).
- No hay evento de analítica para las repeticiones.

## Alternativas descartadas

- **Examen de tamaño fijo o "completar hasta 5" en la repetición**: un examen de 5 preguntas es trivial y no deja elegir al estudiante; 10–30 cubre una página sin cansar.
- **q = 4 en toda respuesta correcta**: repetir un examen aprobado inflaría los intervalos sin que el estudiante haya esperado al vencimiento.
- **Reutilizar `gradeFlashcard` para exámenes**: rechaza ítems no vencidos y conoce flashcards; el motor necesita un caso de uso neutral.
- **Recomponer la lista de preguntas en cada respuesta**: dependía de los vencimientos vivos y podía cambiar las preguntas de un examen abierto.
- **Mostrar la redacción original si la IA falla**: contradice §7.5; el estudiante memorizaría la respuesta en lugar del concepto.
- **Llamar a la IA y luego comprobar si la repetición se puede armar**: una página imposible gastaba llamadas al proveedor en cada intento.
- **Dejar la repetición pendiente cuando ya no queda ninguna raíz fallada**: la página quedaba bloqueada, sin examen normal ni repetición.
- **Retroalimentación nueva en cada aprobación**: costo de IA sin información nueva; se reutiliza la de la aprobación anterior.

## Enmienda del 2026-10-29 (Fase 8)

Las decisiones de arriba se conservan como registro de la Fase 5. Desde la Fase 8 el código hace lo siguiente; donde choca con lo anterior, manda esta enmienda (`docs/documento-maestro.md` §3.3 y §8).

- **Creación solo con IA (H13).** Ya no hay "Nueva pregunta" ni creación manual de un examen: las preguntas nacen de "Generar" en el panel de técnicas de la página o de "Crear examen" en `/exams`. `create-exam-question.ts` queda solo para la página de edición.
- **Contenido mínimo (H14).** Una generación necesita al menos 100 palabras de contenido nuevo y unas 15 por pregunta, así que el examen más pequeño (10 preguntas) pide 150 palabras y 30 preguntas piden 450 (`examCountsForWords`, `src/shared/kernel/generation-capacity.ts`). El diálogo solo ofrece las cantidades que caben; una página corta responde `AI_PAGE_TOO_SHORT` antes del límite diario, sin llamar a la IA.
- **Centro plano (H17), reemplaza la decisión 17.** `/exams` lista cada página con preguntas como una tarjeta, filtrada en el servidor con `?cuaderno=<id>`; la vista por cuaderno desapareció y `/exams/[notebookId]` redirige a `/exams?cuaderno=<id>`. "Hacer examen" y "Repetir examen" abren `/exams/{cuaderno}/{página}?desde=hub`; la pantalla de inicio, el reproductor y los resultados conservan la marca (y `cuaderno`) y regresan a `/exams` (H18).
- **Página de edición (H18), reemplaza la decisión 9.** `/exams/{cuaderno}/{página}/editar` edita en el lugar (enunciado, 4 opciones, la correcta, concepto y explicación), añade preguntas a mano (`origin = manual`) y borra, como borrador local que "Guardar" aplica en una transacción (`applyExamEdits`). La antigua ruta `/preguntas` redirige aquí. Ya no hay "Retirar": **borrar una pregunta es un borrado real de su linaje completo** (raíz y variantes), del `StudyItem` de la raíz y de sus respuestas; antes, `ExamLineageReferences.dropLineage` la quita de los exámenes abiertos que la muestran y de la repetición pendiente. Los exámenes terminados conservan su nota. La página conserva al menos una pregunta (`EXAMS_LAST_QUESTION`); con menos de 10, no se puede iniciar un examen hasta generar o añadir más.
- **Borrado del conjunto (H19).** "Eliminar examen" en la tarjeta del centro borra, tras un diálogo con el recuento del servidor (`previewExamSetDeletionAction`, `deleteExamSetAction`), todas las preguntas de la página en cualquier estado, las sesiones y respuestas, la retroalimentación, los `StudyItem` (con su historial), `exam_page_state` y las huellas de generación del examen, y recalcula el dominio de la página en la misma transacción.
- **Consecuencia que cambia.** "Las preguntas solo se retiran" deja de valer: la lista guardada de un examen abierto se mantiene estable porque `dropLineage` actúa antes del borrado, no porque las filas sobrevivan. Las preguntas retiradas antes de la Fase 8 siguen como filas retiradas y cuentan para la regla de "nunca una redacción anterior de su linaje".
