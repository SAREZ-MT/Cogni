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

## Dominio (`domain/`)

| Archivo | Contenido |
|---|---|
| `due-today.ts` | `DueTodayPage` (página, cuaderno, ítems vencidos por técnica y `earliestDueAt`), `DUE_KINDS`/`DueCounts` (espejo de `StudyItemKind`, verificado en compilación por `application/list-due-today.ts`), `emptyDueCounts()` y `compareDueTodayPages` (el vencimiento más antiguo primero; desempata el id de página). |
| `due-today-reader.ts` | Puerto `DueTodayReader.listDueToday(ownerId, now)`: páginas del dueño con ítems no suspendidos y `due_at <= now`, sin páginas ni cuadernos archivados. |
| `errors.ts` | Códigos `SCHEDULING_ERROR`. |

## Aplicación (`application/`)

- `listDueToday(ownerId, { reader, clock })`: lee la lista con el `now` del reloj inyectado.
- `testing/`: contrato compartido del lector y fake en memoria (`InMemoryDueTodayReader`, exportado en `testing.ts`).

## Infraestructura

`DrizzleDueTodayReader`: una consulta agrupada sobre `study_items` unida a
`pages` y `notebooks`, con conteos por técnica (`count(*) filter`) y
`min(due_at)`. El contrato corre contra Postgres en `tests/db`.

## API pública (`index.ts`)

| Exportación | Para quién | Contrato |
|---|---|---|
| `listDueTodayAction()` | Interfaz (Server Action) | Sesión primero, nunca lanza. La ruta `/flashcards` muestra "Repasos de hoy" y los conteos de vencidas de cada mazo. |
| `createSchedulingServerApi({ db, clock? })` | Otros módulos en el servidor | Devuelve `SchedulingServerApi.listDueToday(ownerId)`: la misma lectura que la acción (páginas del dueño con ítems vencidos ahora, la que más esperó primero), con el reloj del sistema por defecto. No es una Server Action: el llamador ya autenticó al dueño. `db` puede ser una transacción abierta. La usa `exams` (`hub-actions.ts`) para `due.exam_question`. |
| Dominio | Todos | `DueTodayPage`, `DueCounts`, `DUE_KINDS`, `emptyDueCounts`, `compareDueTodayPages`. |

`server-api.test.ts` prueba que la fábrica consulta al lector con el dueño
pedido y el `now` del reloj inyectado.

## Dependencias

`study-engine` (solo el tipo `StudyItemKind`) e `identity` (sesión).
