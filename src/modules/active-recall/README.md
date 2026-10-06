# Módulo `active-recall`

## Responsabilidad

Preguntas abiertas, sesiones y evaluación combinada.

## Estado

En construcción (Fase 6 — Recordación activa, ver `docs/documento-maestro.md` §13).

Implementado:

- `domain/`: entidades `RecallQuestion`, `RecallSession` y `RecallAnswer`
  (§6.1) y funciones puras: calidad combinada y señal de calibración (§7.4),
  registro auditable de una respuesta saltada, estado de evaluación de la
  sesión, composición de la sesión (vencidas primero, luego nuevas),
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
  trabajo.
- `actions.ts`: `generateRecallQuestionsAction` (nunca lanza; responde
  `{ code, message }` y `resetAt` cuando se alcanza el límite).

Pendiente: conectar "Generar" del panel de técnicas (requiere cambio de UI,
pendiente de aprobación), sesión, evaluación con IA y pantallas sobre datos
reales.

## Dependencias declaradas

Ver `docs/documento-maestro.md` §5.2 (mapa de módulos) para las dependencias
permitidas de este módulo.
