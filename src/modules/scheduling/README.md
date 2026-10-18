# Módulo `scheduling`

## Responsabilidad

Calendario y vista "Hoy" (`docs/documento-maestro.md` §3.5). Solo lee las
fechas de vencimiento que escribe `study-engine` (§3.4); nunca calcula una.

## Estado

Fase 4 (cerrada, ADR 0005): vista "Repasos de hoy". Cada fila abre la página
del mazo con `?repasar=1`, que inicia el repaso en el mismo lugar; no hay
sesión multipágina en la interfaz. El calendario mensual y semanal y la vista
"Hoy" completa llegan en la Fase 7.

Fase 5 (cerrada, ADR 0006): `createSchedulingServerApi` expone la misma lista
a otros módulos; el hub de exámenes la usa para marcar las páginas con
preguntas vencidas hoy. "Repasos de hoy" en `/flashcards` sigue mostrando solo
flashcards.

Fase 7 (cerrada, ADR 0008): `/calendario` con las pestañas "Hoy", "Semana" y
"Mes". "Hoy" usa `listDueTodayAction` con un chip por técnica que abre su
sesión; la tarjeta "Repasos pendientes hoy" del inicio suma la misma lista
(`totalDueCount`). "Semana" y "Mes" usan `getCalendarDays` y muestran solo el
próximo vencimiento de cada ítem, con lo vencido en hoy. Los días se cuentan
en la zona horaria del perfil (`profiles.timezone`), que la página lee de
`identity` y pasa a la lectura.

Fase 8 (H2-T5g, decisión del usuario 2026-10-18): los repasos vencen por día
local, no por hora. SM-2 programa días y la persona tiene todo el día para
repasar, así que un ítem está pendiente hoy mientras `due_at` sea anterior al
inicio del día siguiente en la zona del perfil (`startOfTomorrowIn`), aunque
venza más tarde hoy. El inicio, "Hoy", `/flashcards`, los hubs de recordación
y exámenes, el tablero y las sesiones de práctica usan ese mismo límite, así
que lo que el inicio cuenta como pendiente es lo que la sesión ofrece.

## Dominio (`domain/`)

