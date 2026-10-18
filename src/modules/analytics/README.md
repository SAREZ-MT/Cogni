# Módulo `analytics`

## Responsabilidad

Dashboard, métricas por técnica y calibración metacognitiva
(`docs/documento-maestro.md` §3.6). Solo lee: nunca escribe en tablas de
`study-engine` ni de las técnicas, y nunca guarda una métrica (todas se
derivan en cada lectura).

## Estado

Fase 7 (cerrada, ADR 0008): dominio, lectores, casos de uso, API de servidor
y acciones (T3); la ruta `/dashboard` lee sus datos de este módulo (T4), sin
datos de muestra ni barrera de vista previa.

Decisiones del usuario sobre el dashboard (2026-10-13 y 2026-10-14, ver ADR
0008): sin sección de conceptos; solo "Racha de repasos" muestra variación
(contra `overall.streakDaysWeekAgo`); "Ítems vencidos", "Páginas dominadas" y
"Dominio global" muestran solo el valor actual; la tendencia semanal se
calcula aquí pero el dashboard no la muestra (la ruta pide 1 semana); la zona
de calibración de cada página es su señal más frecuente, con empates a favor
de la descalibrada (`calibrationZoneOf` en `src/app/(app)/dashboard/_lib`).

## Decisiones (feature `phase-7-calendar-dashboard`, 2026-10-12)

- **Tendencia (opción A):** promedio semanal de la calidad de los repasos de
  `review_logs` (0–5) por página y por cuaderno, en semanas locales de lunes
  a domingo. Mide "cómo me van los repasos", no el puntaje de dominio
  guardado; no hay historial de `page_mastery`. Una semana sin repasos tiene
  promedio `null`.
- **Racha:** días locales consecutivos (zona del perfil) con al menos una
  fila de `review_logs`, en total y por técnica. Hoy cuenta como abierto: una
  racha que llegó hasta ayer sigue viva mientras hoy no termine sin repasos.
  Las métricas traen también la racha general tal como estaba 7 días antes
  de hoy (`overall.streakDaysWeekAgo`, solo cuentan los días hasta ese día),
  para el delta de "Racha de repasos" del dashboard. Ese día ancla también
  cuenta como abierto, igual que hoy: una racha que llegó hasta el día
  anterior al ancla sigue contando. El delta compara "ahora" con "el mismo
  momento hace una semana", cuando ese día tampoco había terminado, así la
  gracia es simétrica con la racha de hoy.
- **Tasa de acierto (en el período):** flashcards = repasos con calidad ≥ 3
  (no "Otra vez"); exámenes = respuestas con `is_correct` de exámenes
  terminados; recordación activa = respuestas evaluadas (`done`) con
  `ai_score >= 3`.
- **Repasos completados:** filas de `review_logs` por técnica en el período
  (la misma fuente que la racha). Nunca hay métrica de tiempo de estudio.
- **Calibración:** solo recordación activa (única técnica con autoevaluación
  y puntaje objetivo). Cada respuesta evaluada se clasifica con
  `calibrationOf` de `active-recall` (regla §7.4, ADR 0007: exceso de
  confianza `self ≥ 4 y ai ≤ 2`, falta de confianza `self ≤ 1 y ai ≥ 4`) y
  se agrega por página. No se duplica la regla.
- **Comparación:** las métricas por técnica traen también el período anterior
  de la misma duración ("vs. la semana anterior").
- Todas las lecturas omiten páginas archivadas y páginas de cuadernos
  archivados, como el calendario.

## Dominio (`domain/`)

| Archivo | Contenido |
|---|---|
| `local-day.ts` | `DayKey` ("YYYY-MM-DD"), aritmética de días en medianoches UTC (`addDays`, `weekStartOf`, `daysBetween`), `dayKeyFormatter` (día local en una zona), `paddedWindow` (ventana ±14 h), `isTimeZone` e `isAnalyticsRange` (rango no vacío, con tope de días, dentro de 1970-01-01 … 9998-12-31). Copia mínima de las reglas de `scheduling`: el dominio no importa otros módulos (§5.3). |
| `technique.ts` | `ANALYTICS_TECHNIQUES` (`flashcards`, `recall`, `exam`, en el orden del panel; espejo de `SessionKind` verificado en compilación) y `TechniqueCounts`. |
| `review-activity.ts` | `ReviewFact`, `trendWeekStarts`, `weeklyQualityTrends` (promedio semanal por clave), `emptyTrend`, `dailyReviews` (repasos por día local y técnica) y `countReviews`. |
| `streak.ts` | `ReviewBucket`, `reviewDays` (días locales con repasos, en total y por técnica) y `currentStreak`. |
| `accuracy.ts` | `AccuracyTally`, `accuracyRate` (`null` sin resultados) y la tasa de cada técnica con sus umbrales (`FLASHCARD_HIT_QUALITY`, `RECALL_CORRECT_AI_SCORE`). |
| `calibration.ts` | `rollupCalibration`: conteos por señal y promedios de autoevaluación y puntaje de IA por página; primero las páginas con mayor proporción de respuestas descalibradas. |
| `progress.ts` | `buildProgress`: progreso por página (nivel, puntaje, ítems totales y vencidos, tendencia) y por cuaderno (sumas, promedio de puntaje de las páginas con ítems, tendencia). Una página sin fila de dominio cuenta como "Nuevo" con puntaje 0. |
| `periods.ts` | `previousRange` y `splitPeriods` (separa hechos del período y del anterior según su día local). |
| `readers.ts` | Puertos `ReviewHistoryReader`, `PageProgressReader` y `AnswerOutcomeReader`. |
| `errors.ts` | Códigos `ANALYTICS_ERROR`. |

