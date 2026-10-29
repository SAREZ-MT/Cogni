# Módulo `active-recall`

## Responsabilidad

Preguntas abiertas, sesiones y evaluación combinada.

## Estado

Fase 6 completa (Recordación activa, `docs/documento-maestro.md` §13, versión
1.5.0). Decisiones en
`docs/adr/0007-recordacion-activa-y-generacion-incremental.md`; registro de
la construcción en `odd/tasks/phase-6-active-recall.md`.

Implementado:

- `domain/`: entidades `RecallQuestion`, `RecallSession` y `RecallAnswer`
  (§6.1) y funciones puras: calidad combinada y señal de calibración (§7.4),
  registro auditable de una respuesta saltada, estado de evaluación de la
  sesión, composición de la sesión (vencidas primero, luego nuevas y,
  para completar 10, las repasadas hace más tiempo),
  selección léxica del fragmento de página más relevante (§8.5) y puntaje
  por sesión.

- Persistencia: tablas `recall_questions`, `recall_sessions` y
  `recall_answers` (migración `0012`) con repositorios Drizzle y en memoria.
- `application/request-recall-generation.ts`: generación con IA de 10
  preguntas abiertas con rúbrica por llamada (prompt
  `generate_recall_questions/v1`, §8.4). Consulta el límite diario con
  `peek` y lo consume con `check` solo después de guardar: una generación
  fallida no gasta la unidad. Guarda las preguntas y un
  `StudyItem(kind = "recall_question")` por pregunta en una sola unidad de
  trabajo. Si consumir la unidad falla después de guardar, la generación
  igual responde con éxito y el fallo se reporta a Sentry. Generación
  incremental (Fase 6 T5c): solo se envían los párrafos que recordación
  activa aún no usó en la página (nuevos o editados, por huella en
  `generation_fingerprints`, migración `0013`) y sus huellas se guardan con
  las preguntas; sin nada nuevo responde `RECALL_NO_NEW_CONTENT` sin llamar
  a la IA ni consumir unidad. Una página generada antes de T5c envía todos
  sus párrafos una vez. Contenido mínimo (Fase 8, H14, decisión del usuario
  del 2026-10-29, `generation-capacity.ts` del kernel): los párrafos nuevos
  necesitan 100 palabras y unas 15 por pregunta, es decir 150 para las 10;
  si no, responde `AI_PAGE_TOO_SHORT` (`words`, `minWords`, `maxItems`,
  también en el error de la acción) antes de consultar el límite. Solo se
  guardan las huellas de la parte de los párrafos enviados que cubren las
  preguntas guardadas (`consumedParagraphs`).
- Sesión (`application/`): `planRecallSession` (lectura de la ruta, no
  escribe), `startRecallSession` (hasta 10 preguntas: vencidas, nuevas y
  las repasadas hace más tiempo; `RECALL_NO_QUESTIONS` si la página no
  tiene preguntas), `saveRecallAnswer` (una respuesta por pregunta, se
  guarda al darla; "Saltar" o texto vacío se guardan como
  `(sin respuesta)`; la pregunta debe ser de la página de la sesión) y
  `finishRecallSession` ("Terminar": solo las respuestas dadas; idempotente;
  la sesión queda `pending` para la evaluación asíncrona, o `done` si no
  tiene respuestas). Guardar y terminar se serializan con el bloqueo de la
  fila de la sesión.
- `actions.ts`: `generateRecallQuestionsAction`; `session-actions.ts`:
  `getRecallSessionPlanAction`, `getRecallPageSummaryAction` (cantidad de
  preguntas activas de la página, para la fila del panel),
  `startRecallSessionAction`, `saveRecallAnswerAction` y
  `finishRecallSessionAction`. Ninguna lanza: responden `{ code, message }`
  (y `resetAt` en el límite diario).
- Evaluación asíncrona (T6, §8.5, CU-09): `finishRecallSessionAction`
  programa `evaluateRecallSession` con `after()` (la página de la sesión
  declara `maxDuration = 300`, ADR 0003); cerrar nunca espera a la IA.
  `evaluateRecallSession` reclama las respuestas pendientes (un reclamo de
  más de 6 minutos se retoma), y por cada una: saltada → registro
  `skipped`, puntaje IA 0, sin modelo ni unidad; escrita → una llamada
  `evaluate_recall_answer/v1` con la rúbrica y el fragmento de la página más
  parecido a la pregunta (`selectRelevantFragment`, recortado a
  `AI_PAGE_TOKEN_CAP`), se guarda la salida cruda, el puntaje IA y la
  calidad combinada (`done`); si fallan todos los proveedores se guarda el
  intento fallido `{ source: "failed", code, generationId }` (`failed`: sin
  calidad combinada, sin repaso SM-2, la pregunta sigue vencida). Límite
  `AI_DAILY_EVALUATIONS` (60 respuestas evaluadas por el modelo al día): se
  consulta antes de la llamada y se consume solo tras una evaluación
  `done`; **si se alcanzó, la respuesta queda `failed`** con
  `code: AI_DAILY_LIMIT_REACHED` y `resetAt` (nunca queda pendiente, así la
  sesión termina `partial` y "Reintentar" la evalúa cuando se renueve la
  ventana). Después registra los repasos SM-2 de las respuestas `done`
  (calidad = combinada; seguro de repetir) y guarda el estado de la sesión
  (`sessionEvaluationStatus`). Idempotente.