| Archivo | Contenido |
|---|---|
| `due-today.ts` | `DueTodayPage` (página, cuaderno, ítems vencidos por técnica y `earliestDueAt`), `DUE_KINDS`/`DueCounts` (espejo de `StudyItemKind`, verificado en compilación por `application/list-due-today.ts`), `emptyDueCounts()`, `compareDueTodayPages` (el vencimiento más antiguo primero; desempata el id de página) y `totalDueCount` (total de ítems vencidos de la lista, para el inicio). |
| `due-today-reader.ts` | Puerto `DueTodayReader.listDueToday(ownerId, dueBefore, options?)`: páginas del dueño con ítems no suspendidos y `due_at < dueBefore` (el inicio del día local siguiente), sin páginas ni cuadernos archivados. Con `options.examsCompletedFrom` (H2-T6) deja fuera las preguntas de examen de las páginas con una sesión de examen terminada en `[examsCompletedFrom, dueBefore)`, y la página entera si no le queda nada pendiente. |
| `calendar.ts` | Calendario (Fase 7): `DayKey` ("YYYY-MM-DD"), aritmética de días en medianoches UTC (`addDays`, `weekdayIndex`, `weekDays`, `monthOf`, `monthGridDays` con semanas de lunes a domingo), `dayKeyIn` (día local en una zona), `startOfTomorrowIn(now, timeZone)` (inicio del día local siguiente: el límite de "vence hoy"), `paddedRange` (ventana ±14 h) y `groupCalendarDays` (agrupa por día local y página; lo vencido cuenta en hoy). |
| `due-in-range-reader.ts` | Puerto `DueInRangeReader.listDueInRange(ownerId, from, to)`: ítems no suspendidos con `from <= due_at < to`, sin páginas ni cuadernos archivados, sin agrupar; y `listOverdueCounts(ownerId, before)`: los ítems con `due_at < before` contados por página y técnica (todos van a hoy, así la lectura está acotada por páginas × técnicas y no crece con el atraso), ordenados por el vencimiento más antiguo, el id de página y el nombre de la técnica en orden de bytes (`collate "C"` en SQL, el mismo orden de unidades de código que el fake en memoria, sin depender de la colación de la base). |
| `technique-overview.ts` | Tarjetas por técnica del inicio (Fase 8 H2-T5f, H2-T5i): `TechniqueOverview` (por técnica, `total` de ítems vivos, `nextDueAt` —el próximo vencimiento desde mañana o `null`— y las unidades de estudio de hoy `pendingUnits`/`doneUnits`), `emptyTechniqueOverview()`, la lectura cruda `TechniqueSnapshot` (por técnica, `duePageIds`, `reviewedPageIds` y `completedPageIds` —solo exámenes: páginas con una sesión de examen terminada hoy—), `emptyTechniqueSnapshot()`, `REVIEW_SESSION_KIND` (técnica → `review_logs.session_kind`) y `toTechniqueOverview(snapshot)`. Una unidad es una página × técnica (la misma unidad que una fila de "Para repasar hoy"): pendiente = página con algún ítem de la técnica que vence hoy; hecha = página repasada hoy en esa técnica sin nada de ella pendiente hoy (una página repasada a medias cuenta solo como pendiente). En exámenes, una página con una sesión terminada hoy cuenta como hecha y nunca como pendiente, aunque le queden preguntas que vencen hoy (decisión del usuario 2026-10-18, H2-T6: un examen sirve 10–30 preguntas). `calendar.ts` suma `startOfDayIn(day, timeZone)` (el primer instante del día local: medianoche, o la transición si un cambio de horario se salta la medianoche) y `startOfTodayIn(now, timeZone)`. |
| `technique-overview-reader.ts` | Puerto `TechniqueOverviewReader.readTechniqueSnapshot(ownerId, { reviewedFrom, dueBefore })`: por técnica, cuenta los ítems vivos del dueño (no suspendidos, sin páginas ni cuadernos archivados, sin filtro de `due_at`), toma el `min(due_at)` con `due_at >= dueBefore`, lista las páginas vivas distintas con algún ítem con `due_at < dueBefore` y las páginas vivas distintas con algún registro de repaso de esa técnica con `reviewedFrom <= reviewed_at < dueBefore`. |
| `errors.ts` | Códigos `SCHEDULING_ERROR`. |

## Aplicación (`application/`)

- `listDueToday({ ownerId, timeZone, hideExamsCompletedToday? }, { reader, clock })`: lee la lista con el límite `startOfTomorrowIn(now, timeZone)` del reloj inyectado: todo lo que vence durante el día local de hoy. Con `hideExamsCompletedToday` pide además `examsCompletedFrom = startOfTodayIn(now, timeZone)`.
- `listCalendarDays({ ownerId, fromDay, toDay, timeZone }, { reader, clock })`: páginas por día local de `[fromDay, toDay)`. Solo muestra el próximo `due_at` de cada ítem; si el rango contiene hoy también lee lo vencido y lo muestra en hoy; los días pasados quedan vacíos.
- `getTechniqueOverview({ ownerId, timeZone }, { reader, clock })`: calcula el día local del dueño (`startOfTodayIn` y `startOfTomorrowIn`), lee la instantánea por técnica con esos límites y la convierte en unidades de hoy (`toTechniqueOverview`). Los ítems que vencen más tarde hoy ya son pendientes (mismo límite que `listDueToday`), así que el próximo repaso siempre cae en un día posterior.
- `testing/`: contrato compartido del lector y fake en memoria (`InMemoryDueTodayReader`, exportado en `testing.ts`).

## Infraestructura

`DrizzleDueTodayReader`: una consulta agrupada sobre `study_items` unida a
`pages` y `notebooks`, con conteos por técnica (`count(*) filter`) y
`min(due_at)`. `DrizzleDueInRangeReader`: los ítems del rango sin agrupar
(índice `(owner_id, due_at)`) y los vencidos anteriores contados por página y
técnica en SQL. La zona horaria nunca llega a SQL. Los contratos corren contra
Postgres en `tests/db` (`drizzle-due-today-reader.contract.test.ts`,
`drizzle-due-in-range-reader.contract.test.ts`,
`drizzle-technique-overview-reader.contract.test.ts`).
`DrizzleTechniqueOverviewReader`: dos lecturas. Una agrupada por `kind` con
`count(*)`, `min(due_at) filter (where due_at >= límite)` y
`array_agg(distinct page_id::text) filter (where due_at < límite)`, con los
mismos filtros de ítems vivos que `DrizzleDueTodayReader`; y los pares
distintos (`session_kind`, página) de `review_logs` del dueño en el día
(índice `(owner_id, reviewed_at)`), unidos a `study_items`, `pages` y
`notebooks` sin archivar.

