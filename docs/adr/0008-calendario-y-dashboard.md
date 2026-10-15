# ADR 0008 — Calendario y dashboard: decisiones de implementación de la Fase 7

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14 |
| Estado | Aceptado |
| Reemplaza | — (no reemplaza ninguna regla). Precisa §3.5, §3.6, §5.2, §6.1 (`Profile.timezone`), §7.4 y §13 (Fase 7) del documento maestro 1.5.0; recogido en la versión 1.6.0 |

## Contexto

La Fase 7 construye las dos vistas que responden "qué estudio hoy" y "cómo voy": el calendario (vista "Hoy", semana y mes) y el dashboard (progreso por cuaderno y página, métricas por técnica y calibración metacognitiva). Su criterio de "hecho" exige que el estudiante pueda responder ambas preguntas sin abrir ninguna página.

Antes de la fase, `/dashboard` funcionaba solo con datos de muestra locales a la ruta, detrás de `requireDesignPreviews()` (404 en producción); `src/modules/analytics` era un `export {}`; no existía ruta de calendario y la tarjeta "Repasos pendientes hoy" del inicio mostraba un 0 fijo. `scheduling` solo ofrecía `listDueToday`.

El documento maestro fija el qué, pero dejó abiertas cuestiones que aparecieron al implementarlo:

- De dónde sale la "tendencia" de una página si `page_mastery` guarda una sola fila por página, sin historial.
- Cómo se definen la tasa de acierto, la racha y los repasos completados en cada técnica.
- Qué muestra el calendario en los días futuros: solo el próximo vencimiento o una proyección de repasos posteriores.
- Qué técnicas alimentan la calibración metacognitiva.
- En qué zona horaria se cuentan los días ("hoy", la racha, las semanas).
- Qué números del diseño del dashboard (v2) no tienen fuente en §3.6 y cómo se resuelven.

