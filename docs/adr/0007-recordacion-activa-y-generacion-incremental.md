# ADR 0007 — Recordación activa y generación incremental: decisiones de implementación de la Fase 6

| Campo | Valor |
|---|---|
| Fecha | 2026-10-10 |
| Estado | Aceptado |
| Reemplaza | §8.3 ("el límite de evaluaciones aún no está implementado") y, para recordación activa, la regla de §6.1 "`SessionFeedback` existe una vez por sesión terminada" del documento maestro 1.4.0. Precisa §3.1, §3.3, §6.1, §7.4, §8.4, §8.5 y §13 (Fase 6); recogido en la versión 1.5.0 |

## Contexto

La Fase 6 construye la tercera técnica: preguntas abiertas con rúbrica generadas por IA, una sesión con respuesta escrita y autoevaluación de 0 a 5, evaluación asíncrona con esquema estricto, calidad combinada, retroalimentación al final y señales metacognitivas. Su criterio de "hecho" exige que una sesión completa funcione aunque un proveedor falle a mitad y que cada respuesta conserve su evaluación cruda.

El documento maestro fija el qué, pero dejó abiertas cuestiones que aparecieron al implementarlo:

- Dónde corre la evaluación asíncrona sin cola de trabajos (ADR 0003) y qué ve el estudiante mientras tanto.
- Qué pasa con una respuesta cuya evaluación falla en todos los proveedores, y con una pregunta saltada.
- Cuántas evaluaciones puede pedir un usuario por día y qué pasa al llegar al tope.
- Si la sesión de recordación necesita un resumen de IA (`SessionFeedback`) además de la justificación por pregunta.
- Cómo se generan de nuevo las técnicas cuando la página cambia, sin repetir el contenido ya usado.
- Por dónde entra el estudiante a practicar cada técnica desde la página y desde los hubs.

