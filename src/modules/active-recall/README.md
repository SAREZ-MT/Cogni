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
  igual responde con éxito y el fallo se reporta a Sentry.
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
- Panel "Técnicas de estudio": "Generar" conectado desde la tarea T4; desde
  T5b, la fila "Recordación activa" de "Generado en esta página" abre la
  sesión (`/active-recall/{notebookId}/{pageId}`).

Pendiente: evaluación con IA (T6) y el hub y la vista de cuaderno sobre
datos reales (T7).

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos) para las dependencias
permitidas de este módulo.