La fase se construyó con ODD en seis tareas (T1, T2a, T2, T3, T4 y la de cierre T5) y cinco PR apiladas sobre `main` (#95–#99) más la de cierre; cada commit de trabajo pasó una revisión nativa de confiabilidad (cuatro lentes en T2a). Las decisiones de producto son del usuario (2026-10-12 a 2026-10-14). No hubo migraciones: todo se deriva de las tablas existentes.

## Decisión

### Calendario y "Hoy"

1. **"Hoy" es una pestaña de `/calendario` (decisión del usuario, 2026-10-12).** La ruta tiene las pestañas "Hoy", "Semana" y "Mes" (`?view=hoy|semana|mes`, `?date=AAAA-MM-DD`, en la URL para sobrevivir a una recarga). La barra lateral tiene una sola entrada, "Calendario" (antes "Horarios", deshabilitada). "Hoy" lista las páginas con ítems vencidos (`listDueTodayAction`), la que más esperó primero, con un chip por técnica que abre su sesión: flashcards `/flashcards/{cuaderno}/{página}?repasar=1`, recordación activa `/active-recall/{cuaderno}/{página}` y examen `/exams/{cuaderno}/{página}`. La tarjeta "Repasos pendientes hoy" del inicio muestra el total real (`totalDueCount`) y enlaza a `/calendario`; un fallo de esa lectura solo degrada la tarjeta.
2. **El calendario muestra solo el próximo vencimiento de cada ítem.** "Semana" y "Mes" agrupan por día local y página los ítems no suspendidos cuyo `due_at` cae en el día (`listDueInRange`, `listCalendarDays`), sin páginas ni cuadernos archivados. No se proyectan repeticiones posteriores: dependerían de calificaciones que aún no existen. Lo vencido se muestra en hoy (contado por página y técnica con `listOverdueCounts`, así la lectura no crece con el atraso) y los días pasados quedan vacíos (el historial vive en `review_logs`). Un rango tiene como máximo 42 días y debe tocar la ventana 1970-01-01 … 9998-12-31; fuera de ella la página vuelve a hoy.
3. **Sin eventos manuales (§3.5).** No hay botón "Añadir evento". Con datos vacíos el calendario se pinta vacío, sin eventos de muestra.
4. **Aspecto (decisión del usuario, 2026-10-12).** Sigue la captura de referencia de un calendario mensual de Untitled UI: título y pestañas, encabezado de tarjeta con la insignia de fecha, título del período, botones anterior / "Hoy" / siguiente y una cuadrícula de 7 columnas con chips de eventos y "N más…". Cada chip lleva el color de su técnica con la paleta pastel del panel de técnicas (Flashcards amarillo, Recordación activa verde, Examen rosa). Se construyó con átomos de `src/shared/ui` (`TechniqueChip`, `DateBadge`, `SegmentedTabs`, `CalendarGrid`, `CalendarDayCell`, `CalendarNav`), documentados en `ATOMS.md`.

### Zona horaria

5. **Los días se cuentan en la zona del perfil (decisión del usuario, 2026-10-12).** `profiles.timezone` (que antes siempre valía `UTC`) se elige en una página nueva y mínima, `/configuracion` (entrada "Configuración" de la barra lateral), con un selector agrupado por región. Sin migración, el literal `UTC` sigue siendo la marca de "nunca elegida" y una elección explícita de UTC se guarda como `Etc/UTC`. En el primer uso, el navegador detecta su zona y la guarda solo si el perfil sigue sin elegir (`UPDATE … WHERE timezone = 'UTC'`), así una elección explícita siempre gana. "Hoy", el calendario y el dashboard usan esa zona; la zona nunca llega a SQL: las lecturas usan una ventana de ±14 horas y agrupan en el dominio.

### Métricas del dashboard

6. **Tendencia desde `review_logs` (opción A, decisión del usuario, 2026-10-12).** La tendencia de una página o cuaderno es el promedio semanal de la calidad de sus repasos (0–5) en semanas locales de lunes a domingo, retroactivo y sin cambios de esquema. Mide "cómo me van los repasos", no el puntaje de dominio guardado. Se descartó guardar instantáneas de `page_mastery` (opción B). `analytics` la calcula (`weeklyQualityTrends`), pero el dashboard no la muestra (decisión 13).
7. **Tasa de acierto por técnica, en el período elegido (7, 15 o 30 días).** Flashcards: repasos con calidad ≥ 3 (todo menos "Otra vez"). Exámenes: respuestas con `is_correct` de exámenes terminados. Recordación activa: respuestas evaluadas (`done`) con `ai_score >= 3`. Sin resultados, la tasa es nula y no un 0. Cada métrica trae también el período anterior de la misma duración para su variación.
8. **Racha.** Días locales consecutivos con al menos una fila de `review_logs`, en total y por técnica. Hoy cuenta como abierto: una racha que llegó hasta ayer sigue viva mientras hoy no termine sin repasos. Para la racha se leen los pares distintos (técnica, tramo UTC de 15 minutos), así la lectura crece con el tiempo de estudio y no con la cantidad de repasos.
9. **Repasos completados.** Filas de `review_logs` por técnica en el período, la misma fuente que la racha. Nunca se muestra tiempo de estudio.
10. **Calibración solo con recordación activa.** Es la única técnica con autoevaluación y puntaje objetivo. Cada respuesta evaluada se clasifica con `calibrationOf` de `active-recall` (regla §7.4, ADR 0007: exceso de confianza `self ≥ 4 y ai ≤ 2`, falta de confianza `self ≤ 1 y ai ≥ 4`); la regla no se duplica. Se agrega por página (conteos por señal y promedios de autoevaluación y puntaje de IA) y se deriva en cada lectura, sin guardarse.
11. **`analytics` solo lee.** Tiene lectores Drizzle propios de solo lectura sobre `review_logs`, `study_items`, `page_mastery`, `exam_answers` y `recall_answers`, como `scheduling`, porque los casos de uso de las técnicas no ofrecen lecturas por dueño y rango. Nunca guarda una métrica ni calcula vencimientos o dominio: "vencidos" cuenta en vivo los `study_items` con `due_at <= now` para coincidir con "Hoy". Las lecturas omiten páginas y cuadernos archivados.

### Números del dashboard sin fuente en §3.6 (decisiones del usuario, 2026-10-13 y 2026-10-14)

12. **Sin sección de conceptos.** El diseño v2 tenía fortalezas y puntos débiles por concepto; §3.6 no tiene una fuente por concepto, así que la sección se quitó por ahora.
13. **Variaciones solo donde hay historial.**
    - "Racha de repasos" muestra la diferencia entre la racha actual y la racha tal como estaba 7 días antes (`overall.streakDaysWeekAgo`, calculada desde `review_logs`; ese día ancla también cuenta como abierto, igual que hoy).
    - "Ítems vencidos" y "Páginas dominadas" muestran solo el valor actual, sin pastilla de variación, con una pista de contexto ("en N páginas", "de N páginas"): no hay historial de vencimientos ni de dominio.
    - "Dominio global" (encabezado y tarjeta de dominio) muestra solo el porcentaje actual (promedio del dominio actual de las páginas), sin variación semanal.
    - El progreso por cuaderno oculta la flecha de variación semanal y no la sustituye con la tendencia de calidad de los repasos (decisión 6).
    - Las instantáneas semanales para tener ese historial quedan aplazadas.
14. **Etiqueta "Active recall".** El dashboard conserva "Active recall", igual que la barra lateral; unificar la etiqueta en toda la aplicación queda para la fase de diseño (Fase 8).
15. **Zona de calibración por página.** La tabla de calibración clasifica cada página por su señal §7.4 más frecuente entre sus respuestas (exceso, falta o calibrado). Un empate favorece la señal descalibrada, primero el exceso de confianza y luego la falta. Los promedios de autoevaluación y de IA siguen en sus columnas, y la diferencia se calcula de los promedios mostrados. Las páginas sin respuestas evaluadas no aparecen en la tabla.
16. **Estados del dashboard.** Sin progreso, repasos, racha ni respuestas evaluadas, la página muestra un estado vacío que lleva a los cuadernos; si alguna lectura falla, un aviso de error, nunca números inventados. Se quitaron los datos de muestra (`_data/sample.ts`) y la barrera de vista previa; "Dashboard" queda como enlace normal de la barra lateral.

## Consecuencias

- El estudiante ve qué estudiar hoy y en los próximos días desde el inicio, "Hoy" y el calendario, y cómo va desde el dashboard, sin abrir una página; ninguna ruta de producción usa datos de muestra.
- Todas las métricas se derivan en cada lectura de tablas que ya existían: no hay migraciones ni datos que mantener sincronizados, a cambio de no tener historial del dominio por página.
- Sin historial de dominio, el dashboard no muestra variaciones de "Dominio global", "Páginas dominadas" ni "Ítems vencidos", ni la tendencia por cuaderno.
- La calibración solo refleja recordación activa; flashcards y exámenes no aportan señal metacognitiva.
- Los días dependen de la zona del perfil: hasta que el detector del navegador guarde la zona o el estudiante la elija en "Configuración", se cuentan en UTC.

### Pendientes

Observaciones de las revisiones y del usuario, no bloqueantes:

- Instantáneas semanales de dominio y vencimientos (opción B) para mostrar variaciones de "Dominio global", "Páginas dominadas", "Ítems vencidos" y la tendencia por cuaderno.
- Unificar "Active recall" / "Recordación activa" en toda la aplicación (Fase 8).
- La barra lateral del shell no se pliega en teléfonos (Fase 8).
- Las pruebas de las acciones de `analytics` cubren entradas que no son objetos, pero no objetos con campos de tipo incorrecto o propiedades extra.
- El e2e del dashboard ya no comprueba el estado HTTP de `/dashboard?range=30`.
- Varias pruebas de base de datos agotan el tiempo de 5 s con la base compartida bajo carga; pasan con `--testTimeout=30000`.
- La documentación técnica de las Fases 3 a 5 sigue sin actualizar.

## Alternativas descartadas

- **Instantáneas de `page_mastery` (opción B)**: necesitan esquema y un trabajo programado, y no recuperan el pasado; la tendencia de calidad desde `review_logs` es retroactiva.
- **Proyectar repeticiones futuras en el calendario**: dependen de calificaciones que aún no existen; se mostraría una agenda que cambia en cuanto el estudiante repasa.
- **Vista "Hoy" como ruta y entrada de barra lateral propias**: el usuario eligió una pestaña de `/calendario` y una sola entrada en la barra lateral.
- **Eventos manuales y botón "Añadir evento" de la referencia**: contradicen §3.5.
- **Calibración con flashcards o exámenes**: no tienen autoevaluación y puntaje objetivo de la misma respuesta.
- **Zona de calibración por promedios de la página**: dos respuestas opuestas se compensarían y la página parecería calibrada; se usa la señal por respuesta.
- **Variaciones inventadas o con la tendencia de calidad en lugar del dominio**: mezclarían dos medidas distintas bajo la misma etiqueta.
- **Contar los días en UTC o en la zona del servidor**: "hoy" y la racha cambiarían de día a mitad de la tarde para un estudiante en América.