## API pública (`index.ts`)

| Exportación | Para quién | Contrato |
|---|---|---|
| `listCalendarDaysAction({ fromDay, toDay, timeZone })` | Interfaz (Server Action) | Sesión primero, nunca lanza. Valida días ISO, rango no vacío de hasta 42 días que contenga algún día de la ventana del calendario (1970-01-01 … 9998-12-31) y zona horaria (`SCHEDULING_INVALID_RANGE`). Usa siempre el reloj del sistema: nunca acepta un reloj del cliente. |
| `getCalendarDays({ fromDay, toDay, timeZone, now })` | Servidor (no es Server Action) | La misma lectura con el instante con que la página `/calendario` pinta su día de hoy, para que la celda de hoy y los vencidos acumulados en hoy coincidan. Vistas "Mes" y "Semana". |
| `getTechniqueOverviewAction()` | Interfaz (Server Action) | Sesión primero, nunca lanza. Sin entrada: lee la zona horaria del perfil en el servidor y usa siempre el reloj del sistema; nunca acepta zona ni reloj del cliente. |
| `getTechniqueOverview({ timeZone, now })` | Servidor (no es Server Action) | La misma lectura con el instante con que pinta el inicio; alimenta las tarjetas de progreso por técnica en unidades de estudio ("0 de 3 repasos hechos hoy", "Aún no generas", "Próximo repaso: mañana"). |
| `listDueTodayAction()` | Interfaz (Server Action) | Sesión primero, nunca lanza. Sin entrada: lee la zona del perfil en el servidor y usa el reloj del sistema (nunca acepta zona ni reloj del cliente). La usa "Repasos de hoy" de `/flashcards` (solo flashcards, con los conteos de vencidas de cada mazo). |
| `getDueToday({ timeZone, now })` | Servidor (no es Server Action) | La misma lectura con la zona y el instante con que pintan el inicio y la pestaña "Hoy" de `/calendario`, para que "hoy" coincida con el resto de la página. Oculta el examen de las páginas cuyo examen se terminó hoy (H2-T6), igual que las tarjetas por técnica. Valida la zona (`SCHEDULING_INVALID_RANGE`). |
| `getCurrentDueCutoff()` | Servidor (acciones de `flashcards`, `active-recall`, `exams`) | Lee la zona del perfil del usuario actual y devuelve `(now) => startOfTomorrowIn(now, zona)`, el límite de "vence hoy" de las sesiones de práctica (`DueCutoff` de `study-engine`). Se resuelve dentro de la petición, también antes de un trabajo diferido con `after()`. |
| `createSchedulingServerApi({ db, clock? })` | Otros módulos en el servidor | Devuelve `SchedulingServerApi.listDueToday(ownerId, { timeZone })`: la misma lectura que la acción (páginas del dueño con ítems que vencen hoy en esa zona, la que más esperó primero), con el reloj del sistema por defecto. No es una Server Action: el llamador ya autenticó al dueño y leyó su zona. `db` puede ser una transacción abierta. La usa `exams` (`hub-actions.ts`) para `due.exam_question`; no oculta los exámenes terminados hoy (el hub sigue mostrando las preguntas que vencen). |
| Dominio | Todos | `DueTodayPage`, `DueCounts`, `DUE_KINDS`, `emptyDueCounts`, `compareDueTodayPages`, `totalDueCount` y el calendario de `domain/calendar.ts` (`DayKey`, `dayKeyIn`, `addDays`, `monthGridDays`, `weekDays`…; `groupCalendarDays` queda interno). |

`server-api.test.ts` prueba que la fábrica consulta al lector con el dueño
pedido y el inicio del día siguiente del reloj inyectado en la zona dada.

## Dependencias

`study-engine` (solo el tipo `StudyItemKind`) e `identity` (sesión y zona
horaria del perfil).
