# Proposal: Fase 2 — Importación de PDF

**Fase 2** (documento maestro §13, líneas 596-599). **Hecho cuando**: un PDF de 30 páginas con capa de texto termina como página editable en menos de 60 segundos. Entregables según §13: subida a Storage, `ImportJob`, tarea Trigger.dev con `unpdf`, conversión de texto a bloques (títulos por heurística, párrafos, listas), estado de progreso en UI, manejo de PDF sin texto.

Change: `phase-2-pdf-import` · Store: hybrid (este archivo + Engram `sdd/phase-2-pdf-import/proposal`) · Date: 2026-09-22 · Insumos: `exploration.md` (Engram #234), decisiones de producto (Engram #240), `docs/documento-maestro.md` (§4.2, §5.2, §5.3, §5.4, §6.1, §8.1, §10.3, §13), specs canónicas en `openspec/specs/`, propuesta archivada de la Fase 1.

## Intent

La Fase 1 dejó a Cogni como una herramienta de toma de notas: cuadernos, páginas, editor de bloques y `plain_text` materializado. Sin embargo, buena parte del material de estudio de un estudiante ya existe como PDF (guías, presentaciones exportadas, apuntes de otros). Hoy la única forma de meter ese material en Cogni es transcribirlo a mano. Este change abre la segunda puerta de entrada de contenido (§3.1): un PDF con capa de texto se convierte en una página editable, con `plain_text` listo para los consumidores de la Fase 3 en adelante (IA, flashcards, exámenes).

Es también el primer change que introduce trabajo en segundo plano. Establece el patrón que las fases 3 a 8 reutilizarán: Server Action delgada que encola, tarea de Trigger.dev que ejecuta, UI que consulta el estado. Hacerlo bien aquí (módulo `ingestion` hexagonal, `src/trigger/` delgado, deploy automatizado) evita repetir la decisión en cada fase posterior.

## Product decisions (cerradas, no reabrir)

| # | Decision | Effect on this change |
|---|---|---|
| 1 | Bucket dedicado `page-pdfs`: `allowed_mime_types` solo `application/pdf`, `file_size_limit` 20 MB, variable de entorno servidor propia (p. ej. `SUPABASE_PDF_BUCKET`), RLS por primer segmento de ruta = `auth.uid()` como `page-assets` | Migración nueva; `page-assets` no se toca; el pipeline de PDF es independiente del de imágenes |
| 2 | Progreso en UI por polling de TanStack Query sobre el estado del `ImportJob` a través de una Server Action delgada; sin Trigger.dev Realtime ni tokens de acceso público | Sin integración Realtime; una Server Action de consulta adicional; sin exponer credenciales de Trigger.dev al cliente |
| 3 | Un único punto de entrada "Importar PDF" en el menú del cuaderno del sidebar; crea la página y encola el job; sin entrada dentro del editor | Toca `notebooks.ui` (menú) y el shell; el editor no cambia |
| 4 | E2E: el spec de Playwright ejecuta una importación real contra el proyecto dev de Trigger.dev solo en `main.yml` (mismo patrón que Supabase `cogni-dev`); `pr.yml` conserva tests unitarios con fakes; sin capa de mock de Trigger.dev | Nuevos secretos de CI; `pr.yml` sin cambios de infraestructura |
| 5 | Heurística de encabezados fijada en la spec: línea corta (≤ 80 caracteres) sin puntuación final, con prefijo numerado (`1.`, `1.1`, romanos) o toda en mayúsculas → heading; el resto → párrafo; líneas que empiezan con `-`, `•`, `*` o `1)`/`1.` seguido de texto a nivel de lista → list item | La función pura de `ingestion.domain` se testea contra estas reglas; el nivel de heading (H1-H3) se deriva en la spec |
| 6 | PDF mixto: importación parcial; las páginas sin texto se omiten y se cuentan; el job termina `done` con aviso de cuántas páginas no tenían texto; `failed` solo cuando ninguna página tiene capa de texto (sin OCR, documento maestro líneas 34 y 89) | `ImportJob` necesita contar páginas omitidas; la UI muestra el aviso; sin OCR |

## Scope

### In Scope

- **Modelo de datos**: schema de Drizzle y migración versionada para `import_jobs` según §6.1 (`page_id`, `storage_path`, `file_name`, `status` queued/processing/done/failed, `page_count`, `error`, `trigger_run_id`, más `owner_id`, timestamps y un contador de páginas sin texto para la decisión 6); migración del bucket `page-pdfs` con RLS por propietario, siguiendo `0004_page_assets_storage.sql`.
- **Módulo `ingestion`** (hexagonal, siguiendo a `notebooks`): entidad `ImportJob` y sus transiciones de estado; función pura texto→`TiptapDoc` en `domain` que implementa la heurística de la decisión 5; puerto de descarga de Storage propio de `ingestion`; casos de uso de `application` para solicitar el permiso de subida, encolar la importación, procesar el job (invocado por la tarea) y consultar el estado; fakes en memoria; repositorio Drizzle de `ImportJob`; adaptador de Supabase Storage con descarga; Server Actions delgadas en `ui`.
- **Pipeline de subida**: permiso de subida firmado emitido por el servidor con alcance por propietario, subida directa desde el navegador a `page-pdfs`, revalidación server-side de `mime` y `sizeBytes` desde los metadatos reales del objeto antes de encolar (mismo patrón de tres capas que `page-assets`).
- **`src/trigger/`**: carpeta nueva con la primera tarea del proyecto (procesar PDF), delgada, que solo llama a `ingestion.application`; configuración de Trigger.dev v4 (`trigger.config.ts`).
- **Conversión**: `unpdf` `extractText` con `mergePages: false`; una entrada por página; páginas sin texto omitidas y contadas; persistencia del contenido y de `plain_text` a través de la API pública de `notebooks`; el job pasa a `done` o `failed`.
- **UI**: acción "Importar PDF" en el menú del cuaderno del sidebar; selector de archivo con validación en cliente (tipo y tamaño) como primera capa; indicador de progreso en la página creada por polling del `ImportJob`; aviso de páginas sin texto; mensaje de error amable cuando el job falla.
- **Observabilidad**: evento `pdf_imported` (§10.3) emitido cuando el `ImportJob` pasa a `done`, con `page_count` y páginas omitidas como propiedades.
- **Entorno y CI**: nuevas variables de entorno validadas con Zod; secretos de Trigger.dev en GitHub Actions y Vercel; paso de deploy de Trigger.dev en `main.yml` gated a `src/trigger/**`; job e2e de `main.yml` ejecutando la importación real.
- **Tests**: tests unitarios primero para todo `domain` y `application` (Strict TDD), con cobertura del 100 % en la función texto→bloques y en las transiciones del `ImportJob`; test de componente para el indicador de progreso; spec de Playwright que sube un PDF de prueba de 30 páginas, espera el estado `done` por polling y verifica que la página es editable; corrección del predicado de `clickAndWaitForAction` o mecanismo de espera propio.
- **Metodología**: `design.md` con diagrama de secuencia del flujo Server Action → Trigger.dev → `notebooks` (regla de design de `openspec/config.yaml`); specs canónicas actualizadas al archivar; ADR solo si cambia una decisión cerrada.

### Out of Scope

- OCR o cualquier procesamiento de PDF escaneados sin capa de texto (documento maestro líneas 34 y 89).
- Trigger.dev Realtime, tokens de acceso público o streaming de progreso.
- Otros formatos de entrada (DOCX, Markdown, HTML, EPUB, imágenes).
- Importar dentro de una página existente no vacía; el import siempre crea una página nueva.
- Re-importar, reemplazar o actualizar una página ya importada desde un PDF nuevo.
- Conservar imágenes, tablas o formato del PDF más allá de encabezados, párrafos y listas.
- Borrado físico del objeto en `page-pdfs` cuando la página se archiva (sigue siendo un job de limpieza futuro, §6.2).
- Alternativa Supabase Edge Functions + pg_cron (§4.2): queda documentada como contingencia, sin diseño.
- Otros jobs de Trigger.dev (generación por lotes, keep-alive migrado, cálculo de repasos) de fases posteriores.

## Capabilities

### New Capabilities

- `pdf-import`: bucket `page-pdfs` con RLS por propietario y límites (`application/pdf`, 20 MB); permiso de subida firmado y revalidación server-side; entidad `ImportJob` y su ciclo de vida (`queued` → `processing` → `done` | `failed`); tarea de Trigger.dev delgada; extracción con `unpdf` página por página; heurística texto→bloques (decisión 5); importación parcial y detección de PDF sin texto (decisión 6); punto de entrada en el sidebar; progreso por polling; evento `pdf_imported`.

### Modified Capabilities

- `notebooks`: la API pública de `notebooks/index.ts` expone lo necesario para que `ingestion` cree una página dentro de un cuaderno y persista un contenido inicial no vacío con `plain_text` materializado (nuevo caso de uso o extensión de `SavePage`; se decide en design). El escenario "Puntos de entrada mediante Server Actions validadas" no cambia.
- `design-tokens-and-shell`: "Sidebar con árbol de cuadernos y páginas" gana la acción "Importar PDF" en el menú del cuaderno y el estado visual de una página en importación.
- `observability-and-delivery`: "Entorno validado con Zod al arranque" gana las variables de Trigger.dev y del bucket de PDFs; "Pipeline en `main`" gana el paso de deploy de Trigger.dev gated a `src/trigger/**` y los secretos del e2e de importación; "Analítica con eventos explícitos" gana `pdf_imported`.
- `project-tooling`: "Esqueleto de los once módulos" se actualiza porque `ingestion` deja de estar vacío; "Estructura de carpetas de la sección 5.4" gana `src/trigger/`; nuevas reglas de dependency-cruiser (`@trigger.dev/sdk` solo en `infrastructure` y `src/trigger/`; `unpdf` solo en `ingestion/infrastructure`).

## Approach

Enfoque 1 de la exploración con la heurística en `ingestion.domain` (3a). Es la única combinación que el documento maestro exige de forma literal (§5.4, §8.1 regla 5) y la que más reutiliza de la Fase 1.

| Concern | Decision | Rationale |
|---|---|---|
| Encolar | Server Action delgada: valida entrada, revalida el objeto en Storage, crea la página vacía vía `notebooks`, crea el `ImportJob` en `queued` y llama a `tasks.trigger`; guarda `trigger_run_id` | §8.1 regla 5: las Server Actions solo encolan y consultan |
| Ejecutar | Una tarea de Trigger.dev v4 en `src/trigger/` que solo invoca `ProcessImportJob` de `ingestion.application`; el caso de uso descarga el PDF, extrae con `unpdf` (`mergePages: false`), convierte y persiste | §5.4: tareas delgadas; la lógica queda testeable sin la plataforma |
| Conversión | Función pura `string[] → TiptapDoc` en `ingestion.domain`, paralela a `extractPlainText`; sin imports de Tiptap ni ProseMirror | Strict TDD; mismo modelo que la Fase 1; cobertura 100 % |
| Persistencia del contenido | `ingestion` usa la API pública de `notebooks` para escribir el contenido y `plain_text`; nunca escribe en `pages` directamente | §5.2 (`ingestion` depende de `notebooks`) y §5.3 regla 5 |
| Descarga de Storage | `ingestion.domain` define su propio puerto de descarga; el adaptador vive en `ingestion.infrastructure`; `notebooks/index.ts` no se amplía más allá del write path | Evita ensanchar la superficie pública de `notebooks` para una necesidad de otro módulo; duplicación pequeña y explícita |
| Progreso | Server Action `getImportJobStatus` consultada con TanStack Query mientras el job no sea terminal; la página muestra un estado de importación y se recarga al pasar a `done` | Decisión 2; patrón de polling ya existente (autosave) |
| PDF sin texto | Páginas con texto extraído vacío o solo espacios se omiten y se cuentan; ninguna página con texto ⇒ `failed` con `error` legible | Decisión 6; `unpdf` no expone detección dedicada |
| Deploy | Paso en `main.yml` que ejecuta `trigger.dev deploy` cuando cambia `src/trigger/**` (o `trigger.config.ts`, `package.json`), con `TRIGGER_ACCESS_TOKEN` | Trigger.dev no tiene integración oficial con Vercel; sin este paso la tarea y la Server Action se desincronizan |

**Presupuesto de tiempo (supuestos a validar en apply, no hechos verificados)** para un PDF de 30 páginas con capa de texto, objetivo < 60 s: subida directa desde el navegador ≤ 10 s (depende del ancho de banda del usuario; fuera del control del servidor); Server Action de encolado ≤ 2 s; espera en cola + cold start de Trigger.dev free tier ≤ 15 s (sin evidencia primaria; es la variable más incierta); descarga del objeto ≤ 3 s; extracción con `unpdf` ≤ 10 s; conversión + persistencia ≤ 5 s; latencia del polling hasta reflejar `done` ≤ 5 s. Total estimado ≈ 50 s con ~10 s de margen. La tarea de apply que mide esto con un PDF real es obligatoria.

La entrega es auto-chain con alrededor de 400 líneas de autoría cambiadas por PR. Orden de slices recomendado (guía para `sdd-tasks`, que fija el corte final):

| Slice | Content | Exit condition |
|---|---|---|
| 1 | Dependencias (`@trigger.dev/sdk`, `unpdf`, CLI `trigger.dev`), variables de entorno, schema y migraciones de `import_jobs` y `page-pdfs`; entidad `ImportJob` y sus transiciones con tests | Migración aplicada en `cogni-dev`; suite unitaria en verde; sin UI |
| 2 | Función pura texto→bloques con tests contra la heurística de la decisión 5 y los casos de la decisión 6 | Cobertura 100 % sobre la función; sin I/O |
| 3 | Casos de uso de `application` (solicitar subida, encolar, procesar, consultar) con fakes; puerto de descarga; toque a la API pública de `notebooks` | Suite unitaria en verde; `ProcessImportJob` testeado sin Trigger.dev |
| 4 | Infraestructura: repositorio Drizzle, adaptador de Storage con descarga, `trigger.config.ts`, tarea en `src/trigger/`, Server Actions | Una importación completa funciona en local con `trigger.dev dev` |
| 5 | UI: acción en el menú del sidebar, selector de archivo, indicador de progreso por polling, aviso de páginas sin texto, evento `pdf_imported` | Un usuario importa un PDF en preview y ve la página editable |
| 6 | CI: paso de deploy de Trigger.dev en `main.yml`, secretos, spec de Playwright de importación real, corrección del predicado de espera; medición del presupuesto de 60 s | E2E en verde en `main`; medición registrada en `tasks.md` |
| 7 | Documentación: diagrama de secuencia, TSDoc en puertos y casos de uso, deltas de specs canónicas | `design.md` con diagrama; specs reconciliadas |

Los slices 4 y 5 tienen el mayor riesgo de superar el presupuesto; `sdd-tasks` puede subdividirlos.

## Constraints

- **Reglas de dependencia (§5.3, dependency-cruiser)**: `domain` solo importa `shared/kernel` y Zod; `application` nunca importa `infrastructure` ni `ui`; `@trigger.dev/sdk` y `unpdf` solo en `infrastructure` y `src/trigger/`; `ingestion` importa `notebooks` solo por `index.ts`.
- **Capas hexagonales** siguiendo a `notebooks`: entidades y puertos en `domain`, casos de uso que devuelven `Result<T, DomainError>` con parseo Zod en `application`, adaptadores en `infrastructure`, Server Actions en `ui`.
- **Autorización**: cada caso de uso recibe `ownerId` de la sesión y filtra por él; la tarea de Trigger.dev recibe solo el `importJobId` y recupera el `ownerId` del job persistido, nunca del payload; RLS activo en Storage.
- **Tier de costo cero**: Trigger.dev free (USD 5/mes, 20 ejecuciones concurrentes), Supabase Storage 1 GB; sin buffering de PDFs en Server Actions (límite de 1 MB de cuerpo); una sola ejecución por import.
- **Strict TDD**: cada unidad de `domain` y `application` empieza con su test de Vitest; Playwright para el criterio de aceptación.
- **Presupuesto de revisión**: ~400 líneas de autoría cambiadas por PR con auto-chain.
- **Convenciones**: código e identificadores en inglés, comentarios en inglés simple, UI en español con "tú", Conventional Commits sin atribución a IA; artefactos SDD en español neutro.
- **Versiones**: leer `node_modules/next/dist/docs/` antes de escribir Server Actions; las versiones de `@trigger.dev/sdk`, `trigger.dev` y `unpdf` se fijan en design tras consultar el registro.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/shared/db/schema.ts`, `drizzle/` | Modified / New | Tabla `import_jobs`; bucket `page-pdfs` con RLS y límites |
| `src/modules/ingestion/{domain,application,infrastructure,ui,index.ts}` | New | Entidad `ImportJob`, heurística texto→bloques, puerto de descarga, casos de uso, fakes, repositorio Drizzle, adaptador de Storage, Server Actions, componentes de importación y progreso |
| `src/modules/notebooks/{application,index.ts}` | Modified | Caso de uso o extensión para crear una página con contenido inicial y `plain_text`; exposición mínima en `index.ts` |
| `src/trigger/`, `trigger.config.ts` | New | Primera tarea de Trigger.dev (procesar PDF); configuración del proyecto |
| `src/app/(app)/` (sidebar, ruta de página) | Modified | Acción "Importar PDF" en el menú del cuaderno; estado de importación en la vista de página |
| `src/shared/config/env.schema.ts`, `env.server.ts` | Modified | `TRIGGER_SECRET_KEY`, `SUPABASE_PDF_BUCKET` (nombre exacto en design) |
| `package.json` | Modified | `@trigger.dev/sdk`, `unpdf`; `trigger.dev` como devDependency; scripts `trigger:dev` / `trigger:deploy` |
| `.github/workflows/main.yml` | Modified | Paso de deploy de Trigger.dev gated a `src/trigger/**`; secretos del e2e de importación |
| `.dependency-cruiser.cjs` | Modified | Reglas para `@trigger.dev/sdk`, `unpdf` y `src/trigger/` |
| `tests/e2e/`, `tests/e2e/fixtures/` | New / Modified | Spec de importación con un PDF de prueba de 30 páginas; acotar `clickAndWaitForAction` o mecanismo de espera propio |
| `src/shared/analytics` (o equivalente) | Modified | Evento `pdf_imported` |
| `docs/diagramas/`, `docs/adr/` | New | Diagrama de secuencia; ADR solo si cambia una decisión cerrada |
| `openspec/specs/pdf-import` y las cuatro specs modificadas | New / Modified | Se promueven al archivar |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| El presupuesto de 60 s no está medido; el cold start del free tier de Trigger.dev no tiene evidencia primaria | High | Tarea explícita de medición con un PDF real de 30 páginas en el slice 6; registrar el desglose; si supera 60 s, primero ajustar `machine` de la tarea o reducir trabajo por página, y solo como último recurso abrir un ADR |
| Crédito free tier de Trigger.dev (USD 5/mes) se consume con e2e en `main` y pruebas manuales | Med | El e2e corre solo en `main.yml`, no por PR; un PDF de prueba pequeño para el flujo y el de 30 páginas solo para la medición; vigilar el consumo en el dashboard (§10.3, 80 %) |
| Desincronización entre el deploy de Vercel y el de Trigger.dev (tarea vieja recibe payload nuevo o viceversa) | Med | Paso de deploy en `main.yml` en el mismo pipeline que dispara el deploy de Vercel; payload versionado y mínimo (`importJobId`); el job pasa a `failed` con error legible si la tarea no existe |
| La detección de "sin capa de texto" es una heurística (texto vacío o en blanco), no una API de `unpdf` | Med | Fijada en la spec con casos explícitos; tests unitarios con fixtures de texto vacío, espacios y mixto; el aviso al usuario indica cuántas páginas se omitieron |
| `clickAndWaitForAction` en `tests/e2e/fixtures/auth.ts` resuelve con cualquier POST 2xx y puede dar falsos positivos en el e2e de importación | High | El e2e espera por el estado `done` del `ImportJob` (polling en la UI o consulta directa), no por la respuesta de la Server Action; acotar el predicado como tarea del slice 6 |
| Ampliar `notebooks/index.ts` para `ingestion` ensancha su superficie pública | Low | Exponer solo el caso de uso de escritura necesario; el puerto de descarga vive en `ingestion`; revisar en design |
| Un PDF grande dentro del límite de 20 MB tarda o agota memoria en `unpdf` | Med | `maxDuration` explícito en la tarea; el job pasa a `failed` con error legible; medir con el PDF de 30 páginas |
| Nuevo bucket en `cogni-prod` requiere verificación manual del usuario (como `page-assets`) | Med | Documentar como tarea del usuario; la migración crea bucket y políticas, el usuario verifica en el dashboard antes del cierre |
| Ejecuciones concurrentes limitadas a 20 | Low | Una ejecución por import; sin fan-out por página |

## Rollback Plan

- **Migración `import_jobs`**: migración de reversión versionada (`drop table import_jobs`); ninguna otra tabla depende de ella. Probar la reversión en `cogni-dev` como parte del test de migración.
- **Bucket `page-pdfs`**: migración de reversión que elimina las políticas RLS y el bucket; los objetos se pierden (aceptable: el contenido ya vive en `pages.content`); `page-assets` no se ve afectado.
- **Variables de entorno**: si se revierte el change, eliminar `TRIGGER_SECRET_KEY` y `SUPABASE_PDF_BUCKET` de Vercel y CI; el schema Zod las hace opcionales solo en el PR de reversión para no romper el arranque.
- **CI y deploy de Trigger.dev**: el paso vive en un único PR (slice 6); revertirlo restaura `main.yml` a la línea base de la Fase 1; la tarea desplegada queda inactiva en Trigger.dev y puede archivarse desde el dashboard.
- **Superficie de producto**: `ingestion`, `src/trigger/` y la acción del sidebar son aditivos; revertir los PR de los slices 4 y 5 elimina la superficie sin afectar `notebooks`, `editor` ni `identity`.
- **Toque a `notebooks`**: el caso de uso nuevo o la extensión de `SavePage` es aditivo y reversible por sí solo; no cambia el comportamiento de los guardados del editor.
- Este change no toca autenticación ni la capa de IA.

## Dependencies

- **Usuario**: crear el proyecto en Trigger.dev (entorno dev y prod), obtener `TRIGGER_SECRET_KEY` por entorno y `TRIGGER_ACCESS_TOKEN` para el deploy; cargar los secretos en GitHub Actions (`main.yml`) y en Vercel (Production y Preview); verificar visualmente el bucket `page-pdfs` y sus políticas en `cogni-prod`; valores exactos y pasos de dashboard documentados en design y en `tasks.md`.
- **Paquetes npm**: `@trigger.dev/sdk` (v4), `unpdf`, `trigger.dev` (CLI, devDependency); versiones fijadas en design tras consultar el registro.
- **Infraestructura**: bucket `page-pdfs` en `cogni-dev` y `cogni-prod` creado por migración; conectividad real a Trigger.dev en local (`trigger.dev dev`) y en CI.
- **Fixture**: un PDF de prueba de 30 páginas con capa de texto y uno mixto (páginas con y sin texto), versionados en `tests/e2e/fixtures/`.
- Sin nuevos servicios pagos.

## Success Criteria

- [ ] En producción, un usuario abre el menú de un cuaderno, elige "Importar PDF", sube un PDF de 30 páginas con capa de texto y obtiene una página editable en menos de 60 segundos (criterio de §13); el desglose medido queda registrado en `tasks.md`.
- [ ] El contenido importado usa solo bloques `heading`, `paragraph`, `bulletList`/`orderedList` según la heurística de la decisión 5, y `pages.plain_text` queda materializado por el servidor.
- [ ] Un PDF mixto termina `done` con el aviso "N páginas sin texto"; un PDF sin ninguna página con texto termina `failed` con un mensaje amable y sin página con contenido parcial inconsistente.
- [ ] Subidas mayores a 20 MB o con MIME distinto de `application/pdf` se rechazan en tres capas: validación en cliente, límites del bucket sobre los bytes reales y revalidación server-side antes de encolar.
- [ ] Un usuario no puede leer ni descargar el PDF de otro usuario desde `page-pdfs` (test negativo de RLS).
- [ ] La tarea de Trigger.dev en `src/trigger/` solo invoca `ingestion.application`; dependency-cruiser en verde con las reglas nuevas.
- [ ] El flujo de Playwright de importación pasa en `main` contra Trigger.dev dev y `cogni-dev`; `pr.yml` sigue sin secretos.
- [ ] El paso de deploy de Trigger.dev en `main.yml` se ejecuta cuando cambia `src/trigger/**` y la tarea desplegada coincide con la versión de la Server Action.
- [ ] `pdf_imported` se emite en PostHog cuando el job pasa a `done`.
- [ ] CI en verde en cada PR: Biome, `tsc --noEmit`, Vitest, dependency-cruiser, `pnpm audit`; cobertura del 100 % en la función texto→bloques y en las transiciones del `ImportJob`.
- [ ] Cada PR de la cadena se mantiene dentro de las ~400 líneas de autoría cambiadas o lleva un `size:exception` explícito.
- [ ] `design.md` incluye el diagrama de secuencia Server Action → Trigger.dev → `notebooks`; al archivar, `openspec/specs/` gana `pdf-import` y las cuatro specs modificadas reflejan el comportamiento implementado.
