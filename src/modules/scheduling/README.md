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

## Dominio (`domain/`)

| Archivo | Contenido |
|---|---|
| `due-today.ts` | `DueTodayPage` (página, cuaderno, ítems vencidos por técnica y `earliestDueAt`), `DUE_KINDS`/`DueCounts` (espejo de `StudyItemKind`, verificado en compilación por `application/list-due-today.ts`), `emptyDueCounts()`, `compareDueTodayPages` (el vencimiento más antiguo primero; desempata el id de página) y `totalDueCount` (total de ítems vencidos de la lista, para el inicio). |
| `due-today-reader.ts` | Puerto `DueTodayReader.listDueToday(ownerId, now)`: páginas del dueño con ítems no suspendidos y `due_at <= now`, sin páginas ni cuadernos archivados. |
| `calendar.ts` | Calendario (Fase 7): `DayKey` ("YYYY-MM-DD"), aritmética de días en medianoches UTC (`addDays`, `weekdayIndex`, `weekDays`, `monthOf`, `monthGridDays` con semanas de lunes a domingo), `dayKeyIn` (día local en una zona), `paddedRange` (ventana ±14 h) y `groupCalendarDays` (agrupa por día local y página; lo vencido cuenta en hoy). |
| `due-in-range-reader.ts` | Puerto `DueInRangeReader.listDueInRange(ownerId, from, to)`: ítems no suspendidos con `from <= due_at < to`, sin páginas ni cuadernos archivados, sin agrupar; y `listOverdueCounts(ownerId, before)`: los ítems con `due_at < before` contados por página y técnica (todos van a hoy, así la lectura está acotada por páginas × técnicas y no crece con el atraso), ordenados por el vencimiento más antiguo, el id de página y el nombre de la técnica en orden de bytes (`collate "C"` en SQL, el mismo orden de unidades de código que el fake en memoria, sin depender de la colación de la base). |
| `errors.ts` | Códigos `SCHEDULING_ERROR`. |

## Aplicación (`application/`)

- `listDueToday(ownerId, { reader, clock })`: lee la lista con el `now` del reloj inyectado.
- `listCalendarDays({ ownerId, fromDay, toDay, timeZone }, { reader, clock })`: páginas por día local de `[fromDay, toDay)`. Solo muestra el próximo `due_at` de cada ítem; si el rango contiene hoy también lee lo vencido y lo muestra en hoy; los días pasados quedan vacíos.
- `testing/`: contrato compartido del lector y fake en memoria (`InMemoryDueTodayReader`, exportado en `testing.ts`).

## Infraestructura

`DrizzleDueTodayReader`: una consulta agrupada sobre `study_items` unida a
`pages` y `notebooks`, con conteos por técnica (`count(*) filter`) y
`min(due_at)`. `DrizzleDueInRangeReader`: los ítems del rango sin agrupar
(índice `(owner_id, due_at)`) y los vencidos anteriores contados por página y
técnica en SQL. La zona horaria nunca llega a SQL. Los contratos corren contra
Postgres en `tests/db` (`drizzle-due-today-reader.contract.test.ts`,
`drizzle-due-in-range-reader.contract.test.ts`).

## API pública (`index.ts`)

| Exportación | Para quién | Contrato |
|---|---|---|
| `listCalendarDaysAction({ fromDay, toDay, timeZone })` | Interfaz (Server Action) | Sesión primero, nunca lanza. Valida días ISO, rango no vacío de hasta 42 días que contenga algún día de la ventana del calendario (1970-01-01 … 9998-12-31) y zona horaria (`SCHEDULING_INVALID_RANGE`). Usa siempre el reloj del sistema: nunca acepta un reloj del cliente. |
| `getCalendarDays({ fromDay, toDay, timeZone, now })` | Servidor (no es Server Action) | La misma lectura con el instante con que la página `/calendario` pinta su día de hoy, para que la celda de hoy y los vencidos acumulados en hoy coincidan. Vistas "Mes" y "Semana". |
| `listDueTodayAction()` | Interfaz (Server Action) | Sesión primero, nunca lanza. La usan la pestaña "Hoy" de `/calendario`, la tarjeta "Repasos pendientes hoy" del inicio y "Repasos de hoy" de `/flashcards` (solo flashcards, con los conteos de vencidas de cada mazo). |
| `createSchedulingServerApi({ db, clock? })` | Otros módulos en el servidor | Devuelve `SchedulingServerApi.listDueToday(ownerId)`: la misma lectura que la acción (páginas del dueño con ítems vencidos ahora, la que más esperó primero), con el reloj del sistema por defecto. No es una Server Action: el llamador ya autenticó al dueño. `db` puede ser una transacción abierta. La usa `exams` (`hub-actions.ts`) para `due.exam_question`. |
| Dominio | Todos | `DueTodayPage`, `DueCounts`, `DUE_KINDS`, `emptyDueCounts`, `compareDueTodayPages`, `totalDueCount` y el calendario de `domain/calendar.ts` (`DayKey`, `dayKeyIn`, `addDays`, `monthGridDays`, `weekDays`…; `groupCalendarDays` queda interno). |

`server-api.test.ts` prueba que la fábrica consulta al lector con el dueño
pedido y el `now` del reloj inyectado.

## Dependencias

`study-engine` (solo el tipo `StudyItemKind`) e `identity` (sesión).
