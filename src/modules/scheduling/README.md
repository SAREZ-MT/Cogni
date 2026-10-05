# Módulo `scheduling`

## Responsabilidad

Calendario y vista "Hoy" (`docs/documento-maestro.md` §3.5). Solo lee las
fechas de vencimiento que escribe `study-engine` (§3.4); nunca calcula una.

## Estado

Fase 4, tarea T6: vista "Repasos de hoy". El calendario mensual y semanal
llega en la Fase 7.

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

`listDueTodayAction()` (Server Action: sesión primero, nunca lanza) y el
dominio. La ruta `/flashcards` muestra "Repasos de hoy" y los conteos de
vencidas de cada mazo.

## Dependencias

`study-engine` (solo el tipo `StudyItemKind`) e `identity` (sesión).