## Aplicación (`application/`)

- `getProgress({ ownerId, timeZone, weeks }, { pages, reviews, clock })`: progreso por cuaderno y página con tendencias de `weeks` semanas que terminan en la semana de hoy.
- `getTechniqueMetrics({ ownerId, fromDay, toDay, timeZone }, { reviews, answers, clock })`: por técnica, repasos completados, tasa de acierto (del período y del anterior) y racha; además repasos por día del período y totales (con la racha general de hoy y la de hace 7 días).
- `getCalibration({ ownerId, fromDay, toDay, timeZone }, { answers })`: calibración por página de las respuestas evaluadas del período.
- `testing/`: contrato compartido de los tres lectores, fake en memoria (`InMemoryAnalyticsStore`, exportado en `testing.ts`) y `seededStore` para las pruebas.

## Infraestructura

Lectores Drizzle propios del módulo, de solo lectura, como los de
`scheduling`: `analytics` lee las tablas de `study-engine` y de las técnicas
(§5.2, "técnicas (solo lectura)") sin pasar por sus casos de uso, que no
ofrecen lecturas por dueño y rango.

- `DrizzleReviewHistoryReader`: `review_logs` por dueño y rango (índice `(owner_id, reviewed_at)`), unido por el ítem a su página y cuaderno; y los pares distintos (técnica, tramo UTC de 15 minutos) de todo el historial para la racha. Todas las zonas en uso tienen desfases múltiplos de 15 minutos, así un tramo nunca cruza dos días locales y la lectura crece con el tiempo de estudio, no con la cantidad de repasos. La zona horaria nunca llega a SQL.
- `DrizzlePageProgressReader`: una consulta agrupada con cada página viva, su cuaderno, su fila de `page_mastery` (nivel y puntaje) y los conteos vivos de `study_items` (no suspendidos, y vencidos con `due_at < dueBefore`, el inicio del día local siguiente que `getProgress` calcula con `startOfTomorrowIn` en la zona del perfil: los repasos vencen por día), para que "vencidos" coincida con "Hoy" del calendario y con el inicio entre recálculos del dominio.
- `DrizzleAnswerOutcomeReader`: `exam_answers` de exámenes terminados (por `answered_at`) y `recall_answers` evaluadas (por `created_at`), cada una con la página de su sesión.

El contrato corre contra Postgres en `tests/db/drizzle-analytics-readers.contract.test.ts`.

## API pública (`index.ts`)

| Exportación | Para quién | Contrato |
|---|---|---|
| `getDashboardProgress({ timeZone, weeks, now })` | Servidor (no es Server Action) | Progreso con el instante con que la página pinta, para que la semana actual coincida con la de la página. `weeks` entero de 1 a 26. |
| `getDashboardTechniqueMetrics({ fromDay, toDay, timeZone, now })` | Servidor (no es Server Action) | Métricas por técnica con el instante de la página (hoy, rachas). Rango no vacío de hasta 92 días. |
| `getDashboardCalibration({ fromDay, toDay, timeZone })` | Servidor (no es Server Action) | Calibración del rango. |
| `getHomeWeakTopics({ now })` | Servidor (no es Server Action) | Temas débiles del Inicio: hasta 5 páginas vivas con menos del 70 % de acierto (≥ 3 respuestas de examen terminado o de recordación evaluada en los últimos 30 días), la peor primero. |
| `getProgressAction`, `getTechniqueMetricsAction`, `getCalibrationAction` | Interfaz (Server Actions) | Las mismas lecturas con el reloj del sistema; nunca aceptan un reloj del cliente. |
| `createAnalyticsServerApi({ db, clock? })` | Otros módulos en el servidor | `getProgress`, `getTechniqueMetrics` y `getCalibration` para un dueño ya autenticado y un rango ya validado. |
| Dominio | Todos | Tipos y funciones puras de `domain/`. |

Todas las lecturas de sesión validan primero la sesión ("Debes iniciar
sesión para continuar."), luego la entrada ("El período o la zona horaria no
son válidos.") y nunca lanzan: un error inesperado se reporta a Sentry y
vuelve como "No pudimos cargar tus métricas. Inténtalo de nuevo."; los
errores de control de Next.js (`redirect`, `notFound`) se relanzan con
`unstable_rethrow`. La zona horaria viene del perfil (`profiles.timezone`),
igual que en el calendario: la página la lee y la pasa.

## Dependencias

`study-engine` (tipos `MasteryLevel` y `SessionKind`), `active-recall`
(`calibrationOf` y su tipo `Calibration`) e `identity` (sesión).