La fase se construyó con ODD en diez tareas (T1–T7, T5b, T5c y la de cierre T8) y siete PR apiladas sobre `main` (#87–#93) más la de cierre; cada commit de trabajo pasó una revisión nativa de confiabilidad. Las decisiones de producto son del usuario (2026-10-06 a 2026-10-08), con una condición general: la interfaz existente de recordación activa no cambia salvo lo aprobado explícitamente.

## Decisión

### Evaluación

1. **Asíncrona dentro de la función.** Cada respuesta (texto y autoevaluación) se guarda al darla. "Terminar" o la última pregunta cierran la sesión sin esperar a la IA: `finishRecallSessionAction` programa `evaluateRecallSession` con `after()`, dentro del presupuesto de la ruta de la sesión (`maxDuration = 300`, ADR 0003; también en la ruta de resultados). No hay cola durable: una corrida reclama las respuestas pendientes (`evaluation_claimed_at`), y un reclamo de más de 6 minutos (más que `maxDuration`) se considera de una corrida muerta y se retoma. Una llamada `evaluate_recall_answer/v1` por respuesta (temperatura 0,2), con la rúbrica y el fragmento de la página más parecido a la pregunta.
2. **Sondeo acotado y "Reintentar".** La vista de resultados sondea el estado (2,5 s, ×1,5 por lectura, tope de 20 s, 32 lecturas, unos 9 minutos) y deja de sondear ante un error que no se cura (`RECALL_SESSION_NOT_FOUND`, `RECALL_SESSION_REQUIRED`, `RECALL_INVALID_INPUT`). Si una sesión terminada sigue `pending` sin ninguna respuesta reclamada o guardada dentro del plazo del reclamo (`evaluationRunNeeded`), el sondeo programa una corrida nueva; así una corrida interrumpida se cura sola y los sondeos no acumulan corridas. El `StatusBanner` existente ofrece "Reintentar": devuelve las respuestas fallidas a `pending`, la sesión a `pending` y programa la evaluación.
3. **Evaluación fallida.** Si fallan todos los proveedores o la salida no cumple el esquema, la respuesta queda `failed` con el intento crudo `{ source: "failed", code, generationId }` (el detalle del fallo vive en la fila auditada de `ai_generations`). No se inventa una calidad combinada, no se registra repaso SM-2 (la pregunta sigue vencida y vuelve) y la sesión termina `partial`. Un error inesperado por respuesta falla solo esa respuesta (`RECALL_UNEXPECTED`, informado a Sentry).
4. **Respuesta saltada.** "Saltar", o calificar con el texto vacío, guarda `(sin respuesta)`. Su evaluación no llama al modelo ni consume el límite: puntaje IA 0 y el registro auditable `{ source: "skipped", score: 0, justification: "Pregunta sin responder." }`; la calidad combinada sigue la fórmula de §7.4 con su autoevaluación.
5. **Límite diario de evaluaciones.** `AI_DAILY_EVALUATIONS = 60` respuestas evaluadas por el modelo por usuario y día (SRS RF-AI-03), con su propia clave de Upstash Ratelimit `{prefijo}:ai:eval` (ventana fija de un día), separada de la de generaciones (`{prefijo}:ai:gen`). Se consulta (`peek`) antes de cada llamada y se consume (`check`) solo tras una evaluación `done`. **Regla de tope:** con el límite agotado la respuesta queda `failed` con `{ source: "failed", code: "AI_DAILY_LIMIT_REACHED", generationId: null, resetAt }`, nunca queda pendiente; la sesión termina `partial`, la página deja de sondear y "Reintentar" la evalúa cuando se renueve la ventana. Si otra evaluación gastó la última unidad entre `peek` y `check`, la evaluación ya hecha se conserva, el exceso va a Sentry y el resto de la corrida no llama al modelo.
6. **SM-2.** Una respuesta `done` alimenta el motor con `combined = round(0.6·ai + 0.4·self)` (§7.4, RF-AR-04) mediante `recordRecallReviews` de `study-engine` (`ReviewLog(sessionKind "recall")`), que no conoce el módulo. Calidad < 3 se registra aunque el ítem no esté vencido; ≥ 3 solo si está vencido (sin inflar intervalos con una evaluación tardía o un reintento). La guarda es por (sesión, ítem), así una corrida repetida o en carrera nunca registra dos veces ni revierte las demás respuestas.
7. **Calibración y desacuerdo.** La calibración se deriva y no se guarda: exceso de confianza `self ≥ 4 y ai ≤ 2`, falta de confianza `self ≤ 1 y ai ≥ 4` (RF-AR-05). "No estoy de acuerdo" guarda `disagreed = true` y nunca cambia el puntaje (§8.5); el botón queda deshabilitado con el texto "Marcado como desacuerdo", también al volver a abrir los resultados.
8. **Sin resumen de IA de la sesión (desviación deliberada).** La recordación activa no crea `SessionFeedback`: la retroalimentación del final de la sesión es la justificación por pregunta (conceptos presentes y ausentes) junto con la calidad combinada y la calibración. Se aparta de DATA-API ("toda sesión terminada tiene su SessionFeedback") porque un segundo llamado a la IA repetiría lo que ya dicen las justificaciones y gastaría cuota gratuita.

### Sesión y puntajes

9. **Tamaño fijo de 10.** El reproductor no tiene selector. Orden: preguntas vencidas, luego nuevas (nunca repasadas) y, para completar 10, las repasadas hace más tiempo; una página con preguntas nunca da una sesión vacía. Abrir o recargar la ruta solo lee un plan (`planRecallSession`); la sesión se crea con la primera respuesta guardada, así una visita sin responder no deja sesiones vacías. "Terminar" cierra con las respuestas dadas; las no respondidas no se registran.
10. **Puntajes mostrados.** Porcentaje por sesión = promedio de la calidad combinada × 20; aciertos, parciales y fallos según el puntaje IA (≥ 4 / 2–3 / ≤ 1). Las respuestas pendientes o fallidas no cuentan. El dominio de cada página y el promedio del hub vienen del dominio de página de `study-engine` (RF-SE-02), nunca de una fórmula local.

### Generación

11. **Diez preguntas por generación.** `generate_recall_questions/v1` crea 10 preguntas con rúbrica por llamada (≤ 15, ADR 0006) y recibe las preguntas activas de la página (hasta 60) para no repetirlas. Cuesta una unidad de `AI_DAILY_GENERATIONS` y solo si las preguntas se guardaron: se consulta antes de la llamada y se consume después de confirmar (patrón de la repetición de exámenes). Si consumir la unidad falla tras guardar, la generación igual responde con éxito y el fallo va a Sentry.
12. **Generación incremental (las tres técnicas).** Cada técnica guarda por página la huella de los párrafos que ya envió a la IA (tabla `generation_fingerprints`, migración 0013). Un párrafo es cada línea no vacía de `plain_text`; su huella es el sha256 del texto normalizado (forma Unicode NFC, espacios colapsados, minúsculas), por lo que mayúsculas, espacios o la forma de los acentos no lo vuelven nuevo. "Generar" envía solo los párrafos nuevos o editados, en orden y recortados a `AI_PAGE_TOKEN_CAP`; un párrafo repetido se envía una vez. Sin nada nuevo responde `FLASHCARDS_/EXAMS_/RECALL_NO_NEW_CONTENT` antes del límite: no llama a la IA, no consume generación y la interfaz muestra "No hay contenido nuevo para generar". Las huellas se guardan en la misma unidad de trabajo que los ítems: un fallo o una reversión no guarda ninguna. Borrar contenido nunca borra ítems ya generados.
    - **Solo cuenta lo enviado entero.** Se guardan las huellas de los párrafos que el recorte conservó completos; uno cortado y los siguientes siguen siendo nuevos.
    - **Párrafo más largo que el tope.** Si el primer párrafo nuevo, solo, supera el tope, se envía su inicio y se marca usado (su final nunca se envía); si no, cada "Generar" reenviaría el mismo inicio y gastaría una generación sin avanzar.
    - **Páginas anteriores a la fase.** Una página generada antes (con ítems y sin huellas) envía todos sus párrafos una vez en su siguiente "Generar". Exámenes y recordación listan las preguntas activas en el prompt y evitan duplicados; flashcards puede repetir tarjetas esa única vez.
    - Cada módulo conserva su momento de consumo: flashcards y exámenes consumen antes de la llamada; recordación, después de guardar.

### Interfaz

13. **Panel "Técnicas de estudio" (modelo NotebookLM Studio, decisión del usuario 2026-10-06).** Tres tarjetas arriba (Flashcards, Recordación activa, Examen: ícono, nombre, descripción) con el mismo botón "Generar" a lo ancho y la línea "Te quedan N generaciones hoy", coloreado por técnica con la paleta pastel (Flashcards amarillo, Recordación activa menta, Examen rosa). Debajo, "Generado en esta página": una fila por técnica con contenido (conteo y estado), que abre su práctica (repaso del mazo, sesión de recordación, examen). Se quitaron los accesos dentro de las tarjetas ("Rendir examen", "Repetir examen", enlace al mazo y "Preguntas"). El "Generar" de Examen abre un diálogo para elegir N (10–30, de 5 en 5, por defecto 10).
14. **Hub de exámenes y "Crear examen".** `/exams` y la vista por cuaderno siguen listando solo las páginas con preguntas de examen. El encabezado ofrece "Crear examen" (reemplaza el inicio rápido "Nuevo examen"): un diálogo con cuaderno y página obligatorios y dos caminos, "Generar con IA" (N de 10 a 30) o "Crear mis preguntas" (abre la pantalla de preguntas de la página). Es la entrada para la primera pregunta manual de una página sin preguntas. Si los cuadernos no se pueden leer, el diálogo muestra un error, no un falso estado vacío.
15. **Hub de recordación activa.** `/active-recall` y la vista por cuaderno usan datos reales; "Active recall" queda habilitado en la barra lateral. Cada tarjeta de cuaderno del hub muestra el contador rojo de preguntas vencidas hoy (`dueCount` de `DeckSummaryCard`, el mismo de flashcards). "Repasos de hoy" en `/flashcards` sigue listando solo flashcards hasta la vista "Hoy" completa de la Fase 7.
16. **"Ver resultados →".** En la vista por cuaderno, la tarjeta de cada página abre los resultados de su sesión más reciente (`/active-recall/{cuaderno}/{página}/resultados?sesion={id}`, que responde 404 ante un id mal formado), desde donde "Nueva sesión →" inicia otra; la etiqueta de la tarjeta pasó de "Repasar →" a "Ver resultados →". El flujo completo se revisa en la Fase 8.

## Consecuencias

- Una sesión termina aunque un proveedor caiga a mitad: las respuestas ya están guardadas, la evaluación corre después y lo que falló queda `failed`, visible y reintentable, sin inventar una nota ni mover SM-2.
- Cada respuesta conserva su evaluación cruda (salida del modelo, intento fallido o registro de saltada), auditable junto a `ai_generations`.
- Sin cola durable, una evaluación interrumpida depende de que alguien vuelva a los resultados (el sondeo o "Reintentar" la reprograman); el plazo del reclamo evita dos corridas sobre la misma respuesta.
- El tope de 60 evaluaciones protege la cuota gratuita compartida por unos 20 usuarios diarios; al llegar a él el estudiante ve evaluaciones fallidas reintentables, no una sesión bloqueada.
- Volver a pulsar "Generar" ya no gasta generaciones ni produce ítems repetidos sobre el mismo texto; a cambio, cada técnica guarda una fila por párrafo usado.
- Cada técnica tiene una sola entrada de práctica en la página (su fila en "Generado en esta página"), lo que simplifica el panel pero deja el flujo entre hubs, resultados y sesiones para la revisión de la Fase 8.

### Pendientes

Observaciones de las revisiones y del usuario, no bloqueantes:

- Ante un error de lectura que no se cura, el aviso de resultados sigue ofreciendo "Reintentar", que no puede ayudar (copia aceptada por el usuario; se revisa en la Fase 8).
- La prueba de base de datos "across batches" de `drizzle-studied-page-reader` agota su tiempo de 5 s con una base compartida que crece (falla también en `main`); hay que subir su tiempo de espera.
- En una página generada antes de la fase, flashcards puede repetir tarjetas una sola vez.
- El final de un párrafo más largo que el tope de tokens nunca se envía a la IA.
- Los mensajes de error de generación de exámenes están duplicados entre el panel de técnicas y el diálogo "Crear examen".
- La documentación técnica (SRS, SAD, DATA-API, ADR) todavía no refleja las Fases 3 a 5; se actualizará en una tarea aparte.
- Acelerar la integración continua queda planeado para después de la Fase 8.
- La vista "Hoy" completa, con las tres técnicas, llega en la Fase 7.
- Los resultados de sesiones de recordación anteriores a la más reciente no tienen entrada en la interfaz (la ruta existe); se resuelve en la Fase 8.

## Alternativas descartadas

- **Evaluar en línea antes de cerrar la sesión**: el estudiante esperaría a la IA y un proveedor caído bloquearía el cierre; contradice §8.5.
- **Cola de trabajos durable (Trigger.dev u otra)**: ADR 0003 la retiró; `after()` con reclamo, plazo y sondeo cubre la recuperación sin servicio extra.
- **Puntaje por defecto ante una evaluación fallida**: inventaría una nota y movería SM-2 sin evidencia; contradice §8.1.
- **Llamar al modelo para una respuesta saltada**: gasta cuota para obtener un 0 seguro.
- **Compartir el contador de generaciones**: 6 generaciones al día se agotarían con una sola sesión de 10 respuestas.
- **Resumen de IA de la sesión de recordación**: repite las justificaciones por pregunta y gasta cuota.
- **Selector de tamaño de sesión**: la interfaz congelada no lo tiene; 10 preguntas coinciden con el valor por defecto de §3.3.
- **Volver a enviar la página completa en cada "Generar"**: duplica ítems y gasta generaciones sobre texto ya estudiado.
- **Botón "Practicar" dentro de cada tarjeta de técnica**: rechazado por el usuario; la práctica entra por la lista de lo generado.
- **Listar en el hub de exámenes todas las páginas, también las que no tienen preguntas**: rechazado por el usuario a favor de "Crear examen".