- `evaluation-actions.ts`: `getRecallSessionResultsAction` (sondeo de
  resultados: estado, puntajes, justificación y conceptos, promedio
  combinado y calibración; si la sesión terminada sigue `pending` programa
  otra corrida, que se detiene si otra corrida viva tiene los reclamos),
  `retryRecallEvaluationAction` ("Reintentar": vuelve a `pending` las
  fallidas y programa la evaluación) y `disagreeRecallAnswerAction` ("No
  estoy de acuerdo": `disagreed = true`, nunca cambia el puntaje).
- Panel "Técnicas de estudio": "Generar" conectado desde la tarea T4; desde
  T5b, la fila "Recordación activa" de "Generado en esta página" abre la
  sesión (`/active-recall/{notebookId}/{pageId}`).

- Hub y vista de cuaderno (T7, §3.3): `listRecallHub` lista las páginas
  del dueño con al menos una sesión terminada con respuestas (puerto
  `RecallHubReader`, `DrizzleRecallHubReader`: una sola lectura, sin
  páginas ni cuadernos archivados, sin sesiones abiertas), sus sesiones de
  la más reciente a la más antigua con fecha, cantidad de preguntas,
  aciertos/parciales/fallos según `ai_score` (≥ 4 / 2–3 / ≤ 1) y
  porcentaje (promedio de la calidad combinada × 20, `sessionScore`); el
  dominio de cada página y el promedio del hub vienen del dominio de página
  de `study-engine` (`createPageMasteryReader`, nunca una fórmula local; una
  página sin fila cuenta 0) y las preguntas vencidas hoy, de sus ítems de
  estudio vencidos (`createStudyItemRepository().listDue` con el inicio del
  día local siguiente del perfil: los repasos vencen por día, decisión
  2026-10-18; la composición de la sesión y el registro SM-2 de la
  evaluación usan el mismo límite, `getCurrentDueCutoff`). Si el dominio o
  los vencimientos no se pueden leer quedan desconocidos (`null`) y el
  error va a Sentry. `getRecallSessionReview` reconstruye una sesión
  terminada (pregunta, respuesta y autoevaluación en el orden en que se
  respondió) para volver a abrir sus resultados; una sesión ajena, abierta
  o de otra página es `RECALL_SESSION_NOT_FOUND`.
- `hub-actions.ts`: `listRecallHubAction` y `getRecallSessionReviewAction`.
- Centro plano (Fase 8, H17, 2026-10-29): `RecallHubPage` suma
  `questionCount` (preguntas activas) y `latestQuestionAt` (creación de la
  más nueva), como subconsultas correlacionadas de la misma lectura de
  páginas. `/active-recall` muestra una tarjeta por página (preguntas,
  sesiones, dominio, vencidas hoy), filtra por `?cuaderno=` en el servidor
  y ordena lo vencido, luego lo nunca practicado, luego lo más reciente; la
  vista por cuaderno redirige al centro filtrado y ya no hay promedio de
  dominio en pantalla.
- Página de edición (Fase 8, H18, 2026-10-29): "la creación nace con IA; la
  edición permite ajustar y añadir". `editRecallQuestion` reescribe en su
  lugar el enunciado y la rúbrica (conceptos clave y respuesta esperada),
  con las mismas reglas que una pregunta nueva; `createRecallQuestion`
  añade una pregunta `manual` con su ítem de estudio; `deleteRecallQuestion`
  la borra de verdad: la fila, sus respuestas (`ON DELETE CASCADE`), su
  ítem de estudio (`RecallStudyItems.deleteBySource`, que el adaptador
  Drizzle añade al repositorio de study-engine) y, en cascada, su historial
  de repasos, así las métricas no la cuentan. La página conserva al menos
  una pregunta (`RECALL_LAST_QUESTION`). `applyRecallEdits` aplica el
  borrador de "Guardar" (`updates`, `creates`, `deletes`) en UNA unidad de
  trabajo a través de esos tres casos de uso; cualquier rechazo deshace
  todo. Acciones: `listRecallQuestionsAction` y `saveRecallEditsAction`
  (`actions.ts`, revalida `/active-recall`). Las sesiones no dependen de lo
  vencido (siempre componen preguntas), así que la recordación no tiene
  estado "al día".

## Pendientes

Ver la sección "Pendientes" de ADR 0007. Los que tocan este módulo: ante un
error de lectura que no se cura, el aviso de resultados sigue ofreciendo
"Reintentar"; los resultados de sesiones anteriores a la más reciente no
tienen entrada en la interfaz (la ruta `/resultados?sesion={id}` existe;
Fase 8); el final de un párrafo más largo que `AI_PAGE_TOKEN_CAP` nunca se
envía a la IA.

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos) para las dependencias
permitidas de este módulo.
