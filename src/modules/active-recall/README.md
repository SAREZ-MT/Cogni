# Módulo `active-recall`

## Responsabilidad

Preguntas abiertas, sesiones y evaluación combinada.

## Estado

En construcción (Fase 6 — Recordación activa, ver `docs/documento-maestro.md` §13).

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
  sus párrafos una vez.
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

Pendiente: el hub y la vista de cuaderno sobre datos reales (T7).

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos) para las dependencias
permitidas de este módulo.
