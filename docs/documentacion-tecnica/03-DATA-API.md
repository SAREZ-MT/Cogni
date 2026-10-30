# Modelo de datos y contrato de API — Cogni

**Proyecto:** Cogni — plataforma web de estudio a partir de apuntes propios
**Versión:** 1.3
**Fecha:** 2026-10-29
**Estado:** Borrador
**Autor:** Javier Sarez
**Documentos relacionados:** ./01-SRS.md, ./02-SAD.md, ./04-ADR.md

---

## 0. Nota de estado actual (revisada el 2026-10-15 contra el código)

- Las Fases 0 a 7 están implementadas y los 11 módulos de `src/modules/` son reales; ninguno es un esqueleto.
  - Fase 0 (Cimientos) y Fase 1 (Cuadernos y editor): desplegadas en producción; tablas `profiles`, `notebooks`, `pages` y `page_assets` (migraciones `0000`–`0004`).
  - Fase 2 (Importación de PDF): implementada bajo Organic Driven Development (ODD) el 2026-09-23; tabla `import_jobs` y bucket `page-pdfs` (migraciones `0005`–`0006`). Ampliada el 2026-10-26 (rama `feat/document-import`, `docs/adr/0009`) a Word (`.docx`) y PowerPoint (`.pptx`): migración `0014` (columnas `import_jobs.format` y `skipped_images`, tipos MIME de DOCX y PPTX en `page-pdfs`) e imágenes importadas registradas en `page_assets`. Desde T8 el PDF también se lee con officeparser (estructura, formato en línea, enlaces, listas, tablas, código e imágenes), sin cambios de esquema.
  - Fase 3 (Capa de IA, PR #63–#69) y aceptación de términos de uso (PR #70): tablas `ai_generations` y `flashcards` (migración `0007`) y columnas de términos en `profiles` (migración `0008`); decisiones en `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md`.
  - Fase 4 (Motor de repetición y flashcards, PR #71–#77): tablas `study_items`, `review_logs`, `page_mastery`, `flashcard_sessions` y `session_feedback`, y `flashcards.archived_at` (migración `0009`); decisiones en `docs/adr/0005-motor-de-repeticion-y-flashcards.md`.
  - Fase 5 (Exámenes, PR #78–#86): tablas `exam_questions`, `exam_page_state`, `exam_sessions` y `exam_answers` (migraciones `0010`–`0011`); decisiones en `docs/adr/0006-examenes-y-repeticion-con-variantes.md`.
  - Fase 6 (Recordación activa, PR #87–#94): tablas `recall_questions`, `recall_sessions` y `recall_answers` (migración `0012`) y `generation_fingerprints` (migración `0013`, generación incremental de las tres técnicas); decisiones en `docs/adr/0007-recordacion-activa-y-generacion-incremental.md`.
  - Fase 7 (Calendario y dashboard, PR #95–#100): sin tablas ni migraciones nuevas; `scheduling` y `analytics` solo leen tablas existentes y `profiles.timezone` pasa a usarse; decisiones en `docs/adr/0008-calendario-y-dashboard.md`.
- El esquema real tiene 20 tablas, una por entidad del modelo de dominio (documento-maestro §6.1), creadas por 14 migraciones (`0000_profiles` a `0013_generation_fingerprints`). Todas se documentan en este documento contra su migración y `src/shared/db/schema.ts` (§1 y §2).
- Fase 8 (Diseño y flujos), revisión del 2026-10-29 contra el código, sin cambio de esquema ni migraciones: la creación de tarjetas y preguntas nace solo con IA (H13) y exige 100 palabras de contenido nuevo, unas 15 por ítem (150 para recordación activa y para el examen más pequeño; `AI_PAGE_TOO_SHORT`, H14); cada técnica tiene una página de edición con un solo "Guardar" transaccional (H18); "Archivar" se reemplazó por un borrado real con recuento previo (H19). Las acciones de creación manual, archivado y retiro (`createFlashcardAction`, `archiveFlashcardAction`, `createExamQuestionAction`, `editExamQuestionAction`, `retireExamQuestionAction`, `archiveNotebook`, `archivePage`) ya no existen; §4 lista sus reemplazos.
- El contrato de API (§4) cubre las Server Actions de los 18 archivos `"use server"` y los 3 Route Handlers que existen hoy en el código; no documenta ningún punto de entrada inexistente.
- Referencias a decisiones: "`04-ADR.md`, ADR-0NN" designa una entrada del registro de decisiones de esta suite (`./04-ADR.md`); "`docs/adr/00NN`" designa un ADR numerado del repositorio. Son dos numeraciones distintas.

### Documento vivo

Este documento se actualiza a medida que avanza la construcción de Cogni; la nota de estado de esta sección es el punto de anclaje de esas actualizaciones. Cuando una fase posterior (por ejemplo, la Fase 9) agregue migraciones, Server Actions o Route Handlers, esta nota y las secciones afectadas se revisarán contra el código en la misma entrega.

### Correspondencia con las fases RAD

| Sección de este documento | Fase RAD | Uso en la tesis |
|---|---|---|
| 1. Modelo entidad-relación | Diseño de usuario / Construcción | Sustenta el modelo de datos como evidencia de diseño previo a la implementación. |
| 2. Esquema por módulo | Construcción | Evidencia directa y verificable (SQL real) del trabajo de construcción de la base de datos. |
| 3. Motor de repetición espaciada (SM-2) | Diseño de usuario / Construcción | Especificación del algoritmo (documento-maestro §7) y referencia a su implementación en `study-engine`. |
| 4. Contrato de API | Construcción | Documenta el contrato real entre interfaz y servidor, insumo de pruebas de Implementación. |
| 5. Índices y restricciones | Construcción | Evidencia de las decisiones de integridad y desempeño tomadas durante la construcción. |

---

## 1. Modelo entidad-relación

> **Decisiones de modelado (documento-maestro §6.2 y código real):**
> - **Autorización por propiedad, no por RLS de negocio:** el servidor se conecta con el pooler de Supabase y omite Row Level Security; cada caso de uso de `application` recibe `ownerId` de la sesión y filtra explícitamente por él (`src/shared/db/client.ts`, `prepare: false, max: 1`). RLS está **activa** en las 20 tablas (`.enableRLS()` en `schema.ts`, `ENABLE ROW LEVEL SECURITY` en cada migración) pero ninguna tiene políticas propias: solo la conexión de servidor las alcanza. Las únicas políticas RLS del proyecto son las de Storage (siguiente punto).
> - **RLS real en Supabase Storage:** a diferencia de las tablas de negocio, los buckets `page-assets` y `page-pdfs` sí tienen políticas RLS por `owner_id`, porque el navegador sube archivos directamente a Storage con la clave pública.
> - **Borrado real desde la Fase 8 (H18, H19):** cuadernos, páginas, conjuntos de técnica e ítems sueltos se borran físicamente. Borrar un cuaderno o una página borra la fila y el resto cae por `ON DELETE CASCADE` (salvo `session_feedback`, sin clave foránea, que se borra antes en la misma transacción, y `ai_generations`, que solo pierde el enlace); los objetos de Storage se borran con su API después de confirmar. Un conjunto de técnica borra en una transacción, bajo el bloqueo de la página, sus ítems de todo estado, sesiones, respuestas, retroalimentación, `study_items` (los `review_logs` caen en cascada), `exam_page_state` y las huellas de la técnica, y recalcula `page_mastery`. Las columnas `archived_at` (`notebooks`, `pages`, `flashcards`, `recall_questions`) y `retired_at` (`exam_questions`) siguen en el esquema para las filas archivadas o retiradas antes de H19, que las lecturas siguen ocultando; ninguna acción las escribe ya.
> - **`content` jsonb + `plain_text` materializado:** `pages.content` guarda el documento Tiptap tal cual; `plain_text` se recalcula en el servidor en cada guardado mediante un recorrido puro del árbol (`extractPlainText`), nunca se acepta el `plain_text` que envíe el cliente.
> - **`content_version` como concurrencia optimista:** cada guardado de página es un `UPDATE ... WHERE content_version = expected` atómico (comparar-e-intercambiar), no un patrón leer-luego-escribir.
> - **`ImportJob` como máquina de estados:** `import_jobs.status` (`queued → processing → done/failed`) es el único registro de progreso de una importación; no existe columna `trigger_run_id` (ver `04-ADR.md`, ADR-009, y `docs/adr/0003`: la importación corre de forma síncrona dentro de la propia Server Action, bajo `maxDuration`, sobre Vercel Fluid Compute).
> - **Ítem de examen por raíz y referencias polimórficas:** el `StudyItem` de un examen tiene `kind = 'exam_question'` y `source_id` = `root_id` del linaje, así que las variantes de una repetición alimentan el mismo ítem que su pregunta original; `study_items.source_id`, `review_logs.session_id` y `session_feedback.session_id` son referencias polimórficas (según `kind` o `session_kind`) sin FK física, para que el motor siga el concepto evaluado y no conozca la técnica de origen.
> - **Identificadores UUID v7:** todo `id` se genera en la aplicación con `createId()` (48 bits de marca de tiempo en milisegundos + bits aleatorios, RFC 9562), nunca con un valor por defecto de Postgres. La única excepción es el relleno de `study_items` de `0009`, que usa `gen_random_uuid()` (v4) porque Postgres no genera v7 antes de la versión 18.
> - **Recordación activa (Fase 6):** las respuestas se atan al dueño de su sesión y de su pregunta con claves foráneas compuestas `(session_id, owner_id)` y `(question_id, owner_id)`, de modo que una respuesta nunca mezcla dueños; restricciones `CHECK` atan el estado de evaluación a sus datos. `generation_fingerprints` no tiene `id`: su clave natural es `(page_id, owner_id, technique, fingerprint)`.
> - **Columnas comunes:** `id`, `owner_id`, `created_at`, `updated_at` son comunes a casi toda entidad de usuario (documento-maestro §6.1) y se listan completas en cada tabla de esta sección. Excepciones reales: `profiles` no tiene `owner_id` (su `id` es el de `auth.users`); `review_logs` no tiene `updated_at` (registro inmutable); `exam_page_state` no tiene `id` (su clave primaria es `page_id`); `exam_answers` no tiene `id` ni `updated_at` (clave primaria `(session_id, question_id)`); `generation_fingerprints` no tiene `id` ni `updated_at` (clave primaria `(page_id, owner_id, technique, fingerprint)`).
> - **Exámenes por linaje:** `exam_questions` ata cada pregunta a su raíz con claves foráneas compuestas sobre la misma tabla (`(root_id, owner_id, page_id)` y `(variant_of, root_id)`), de modo que una variante nunca cambia de dueño, de página ni de linaje; `exam_answers` referencia `(question_id, root_id)` y es única por `(session_id, root_id)`: un examen nunca evalúa dos veces el mismo concepto.

> Diagrama a construir con archify a partir de esta descripción.

### Entidades implementadas

#### Profile — Estado: Implementado (Fase 0)

| Atributo | Tipo |
|---|---|
| id | uuid |
| display_name | text |
| locale | text |
| timezone | text |
| onboarding_completed_at | timestamptz |
| terms_accepted_version | text |
| terms_accepted_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con `auth.users` de Supabase: comparte el mismo `id` y depende de él (`ON DELETE CASCADE`, `drizzle/0002_profiles_auth_fk.sql`). Es el dueño (`owner_id`, `ON DELETE CASCADE`) de las otras 19 tablas: eliminar un Profile elimina en cadena todos sus datos. `terms_accepted_version` y `terms_accepted_at` (ambas nulas, `drizzle/0008_profiles_terms.sql`) registran la versión de los términos de uso aceptada (`TERMS_VERSION = "2026-10-04"`, `src/modules/identity/domain/terms.ts`) y cuándo; mientras la versión guardada no sea la vigente, el layout de `(app)` redirige a la puerta de términos (`termsRedirectFor`). `timezone` (texto `NOT NULL`, por defecto `UTC`) se describe en §2.1.

#### Notebook — Estado: Implementado (Fase 1)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| title | text |
| icon | text |
| color | text |
| position | integer |
| archived_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con Profile: pertenece a uno (`owner_id`, `ON DELETE CASCADE`). Se relaciona con Page: un Notebook tiene muchas Page (`notebook_id`, `ON DELETE CASCADE`); desde la Fase 8 (H19) borrar un Notebook borra sus páginas, incluidas las archivadas antes. Antes de H19, archivar un Notebook propagaba `archived_at` a sus páginas activas en la capa de aplicación.

#### Page — Estado: Implementado (Fase 1)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| notebook_id | uuid |
| title | text |
| content | jsonb |
| plain_text | text |
| content_version | integer |
| position | integer |
| archived_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con Notebook: pertenece a uno (`notebook_id`, `ON DELETE CASCADE`). Se relaciona con Profile: pertenece a uno (`owner_id`, `ON DELETE CASCADE`). Es la unidad de estudio: PageAsset, ImportJob, Flashcard, StudyItem, PageMastery, FlashcardSession, ExamQuestion, ExamPageState, ExamSession, RecallQuestion, RecallSession y GenerationFingerprint dependen de ella y se eliminan en cascada; AiGeneration conserva su registro con `page_id` nulo (§2.6).

#### PageAsset — Estado: Implementado (Fase 1)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| page_id | uuid |
| storage_path | text |
| mime | text |
| size_bytes | integer |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con Page: pertenece a una (`page_id`, `ON DELETE CASCADE`). Se relaciona con Profile: pertenece a uno (`owner_id`, `ON DELETE CASCADE`). `storage_path` es único (`UNIQUE`), lo que permite registrar el mismo objeto subido de forma idempotente. Desde `docs/adr/0009`, la importación de documentos también crea filas: cada imagen extraída se sube desde el servidor a `page-assets` y se registra con `storeImportedAsset` de `notebooks/server-api.ts`, y el bloque `image` la referencia por su `id` (`assetId`).

#### ImportJob — Estado: Implementado (Fase 2)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| page_id | uuid |
| storage_path | text |
| file_name | text |
| size_bytes | integer |
| status | text |
| format | text |
| page_count | integer |
| pages_without_text | integer |
| skipped_images | integer |
| error | text |
| started_at | timestamptz |
| finished_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con Page: pertenece a una (`page_id`, `ON DELETE CASCADE`). Se relaciona con Profile: pertenece a uno (`owner_id`, `ON DELETE CASCADE`). `storage_path` es único. A diferencia de la especificación original del documento maestro (§6.1), esta tabla **no** tiene columna `trigger_run_id`: `04-ADR.md`, ADR-009 (y `docs/adr/0003`), fija el procesamiento síncrono dentro de la propia Server Action (`maxDuration = 120`, Vercel Fluid Compute) como mecanismo de trabajo en segundo plano. `format` (`pdf`, `docx` o `pptx`, `CHECK import_jobs_format_check`, por defecto `pdf`) se toma de la extensión de la ruta al crear el job; `skipped_images` (≥ 0, `CHECK import_jobs_skipped_images_check`) cuenta las imágenes de una importación terminada que no se conservaron. Ambas columnas llegaron con `0014`.

#### AiGeneration — Estado: Implementado (Fase 3)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| page_id | uuid |
| purpose | text |
| provider | text |
| model | text |
| prompt_version | text |
| input_tokens | integer |
| output_tokens | integer |
| latency_ms | integer |
| status | text |
| error | text |
| created_at | timestamptz |
| updated_at | timestamptz |

Registro de auditoría de cada llamada a la IA (`drizzle/0007_ai_generations_flashcards.sql`, módulo `ai`). Se relaciona con Profile (`owner_id`, `ON DELETE CASCADE`) y con Page cuando el propósito la tiene (`page_id` nulo; `ON DELETE SET NULL`, para que el registro sobreviva a la página). `purpose` es uno de seis valores (`CHECK ai_generations_purpose_check`, §2.5) y `status` sigue `queued → running → done/failed` (`CHECK ai_generations_status_check`). `input_tokens`, `output_tokens` y `latency_ms` son `NOT NULL` con valor por defecto 0; `provider`, `model` y `prompt_version` son `NOT NULL`. Alimenta Flashcard, ExamQuestion, RecallQuestion, RecallAnswer y SessionFeedback mediante `generation_id` (`ON DELETE SET NULL` en todas). El documento maestro también lista `trigger_run_id` para esta entidad; no existe, por la misma razón que en ImportJob (`04-ADR.md`, ADR-009, y `docs/adr/0003`: el trabajo largo corre dentro de la propia función de Vercel, sin colas externas).

#### Flashcard — Estado: Implementado (Fase 3; `archived_at` desde la Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| page_id | uuid |
| generation_id | uuid |
| front | text |
| back | text |
| origin | text |
| position | integer |
| archived_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con Page (`page_id`, `ON DELETE CASCADE`) y con Profile (`owner_id`, `ON DELETE CASCADE`): las tarjetas activas de una página forman su único mazo, ordenado por `position` (`integer NOT NULL`). `front` y `back` no pueden estar vacíos (`CHECK flashcards_front_not_blank`, `flashcards_back_not_blank`; la aplicación limita cada lado a 1000 caracteres); `origin` es `ai` o `manual` (`CHECK flashcards_origin_check`). `generation_id` apunta a AiGeneration cuando la tarjeta se generó (`ON DELETE SET NULL`). `archived_at` (nula, agregada por `0009_study_engine`) archiva una tarjeta sin borrarla; archivar la última tarjeta activa de un mazo se rechaza (`FLASHCARD_LAST_CARD`: un mazo nunca queda vacío). Su `StudyItem` es de tipo `flashcard` con `source_id` = id de la tarjeta.

#### StudyItem — Estado: Implementado (Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| page_id | uuid |
| kind | text |
| source_id | uuid |
| easiness | double precision |
| interval_days | integer |
| repetitions | integer |
| lapses | integer |
| due_at | timestamptz |
| last_quality | integer |
| last_reviewed_at | timestamptz |
| suspended_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

Estado SM-2 de una unidad repasable (`drizzle/0009_study_engine.sql`, módulo `study-engine`). Se relaciona con Page (`page_id`, `ON DELETE CASCADE`) y con Profile (`owner_id`, `ON DELETE CASCADE`). `kind` es `flashcard`, `exam_question` o `recall_question` (`CHECK study_items_kind_check`) y `source_id` apunta, sin FK física, a la tarjeta, a la pregunta raíz del linaje de examen o a la pregunta de recordación; el par es único (`UNIQUE study_items_kind_source_key (kind, source_id)`). `easiness` empieza en 2.5 y nunca baja de 1.3 (`CHECK study_items_easiness_min`); `interval_days`, `repetitions` y `lapses` empiezan en 0 y no son negativos (`CHECK study_items_counters_non_negative`); `last_quality`, cuando existe, va de 0 a 5 (`CHECK study_items_last_quality_range`). `due_at` es `NOT NULL` sin valor por defecto (la aplicación lo fija al crear el ítem). La migración rellena un ítem por cada tarjeta no archivada previa a la Fase 4 (vencido desde la creación de la tarjeta).

#### ReviewLog — Estado: Implementado (Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| item_id | uuid |
| quality | integer |
| reviewed_at | timestamptz |
| interval_before | integer |
| interval_after | integer |
| easiness_after | double precision |
| session_kind | text |
| session_id | uuid |
| created_at | timestamptz |

Registro inmutable de cada repaso: no tiene `updated_at`. Se relaciona con StudyItem (`item_id`, `ON DELETE CASCADE`) y con Profile (`owner_id`, `ON DELETE CASCADE`): muchos ReviewLog por ítem. `quality` va de 0 a 5 (`CHECK review_logs_quality_range`); `session_kind` es `flashcards`, `exam` o `recall` (`CHECK review_logs_session_kind_check`) y `session_id` es una referencia polimórfica sin FK física a FlashcardSession, ExamSession o RecallSession según `session_kind` (documento-maestro §6.1). Es la fuente del historial de repasos y de la racha del dashboard (Fase 7).

#### PageMastery — Estado: Implementado (Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| page_id | uuid |
| level | text |
| score | double precision |
| items_total | integer |
| items_due | integer |
| computed_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con Page: una PageMastery por página (`UNIQUE page_mastery_page_id_key (page_id)`, `ON DELETE CASCADE`) y con Profile (`ON DELETE CASCADE`). `level` es `Nuevo`, `Aprendiendo`, `Consolidando` o `Dominado` (`CHECK page_mastery_level_check`) y `score` está entre 0 y 1 (`CHECK page_mastery_score_range`), calculados con la fórmula de §3.4. La recalculan los repasos de las tres técnicas y el cron diario `/api/recompute-mastery` (§4, Route Handlers).

#### FlashcardSession — Estado: Implementado (Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| page_id | uuid |
| started_at | timestamptz |
| finished_at | timestamptz |
| reviewed_count | integer |
| again_count | integer |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con Profile (`ON DELETE CASCADE`) y con Page cuando la sesión es de una sola página (`page_id`, `ON DELETE CASCADE`); `page_id` queda nulo en la sesión multipágina de "Hoy" (documento-maestro §6.1). `reviewed_count` y `again_count` empiezan en 0. Se relaciona con ReviewLog y SessionFeedback a través de `session_id`/`session_kind = flashcards`.

#### SessionFeedback — Estado: Implementado (Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| session_kind | text |
| session_id | uuid |
| content | jsonb |
| generation_id | uuid |
| status | text |
| created_at | timestamptz |
| updated_at | timestamptz |

Retroalimentación de IA de una sesión terminada, una por sesión (`UNIQUE session_feedback_session_key (session_kind, session_id)`). Se relaciona con Profile (`ON DELETE CASCADE`) y con AiGeneration (`generation_id`, `ON DELETE SET NULL`); `session_id` es polimórfico sin FK física. `status` es `pending`, `done` o `failed` (`CHECK session_feedback_status_check`, por defecto `pending`); `content` (nulo salvo en `done`) guarda `summary`, `strengths[]`, `toReinforce[]` y `nextStepSuggestion`. `session_kind` admite `flashcards`, `exam` y `recall` (`CHECK session_feedback_session_kind_check`), pero solo flashcards (Fase 4) y exámenes (Fase 5) la crean. Desviación deliberada de la Fase 6 (`docs/adr/0007`): la recordación activa no crea SessionFeedback; su retroalimentación es la justificación por pregunta guardada en `RecallAnswer.ai_evaluation`.

#### ExamQuestion — Estado: Implementado (Fase 5)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| page_id | uuid |
| stem | text |
| options | jsonb |
| correct_index | integer |
| explanation | text |
| concept | text |
| root_id | uuid |
| variant_of | uuid |
| origin | text |
| generation_id | uuid |
| retired_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con Page y con Profile (`ON DELETE CASCADE`) y con AiGeneration (`generation_id`, `ON DELETE SET NULL`). `options` es un arreglo de exactamente 4 opciones (`CHECK exam_questions_options_count`) y `correct_index` va de 0 a 3 (`CHECK exam_questions_correct_index_range`); `stem` y `concept` no pueden estar vacíos. `origin` es `ai`, `manual` o `ai_variant` (`CHECK exam_questions_origin_check`). `root_id` apunta a la pregunta original de su linaje (a sí misma si es original) y `variant_of` a la pregunta que reemplaza en una repetición; `CHECK exam_questions_lineage_check` exige que `variant_of` sea nulo exactamente cuando `root_id = id`. Dos claves foráneas sobre la misma tabla (`ON DELETE NO ACTION`) atan una variante a su raíz con el mismo dueño y página (`(root_id, owner_id, page_id)`) y a una pregunta del mismo linaje (`(variant_of, root_id)`). Una pregunta se retira (`retired_at`), no se borra.

#### ExamPageState — Estado: Implementado (Fase 5)

| Atributo | Tipo |
|---|---|
| page_id | uuid |
| owner_id | uuid |
| retake_pending | boolean |
| failed_root_ids | jsonb |
| last_passed_session_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |

Estado de examen de una página: su clave primaria es `page_id` (no tiene `id`). Se relaciona con Page y con Profile (`ON DELETE CASCADE`). `retake_pending` (por defecto falso) marca una repetición pendiente; `failed_root_ids` (por defecto `[]`, `CHECK exam_page_state_failed_root_ids_array`) guarda los `root_id` fallados en el último examen; `last_passed_session_id` apunta a la ExamSession aprobada más reciente (`ON DELETE SET NULL`), cuya retroalimentación se reutiliza tras otro aprobado (documento-maestro §7.5).

#### ExamSession — Estado: Implementado (Fase 5)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| page_id | uuid |
| requested_count | integer |
| question_ids | jsonb |
| is_retake | boolean |
| retake_of_session_id | uuid |
| started_at | timestamptz |
| finished_at | timestamptz |
| total | integer |
| correct | integer |
| score | double precision |
| passed | boolean |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con Page y con Profile (`ON DELETE CASCADE`). `requested_count` (N) va de 10 a 30 (`CHECK exam_sessions_requested_count_range`). `question_ids` (`jsonb NOT NULL`, agregada por `0011_exam_session_questions`) fija al iniciar la lista ordenada de preguntas que muestra la sesión: de 1 a `requested_count` elementos (`CHECK exam_sessions_question_ids_check`). `retake_of_session_id` apunta a la sesión original (`ON DELETE SET NULL`) y solo puede existir si `is_retake` es verdadero (`CHECK exam_sessions_retake_check`). `CHECK exam_sessions_result_check` ata el resultado al cierre: con `finished_at` nulo, `total`, `correct`, `score` y `passed` son nulos; con `finished_at`, `total` va de 1 a `requested_count`, `correct` de 0 a `total` y `score` (`double precision`) de 0 a 1.

#### ExamAnswer — Estado: Implementado (Fase 5)

| Atributo | Tipo |
|---|---|
| owner_id | uuid |
| session_id | uuid |
| question_id | uuid |
| root_id | uuid |
| selected_index | integer |
| is_correct | boolean |
| answered_at | timestamptz |
| created_at | timestamptz |

Sin `id` ni `updated_at`: su clave primaria es `(session_id, question_id)` y cada respuesta queda fija al darla. Se relaciona con ExamSession (`session_id`, `ON DELETE CASCADE`), con Profile (`ON DELETE CASCADE`) y con ExamQuestion por `(question_id, root_id)` (`ON DELETE CASCADE`): `question_id` es la variante realmente mostrada y `root_id` preserva el concepto evaluado; `UNIQUE exam_answers_session_root_key (session_id, root_id)` impide evaluar dos veces el mismo concepto en una sesión. `selected_index` va de 0 a 3 (`CHECK exam_answers_selected_index_range`).

#### RecallQuestion — Estado: Implementado (Fase 6)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| page_id | uuid |
| prompt | text |
| rubric | jsonb |
| origin | text |
| generation_id | uuid |
| archived_at | timestamptz |

Se relaciona con Page (`page_id`, `ON DELETE CASCADE`) y con Profile (`owner_id`, `ON DELETE CASCADE`): muchas RecallQuestion por página. `rubric` guarda `keyConcepts[]` (al menos uno) y `acceptableAnswerSummary` (no vacío), validados con `CHECK recall_questions_rubric_shape`; `prompt` no puede estar vacío; `origin` es `ai` o `manual` (en la Fase 6 solo se generan con IA). `generation_id` apunta a `ai_generations` (`ON DELETE SET NULL`). Se archiva (`archived_at`), no se borra. Su `StudyItem` es de tipo `recall_question` y `source_id` = id de la pregunta.

#### RecallSession — Estado: Implementado (Fase 6)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| page_id | uuid |
| started_at | timestamptz |
| finished_at | timestamptz |
| evaluation_status | text |

Se relaciona con Page (`page_id`, `ON DELETE CASCADE`) y con Profile (`owner_id`, `ON DELETE CASCADE`): muchas RecallSession por página. `evaluation_status` (`pending`/`done`/`partial`) refleja que la evaluación de IA de cada respuesta es asíncrona: solo deja `pending` cuando la sesión terminó (`finished_at` no nulo), y `finished_at >= started_at`. No guarda la lista de preguntas: una respuesta se acepta si su pregunta es del dueño y de la página de la sesión (una pregunta archivada después de que la sesión la mostró sigue contando). Una sesión cerrada sin respuestas queda `done`; con alguna respuesta `failed`, `partial`.

#### RecallAnswer — Estado: Implementado (Fase 6)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| session_id | uuid |
| question_id | uuid |
| answer_text | text |
| self_rating | integer |
| evaluation_status | text |
| ai_evaluation | jsonb |
| ai_score | integer |
| combined_quality | integer |
| generation_id | uuid |
| disagreed | boolean |
| evaluation_claimed_at | timestamptz |

Se relaciona con RecallSession (`(session_id, owner_id)`, `ON DELETE CASCADE`) y con RecallQuestion (`(question_id, owner_id)`, `ON DELETE CASCADE`): muchas RecallAnswer por sesión, una por pregunta (único `(session_id, question_id)`). `combined_quality` es la calidad SM-2 calculada según la fórmula de §3.3 de este documento (documento-maestro §7.4). `self_rating`, `ai_score` y `combined_quality` van de 0 a 5. `evaluation_claimed_at` no figura en el documento maestro original: guarda cuándo una corrida de evaluación reclamó la respuesta (un reclamo de más de 6 minutos se retoma; `docs/adr/0007`). `CHECK recall_answers_evaluation_check` ata el estado a sus datos: `pending` sin `ai_score` ni `combined_quality` (puede conservar el intento fallido anterior tras "Reintentar"); `done` con `ai_evaluation`, `ai_score` y `combined_quality`; `failed` con `ai_evaluation` y sin puntajes. Contenido de `ai_evaluation`: la salida del modelo (`score`, `presentConcepts`, `missingConcepts`, `misconceptions`, `justification`), el registro `{ "source": "skipped", "score": 0, "justification": "Pregunta sin responder." }` de una pregunta saltada (texto `(sin respuesta)`), o el intento fallido `{ "source": "failed", "code", "generationId", "resetAt"? }`. `disagreed` registra "No estoy de acuerdo" y nunca cambia el puntaje.

#### GenerationFingerprint — Estado: Implementado (Fase 6)

| Atributo | Tipo |
|---|---|
| owner_id | uuid |
| page_id | uuid |
| technique | text |
| fingerprint | text |
| created_at | timestamptz |

Memoria de la generación incremental (documento-maestro §3.1, `docs/adr/0007`): una fila por párrafo de una página que una técnica ya envió a la IA. Clave primaria `(page_id, owner_id, technique, fingerprint)`; sin `id` ni `updated_at`. `technique` es `flashcards`, `exam` o `recall` (`CHECK generation_fingerprints_technique_check`); `fingerprint` es el sha256 hexadecimal del párrafo normalizado (forma NFC, espacios colapsados, minúsculas), validado con `CHECK generation_fingerprints_fingerprint_format` (`^[0-9a-f]{64}$`). Se relaciona con Page y con Profile (`ON DELETE CASCADE`). La escribe el módulo de cada técnica, solo para su técnica y en la misma transacción que sus ítems; el puerto compartido es `GenerationFingerprintRepository` (`src/shared/kernel/generation-fingerprints.ts`).

### Resumen de entidades

| Entidad | Tabla | Módulo | Estado | Fase (migración) |
|---|---|---|---|---|
| Profile | profiles | identity | Implementado | Fase 0 (`0000`–`0002`; términos `0008`) |
| Notebook | notebooks | notebooks | Implementado | Fase 1 (`0003`) |
| Page | pages | notebooks | Implementado | Fase 1 (`0003`) |
| PageAsset | page_assets | notebooks | Implementado | Fase 1 (`0003`, bucket `0004`) |
| ImportJob | import_jobs | ingestion | Implementado | Fase 2 (`0005`, bucket `0006`) |
| AiGeneration | ai_generations | ai | Implementado | Fase 3 (`0007`) |
| Flashcard | flashcards | flashcards | Implementado | Fase 3 (`0007`; `archived_at` en `0009`) |
| StudyItem | study_items | study-engine | Implementado | Fase 4 (`0009`) |
| ReviewLog | review_logs | study-engine | Implementado | Fase 4 (`0009`) |
| PageMastery | page_mastery | study-engine | Implementado | Fase 4 (`0009`) |
| FlashcardSession | flashcard_sessions | study-engine | Implementado | Fase 4 (`0009`) |
| SessionFeedback | session_feedback | study-engine (escrita por flashcards y exams) | Implementado | Fase 4 (`0009`) |
| ExamQuestion | exam_questions | exams | Implementado | Fase 5 (`0010`) |
| ExamPageState | exam_page_state | exams | Implementado | Fase 5 (`0010`) |
| ExamSession | exam_sessions | exams | Implementado | Fase 5 (`0010`; `question_ids` en `0011`) |
| ExamAnswer | exam_answers | exams | Implementado | Fase 5 (`0010`) |
| RecallQuestion | recall_questions | active-recall | Implementado | Fase 6 (`0012`) |
| RecallSession | recall_sessions | active-recall | Implementado | Fase 6 (`0012`) |
| RecallAnswer | recall_answers | active-recall | Implementado | Fase 6 (`0012`) |
| GenerationFingerprint | generation_fingerprints | flashcards / exams / active-recall | Implementado | Fase 6 (`0013`) |

---

## 2. Esquema por módulo

Las migraciones reales viven en `drizzle/*.sql` (14, de `0000` a `0013`; esta sección cita el SQL de todas), generadas por `drizzle-kit generate` a partir de `src/shared/db/schema.ts` (`drizzle.config.ts`: `dialect: "postgresql"`, `schema: "./src/shared/db/schema.ts"`, `out: "./drizzle"`) y aplicadas con `drizzle-kit migrate`. Las migraciones de Storage (buckets y políticas RLS) son SQL escrito a mano, porque Drizzle no introspecta el esquema `storage` de Supabase.

### 2.1 `identity` — `profiles`

Una tabla. RLS activa sin políticas: solo la conexión de servidor (que omite RLS) la alcanza; PostgREST con la clave pública no ve nada de esta tabla.

```sql
-- drizzle/0000_profiles.sql
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"locale" text DEFAULT 'es' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

```sql
-- drizzle/0001_profiles_rls.sql
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
```

```sql
-- drizzle/0002_profiles_auth_fk.sql
-- Fails closed: refuses to delete profiles when auth.users looks empty,
-- because that shape means DATABASE_URL is probably pointed at the wrong DB.
-- guard:start
do $$
declare
  users_count bigint;
  profiles_count bigint;
  orphan_count bigint;
begin
  select count(*) into users_count from auth.users;
  select count(*) into profiles_count from profiles;
  select count(*) into orphan_count
    from profiles p
    where not exists (select 1 from auth.users u where u.id = p.id);
  raise notice '0002_profiles_auth_fk: auth.users=%, profiles=%, orphans=%', users_count, profiles_count, orphan_count;
  if users_count = 0 and profiles_count > 0 then
    raise exception '0002_profiles_auth_fk: refusing to delete % profiles because auth.users is empty; check DATABASE_URL and clean orphans by hand', profiles_count;
  end if;
end $$;
-- guard:end
--> statement-breakpoint
-- A profile without a matching auth.users row can never sign in, so it is
-- safe to remove before the FK exists.
delete from profiles p where not exists (select 1 from auth.users u where u.id = p.id);
--> statement-breakpoint
alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
```

```sql
-- drizzle/0008_profiles_terms.sql
ALTER TABLE "profiles" ADD COLUMN "terms_accepted_version" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "terms_accepted_at" timestamp with time zone;
```

Nota de la Fase 7 (`docs/adr/0008`): `timezone` guarda un nombre de zona IANA en su forma canónica. Sin migración, el valor por defecto `UTC` significa "nunca elegida" (`hasChosenTimeZone`) y una elección explícita de UTC se guarda como `Etc/UTC`. La detección del navegador escribe con `UPDATE … WHERE timezone = 'UTC'`, así nunca pisa una elección explícita.

### 2.2 `notebooks` — `notebooks`, `pages`, `page_assets` + bucket `page-assets`

```sql
-- drizzle/0003_notebooks_pages_assets.sql
CREATE TABLE "notebooks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"color" text,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notebooks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "page_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_assets_storage_path_key" UNIQUE("storage_path")
);
--> statement-breakpoint
ALTER TABLE "page_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"notebook_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"plain_text" text DEFAULT '' NOT NULL,
	"content_version" integer DEFAULT 1 NOT NULL,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_assets" ADD CONSTRAINT "page_assets_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_assets" ADD CONSTRAINT "page_assets_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notebooks_owner_id_idx" ON "notebooks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "page_assets_page_id_idx" ON "page_assets" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "pages_notebook_id_idx" ON "pages" USING btree ("notebook_id");
```

```sql
-- drizzle/0004_page_assets_storage.sql (encabezado de comentarios abreviado; sentencias SQL textuales)
-- Bucket configuration and RLS policies for Supabase Storage's
-- `storage.objects`/`storage.buckets` tables. Drizzle does not introspect
-- the `storage` schema, so this is hand-written raw SQL applied by
-- `drizzle-kit migrate` like every other migration in this project.
--
-- Idempotent bucket upsert: the bucket may already exist from a manual
-- dashboard step, so `on conflict` keeps this migration the single
-- reproducible source of truth for `file_size_limit` and
-- `allowed_mime_types` across cogni-dev and cogni-prod.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'page-assets',
  'page-assets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint
-- The first path segment of an object's name is the owner id
-- (`{ownerId}/{pageId}/{assetId}.{ext}`); RLS filters on it via
-- storage.foldername(name), the documented Supabase Storage pattern.
create policy "page-assets read own"
  on storage.objects for select
  using (bucket_id = 'page-assets' and (storage.foldername(name))[1] = auth.uid()::text);
--> statement-breakpoint
create policy "page-assets write own"
  on storage.objects for insert
  with check (bucket_id = 'page-assets' and (storage.foldername(name))[1] = auth.uid()::text);
```

### 2.3 `ingestion` — `import_jobs` + bucket `page-pdfs`

```sql
-- drizzle/0005_import_jobs.sql
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"page_count" integer,
	"pages_without_text" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_jobs_storage_path_key" UNIQUE("storage_path"),
	CONSTRAINT "import_jobs_status_check" CHECK ("import_jobs"."status" in ('queued', 'processing', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_jobs_page_id_idx" ON "import_jobs" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "import_jobs_owner_status_idx" ON "import_jobs" USING btree ("owner_id","status");
```

```sql
-- drizzle/0006_page_pdfs_storage.sql (encabezado de comentarios abreviado; sentencias SQL textuales)
-- Bucket configuration and RLS policies for imported PDFs. Same pattern as
-- 0004_page_assets_storage.sql: raw SQL, because Drizzle does not
-- introspect the `storage` schema. page-assets is not touched.
--
-- Idempotent bucket upsert: `on conflict` keeps this migration the single
-- source of truth for the limits in cogni-dev and cogni-prod, even if the
-- bucket was created by hand before.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('page-pdfs', 'page-pdfs', false, 20971520, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint
-- The first path segment of an object's name is the owner id
-- (`{ownerId}/{uploadId}.pdf`); RLS filters on it via
-- storage.foldername(name), the documented Supabase Storage pattern.
create policy "page-pdfs read own"
  on storage.objects for select
  using (bucket_id = 'page-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
--> statement-breakpoint
create policy "page-pdfs write own"
  on storage.objects for insert
  with check (bucket_id = 'page-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
--> statement-breakpoint
create policy "page-pdfs delete own"
  on storage.objects for delete
  using (bucket_id = 'page-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
```

```sql
-- drizzle/0014_document_formats.sql (encabezado de comentarios abreviado; sentencias SQL textuales)
-- document-import T10: DOCX and PPTX imports. The bucket keeps its
-- historical name (renaming a bucket means moving every object).
ALTER TABLE "import_jobs" ADD COLUMN "format" text DEFAULT 'pdf' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN "skipped_images" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_format_check" CHECK ("import_jobs"."format" in ('pdf', 'docx', 'pptx'));--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_skipped_images_check" CHECK ("import_jobs"."skipped_images" >= 0);--> statement-breakpoint
update "import_jobs"
set "format" = substring(lower("storage_path") from '\.(pdf|docx|pptx)$')
where "storage_path" ~* '\.(pdf|docx|pptx)$';--> statement-breakpoint
update storage.buckets
set file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
where id = 'page-pdfs';
```

Las rutas de los objetos pasan a ser `{ownerId}/{uploadId}.{pdf|docx|pptx}`; las políticas RLS de `0006` no cambian. `0014_document_formats.down.sql` revierte las columnas, las restricciones y la lista de tipos MIME.

### 2.4 Módulos de las Fases 3 a 6

`ai`, `flashcards`, `study-engine`, `exams` y `active-recall` tienen tablas (migraciones `0007` y `0009`–`0013`); `scheduling` y `analytics` (Fase 7) no tienen tablas: solo leen las de `study-engine`, `notebooks` y `active-recall`. Todas las tablas de esta sección tienen RLS activa sin políticas, como el resto.

#### 2.4.1 `ai` y `flashcards` — `ai_generations`, `flashcards` (Fase 3)

```sql
-- drizzle/0007_ai_generations_flashcards.sql
CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_generations_status_check" CHECK ("ai_generations"."status" in ('queued', 'running', 'done', 'failed')),
	CONSTRAINT "ai_generations_purpose_check" CHECK ("ai_generations"."purpose" in ('generate_flashcards', 'generate_exam_questions', 'generate_exam_variants', 'generate_recall_questions', 'evaluate_recall_answer', 'session_feedback'))
);
--> statement-breakpoint
ALTER TABLE "ai_generations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"generation_id" uuid,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"origin" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flashcards_origin_check" CHECK ("flashcards"."origin" in ('ai', 'manual')),
	CONSTRAINT "flashcards_front_not_blank" CHECK (length(btrim("flashcards"."front")) > 0),
	CONSTRAINT "flashcards_back_not_blank" CHECK (length(btrim("flashcards"."back")) > 0)
);
--> statement-breakpoint
ALTER TABLE "flashcards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_generations_owner_created_idx" ON "ai_generations" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_generations_page_id_idx" ON "ai_generations" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "flashcards_page_position_idx" ON "flashcards" USING btree ("page_id","position");--> statement-breakpoint
CREATE INDEX "flashcards_owner_id_idx" ON "flashcards" USING btree ("owner_id");
```

`drizzle/0007_ai_generations_flashcards.down.sql` revierte la migración. `flashcards.archived_at` se agrega en `0009` (§2.4.2).

#### 2.4.2 `study-engine` — `study_items`, `review_logs`, `page_mastery`, `flashcard_sessions`, `session_feedback` (Fase 4)

```sql
-- drizzle/0009_study_engine.sql
CREATE TABLE "flashcard_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"reviewed_count" integer DEFAULT 0 NOT NULL,
	"again_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flashcard_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "page_mastery" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"level" text NOT NULL,
	"score" double precision NOT NULL,
	"items_total" integer NOT NULL,
	"items_due" integer NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_mastery_page_id_key" UNIQUE("page_id"),
	CONSTRAINT "page_mastery_level_check" CHECK ("page_mastery"."level" in ('Nuevo', 'Aprendiendo', 'Consolidando', 'Dominado')),
	CONSTRAINT "page_mastery_score_range" CHECK ("page_mastery"."score" >= 0 and "page_mastery"."score" <= 1)
);
--> statement-breakpoint
ALTER TABLE "page_mastery" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quality" integer NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"interval_before" integer NOT NULL,
	"interval_after" integer NOT NULL,
	"easiness_after" double precision NOT NULL,
	"session_kind" text NOT NULL,
	"session_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_logs_quality_range" CHECK ("review_logs"."quality" between 0 and 5),
	CONSTRAINT "review_logs_session_kind_check" CHECK ("review_logs"."session_kind" in ('flashcards', 'exam', 'recall'))
);
--> statement-breakpoint
ALTER TABLE "review_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"session_kind" text NOT NULL,
	"session_id" uuid NOT NULL,
	"content" jsonb,
	"generation_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_feedback_session_key" UNIQUE("session_kind","session_id"),
	CONSTRAINT "session_feedback_session_kind_check" CHECK ("session_feedback"."session_kind" in ('flashcards', 'exam', 'recall')),
	CONSTRAINT "session_feedback_status_check" CHECK ("session_feedback"."status" in ('pending', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "session_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "study_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_id" uuid NOT NULL,
	"easiness" double precision DEFAULT 2.5 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"last_quality" integer,
	"last_reviewed_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_items_kind_source_key" UNIQUE("kind","source_id"),
	CONSTRAINT "study_items_kind_check" CHECK ("study_items"."kind" in ('flashcard', 'exam_question', 'recall_question')),
	CONSTRAINT "study_items_easiness_min" CHECK ("study_items"."easiness" >= 1.3),
	CONSTRAINT "study_items_counters_non_negative" CHECK ("study_items"."interval_days" >= 0 and "study_items"."repetitions" >= 0 and "study_items"."lapses" >= 0),
	CONSTRAINT "study_items_last_quality_range" CHECK ("study_items"."last_quality" between 0 and 5)
);
--> statement-breakpoint
ALTER TABLE "study_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "flashcard_sessions" ADD CONSTRAINT "flashcard_sessions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_sessions" ADD CONSTRAINT "flashcard_sessions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_mastery" ADD CONSTRAINT "page_mastery_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_mastery" ADD CONSTRAINT "page_mastery_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_item_id_study_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."study_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flashcard_sessions_owner_started_idx" ON "flashcard_sessions" USING btree ("owner_id","started_at");--> statement-breakpoint
CREATE INDEX "flashcard_sessions_page_id_idx" ON "flashcard_sessions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_mastery_owner_id_idx" ON "page_mastery" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "review_logs_item_reviewed_idx" ON "review_logs" USING btree ("item_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_logs_owner_reviewed_idx" ON "review_logs" USING btree ("owner_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "session_feedback_owner_id_idx" ON "session_feedback" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "study_items_owner_due_idx" ON "study_items" USING btree ("owner_id","due_at");--> statement-breakpoint
CREATE INDEX "study_items_page_id_idx" ON "study_items" USING btree ("page_id");--> statement-breakpoint
-- Hand-written backfill (T2): every existing, non-archived flashcard gets the
-- study item it would have had from the start (documento-maestro §3.4):
-- easiness 2.5, interval 0, repetitions 0, lapses 0, due at the card's
-- creation, so pre-Phase-4 decks are due immediately. ids are v4 here
-- (gen_random_uuid) because Postgres has no v7 generator before 18; the
-- application keeps creating v7 ids. ON CONFLICT keeps it re-runnable.
-- tests/db/study-engine-schema.smoke.test.ts runs the statement between
-- the two markers below.
-- backfill:study_items:start
INSERT INTO "study_items" ("id", "owner_id", "page_id", "kind", "source_id", "easiness", "interval_days", "repetitions", "lapses", "due_at", "created_at", "updated_at")
SELECT gen_random_uuid(), "f"."owner_id", "f"."page_id", 'flashcard', "f"."id", 2.5, 0, 0, 0, "f"."created_at", "f"."created_at", now()
FROM "flashcards" "f"
WHERE "f"."archived_at" IS NULL
ON CONFLICT ("kind", "source_id") DO NOTHING;
-- backfill:study_items:end
```

`drizzle/0009_study_engine.down.sql` revierte la migración. El relleno de `study_items` entre los marcadores `backfill:study_items` lo ejecuta también `tests/db/study-engine-schema.smoke.test.ts`; sus `id` son v4 (`gen_random_uuid()`), mientras la aplicación sigue creando UUID v7.

#### 2.4.3 `exams` — `exam_questions`, `exam_page_state`, `exam_sessions`, `exam_answers` (Fase 5)

```sql
-- drizzle/0010_exams.sql
CREATE TABLE "exam_answers" (
	"owner_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"root_id" uuid NOT NULL,
	"selected_index" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_answers_pkey" PRIMARY KEY("session_id","question_id"),
	CONSTRAINT "exam_answers_session_root_key" UNIQUE("session_id","root_id"),
	CONSTRAINT "exam_answers_selected_index_range" CHECK ("exam_answers"."selected_index" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "exam_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_page_state" (
	"page_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"retake_pending" boolean DEFAULT false NOT NULL,
	"failed_root_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_passed_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_page_state_failed_root_ids_array" CHECK (jsonb_typeof("exam_page_state"."failed_root_ids") = 'array')
);
--> statement-breakpoint
ALTER TABLE "exam_page_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"stem" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"explanation" text NOT NULL,
	"concept" text NOT NULL,
	"root_id" uuid NOT NULL,
	"variant_of" uuid,
	"origin" text NOT NULL,
	"generation_id" uuid,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_questions_id_owner_page_key" UNIQUE("id","owner_id","page_id"),
	CONSTRAINT "exam_questions_id_root_key" UNIQUE("id","root_id"),
	CONSTRAINT "exam_questions_origin_check" CHECK ("exam_questions"."origin" in ('ai', 'manual', 'ai_variant')),
	CONSTRAINT "exam_questions_options_count" CHECK (jsonb_typeof("exam_questions"."options") = 'array' and jsonb_array_length("exam_questions"."options") = 4),
	CONSTRAINT "exam_questions_correct_index_range" CHECK ("exam_questions"."correct_index" between 0 and 3),
	CONSTRAINT "exam_questions_stem_not_blank" CHECK (length(btrim("exam_questions"."stem")) > 0),
	CONSTRAINT "exam_questions_concept_not_blank" CHECK (length(btrim("exam_questions"."concept")) > 0),
	CONSTRAINT "exam_questions_lineage_check" CHECK (("exam_questions"."variant_of" is null) = ("exam_questions"."root_id" = "exam_questions"."id"))
);
--> statement-breakpoint
ALTER TABLE "exam_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"requested_count" integer NOT NULL,
	"is_retake" boolean DEFAULT false NOT NULL,
	"retake_of_session_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"total" integer,
	"correct" integer,
	"score" double precision,
	"passed" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_sessions_requested_count_range" CHECK ("exam_sessions"."requested_count" between 10 and 30),
	CONSTRAINT "exam_sessions_retake_check" CHECK ("exam_sessions"."retake_of_session_id" is null or "exam_sessions"."is_retake"),
	CONSTRAINT "exam_sessions_result_check" CHECK (("exam_sessions"."finished_at" is null and "exam_sessions"."total" is null and "exam_sessions"."correct" is null and "exam_sessions"."score" is null and "exam_sessions"."passed" is null)
        or ("exam_sessions"."finished_at" is not null and "exam_sessions"."total" between 1 and "exam_sessions"."requested_count"
          and "exam_sessions"."correct" between 0 and "exam_sessions"."total"
          and "exam_sessions"."score" between 0 and 1 and "exam_sessions"."passed" is not null))
);
--> statement-breakpoint
ALTER TABLE "exam_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_session_id_exam_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_question_root_fk" FOREIGN KEY ("question_id","root_id") REFERENCES "public"."exam_questions"("id","root_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_page_state" ADD CONSTRAINT "exam_page_state_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_page_state" ADD CONSTRAINT "exam_page_state_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_page_state" ADD CONSTRAINT "exam_page_state_last_passed_session_id_exam_sessions_id_fk" FOREIGN KEY ("last_passed_session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_root_fk" FOREIGN KEY ("root_id","owner_id","page_id") REFERENCES "public"."exam_questions"("id","owner_id","page_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_variant_of_fk" FOREIGN KEY ("variant_of","root_id") REFERENCES "public"."exam_questions"("id","root_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_retake_of_session_id_exam_sessions_id_fk" FOREIGN KEY ("retake_of_session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_answers_question_id_idx" ON "exam_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "exam_answers_owner_id_idx" ON "exam_answers" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "exam_page_state_owner_id_idx" ON "exam_page_state" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "exam_questions_page_active_idx" ON "exam_questions" USING btree ("page_id","created_at") WHERE "exam_questions"."retired_at" is null;--> statement-breakpoint
CREATE INDEX "exam_questions_root_id_idx" ON "exam_questions" USING btree ("root_id");--> statement-breakpoint
CREATE INDEX "exam_questions_owner_id_idx" ON "exam_questions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "exam_sessions_page_finished_idx" ON "exam_sessions" USING btree ("page_id","finished_at");--> statement-breakpoint
CREATE INDEX "exam_sessions_owner_started_idx" ON "exam_sessions" USING btree ("owner_id","started_at");
```

```sql
-- drizzle/0011_exam_session_questions.sql
-- Each exam session stores the ordered ids of the questions it shows,
-- fixed at its start, instead of composing them again on every answer,
-- finish and read. No default and no backfill: exam_sessions is empty
-- wherever this runs (sessions ship together with this migration), and a
-- non-empty table makes the NOT NULL fail loudly instead of inventing lists.
ALTER TABLE "exam_sessions" ADD COLUMN "question_ids" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_question_ids_check" CHECK (jsonb_typeof("exam_sessions"."question_ids") = 'array' and jsonb_array_length("exam_sessions"."question_ids") between 1 and "exam_sessions"."requested_count");
```

`drizzle/0010_exams.down.sql` y `drizzle/0011_exam_session_questions.down.sql` revierten cada migración. Las restricciones `UNIQUE exam_questions_id_owner_page_key (id, owner_id, page_id)` y `exam_questions_id_root_key (id, root_id)` existen para ser destino de las claves foráneas compuestas del linaje y de `exam_answers`.

#### 2.4.4 `active-recall` — `recall_questions`, `recall_sessions`, `recall_answers` (Fase 6)

```sql
-- drizzle/0012_active_recall.sql
CREATE TABLE "recall_answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_text" text NOT NULL,
	"self_rating" integer NOT NULL,
	"evaluation_status" text DEFAULT 'pending' NOT NULL,
	"ai_evaluation" jsonb,
	"ai_score" integer,
	"combined_quality" integer,
	"generation_id" uuid,
	"disagreed" boolean DEFAULT false NOT NULL,
	"evaluation_claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recall_answers_session_question_key" UNIQUE("session_id","question_id"),
	CONSTRAINT "recall_answers_self_rating_range" CHECK ("recall_answers"."self_rating" between 0 and 5),
	CONSTRAINT "recall_answers_ai_score_range" CHECK ("recall_answers"."ai_score" between 0 and 5),
	CONSTRAINT "recall_answers_combined_quality_range" CHECK ("recall_answers"."combined_quality" between 0 and 5),
	CONSTRAINT "recall_answers_evaluation_check" CHECK (("recall_answers"."evaluation_status" = 'pending' and "recall_answers"."ai_score" is null and "recall_answers"."combined_quality" is null)
        or ("recall_answers"."evaluation_status" = 'done' and "recall_answers"."ai_evaluation" is not null
          and "recall_answers"."ai_score" is not null and "recall_answers"."combined_quality" is not null)
        or ("recall_answers"."evaluation_status" = 'failed' and "recall_answers"."ai_evaluation" is not null
          and "recall_answers"."ai_score" is null and "recall_answers"."combined_quality" is null))
);
--> statement-breakpoint
ALTER TABLE "recall_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recall_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"rubric" jsonb NOT NULL,
	"origin" text NOT NULL,
	"generation_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recall_questions_id_owner_key" UNIQUE("id","owner_id"),
	CONSTRAINT "recall_questions_origin_check" CHECK ("recall_questions"."origin" in ('ai', 'manual')),
	CONSTRAINT "recall_questions_prompt_not_blank" CHECK (length(btrim("recall_questions"."prompt")) > 0),
	CONSTRAINT "recall_questions_rubric_shape" CHECK (coalesce(jsonb_typeof("recall_questions"."rubric") = 'object'
        and case when jsonb_typeof("recall_questions"."rubric" -> 'keyConcepts') = 'array'
          then jsonb_array_length("recall_questions"."rubric" -> 'keyConcepts') > 0
          else false end
        and jsonb_typeof("recall_questions"."rubric" -> 'acceptableAnswerSummary') = 'string'
        and length(btrim("recall_questions"."rubric" ->> 'acceptableAnswerSummary')) > 0, false))
);
--> statement-breakpoint
ALTER TABLE "recall_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recall_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"evaluation_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recall_sessions_id_owner_key" UNIQUE("id","owner_id"),
	CONSTRAINT "recall_sessions_evaluation_status_check" CHECK ("recall_sessions"."evaluation_status" in ('pending', 'done', 'partial')
        and ("recall_sessions"."evaluation_status" = 'pending' or "recall_sessions"."finished_at" is not null)),
	CONSTRAINT "recall_sessions_finished_after_start" CHECK ("recall_sessions"."finished_at" is null or "recall_sessions"."finished_at" >= "recall_sessions"."started_at")
);
--> statement-breakpoint
ALTER TABLE "recall_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recall_answers" ADD CONSTRAINT "recall_answers_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_answers" ADD CONSTRAINT "recall_answers_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_answers" ADD CONSTRAINT "recall_answers_session_owner_fk" FOREIGN KEY ("session_id","owner_id") REFERENCES "public"."recall_sessions"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_answers" ADD CONSTRAINT "recall_answers_question_owner_fk" FOREIGN KEY ("question_id","owner_id") REFERENCES "public"."recall_questions"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_questions" ADD CONSTRAINT "recall_questions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_questions" ADD CONSTRAINT "recall_questions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_questions" ADD CONSTRAINT "recall_questions_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_sessions" ADD CONSTRAINT "recall_sessions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_sessions" ADD CONSTRAINT "recall_sessions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recall_answers_session_pending_idx" ON "recall_answers" USING btree ("session_id") WHERE "recall_answers"."evaluation_status" = 'pending';--> statement-breakpoint
CREATE INDEX "recall_answers_question_id_idx" ON "recall_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "recall_answers_owner_id_idx" ON "recall_answers" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recall_questions_page_active_idx" ON "recall_questions" USING btree ("page_id","created_at") WHERE "recall_questions"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "recall_questions_owner_id_idx" ON "recall_questions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recall_sessions_page_started_idx" ON "recall_sessions" USING btree ("page_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recall_sessions_owner_started_idx" ON "recall_sessions" USING btree ("owner_id","started_at" DESC NULLS LAST);
```

`drizzle/0012_active_recall.down.sql` revierte la migración. RLS activa sin políticas, como el resto de tablas de negocio: solo la conexión de servidor las alcanza.

#### 2.4.5 Generación incremental — `generation_fingerprints` (Fase 6)

```sql
-- drizzle/0013_generation_fingerprints.sql
CREATE TABLE "generation_fingerprints" (
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"technique" text NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_fingerprints_pkey" PRIMARY KEY("page_id","owner_id","technique","fingerprint"),
	CONSTRAINT "generation_fingerprints_technique_check" CHECK ("generation_fingerprints"."technique" in ('flashcards', 'exam', 'recall')),
	CONSTRAINT "generation_fingerprints_fingerprint_format" CHECK ("generation_fingerprints"."fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "generation_fingerprints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generation_fingerprints" ADD CONSTRAINT "generation_fingerprints_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_fingerprints" ADD CONSTRAINT "generation_fingerprints_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_fingerprints_owner_id_idx" ON "generation_fingerprints" USING btree ("owner_id");
```

`drizzle/0013_generation_fingerprints.down.sql` revierte la migración. Cada módulo de técnica tiene su adaptador Drizzle ligado a su técnica (`flashcards`, `exam`, `recall`); los módulos solo se encuentran a través de su `index.ts`.

### 2.5 Enumeraciones

No existe ningún `pgEnum` de Drizzle en `src/shared/db/schema.ts`. Todo conjunto cerrado de valores se declara como `text` con un `$type<...>()` de TypeScript en el lado de la aplicación y se refuerza en la base de datos con una restricción `CHECK`, no con un tipo enumerado nativo de Postgres. El primero fue `import_jobs.status` (`CHECK import_jobs_status_check`):

| Valor | Significado |
|---|---|
| `queued` | Job creado, aún no reclamado por `processImportJob`. |
| `processing` | Job reclamado; descarga, extracción y conversión en curso. |
| `done` | Importación terminada con éxito; el contenido ya está escrito en `pages.content`. |
| `failed` | Importación terminada sin éxito; `error` contiene el mensaje en español correspondiente (ver §4.3). |

Los demás conjuntos cerrados siguen el mismo patrón (`text` + `CHECK`):

| Columna | Valores | Significado |
|---|---|---|
| `ai_generations.purpose` | `generate_flashcards`, `generate_exam_questions`, `generate_exam_variants`, `generate_recall_questions`, `evaluate_recall_answer`, `session_feedback` | Propósito de la llamada a la IA auditada. |
| `ai_generations.status` | `queued`, `running`, `done`, `failed` | Ciclo de vida de la llamada: creada, en curso, con salida válida, fallida en todos los proveedores. |
| `flashcards.origin` | `ai`, `manual` | Tarjeta generada por la IA o escrita por el estudiante. |
| `study_items.kind` | `flashcard`, `exam_question`, `recall_question` | Técnica a la que apunta `source_id` (tarjeta, raíz del linaje de examen o pregunta de recordación). |
| `review_logs.session_kind` | `flashcards`, `exam`, `recall` | Tipo de sesión a la que apunta `session_id`. |
| `page_mastery.level` | `Nuevo`, `Aprendiendo`, `Consolidando`, `Dominado` | Nivel de dominio de la página (§3.4). |
| `session_feedback.session_kind` | `flashcards`, `exam`, `recall` | Tipo de sesión retroalimentada (`recall` está admitido pero no se usa; ver §1, SessionFeedback). |
| `session_feedback.status` | `pending`, `done`, `failed` | Retroalimentación reclamada en curso; con contenido; fallida (sin contenido). |
| `exam_questions.origin` | `ai`, `manual`, `ai_variant` | Pregunta generada, escrita por el estudiante o variante generada para una repetición. |
| `recall_questions.origin` | `ai`, `manual` | Origen de la pregunta (en la Fase 6 solo `ai`). |
| `recall_sessions.evaluation_status` | `pending`, `done`, `partial` | Evaluación en curso; todas las respuestas evaluadas; alguna respuesta `failed`. |
| `recall_answers.evaluation_status` | `pending`, `done`, `failed` | Sin evaluar o reclamada; evaluada (modelo o saltada); falló en todos los proveedores o por el límite diario. |
| `generation_fingerprints.technique` | `flashcards`, `exam`, `recall` | Técnica que ya envió el párrafo a la IA. |
| `import_jobs.format` | `pdf`, `docx`, `pptx` | Formato del documento importado, tomado de la extensión de la ruta (`0014`). |

### 2.6 Relaciones y borrado en cascada

| Tabla | Columna | Referencia | ON DELETE |
|---|---|---|---|
| `profiles` | `id` | `auth.users.id` | cascade |
| `notebooks` | `owner_id` | `profiles.id` | cascade |
| `pages` | `owner_id` | `profiles.id` | cascade |
| `pages` | `notebook_id` | `notebooks.id` | cascade |
| `page_assets` | `owner_id` | `profiles.id` | cascade |
| `page_assets` | `page_id` | `pages.id` | cascade |
| `import_jobs` | `owner_id` | `profiles.id` | cascade |
| `import_jobs` | `page_id` | `pages.id` | cascade |
| `ai_generations` | `owner_id` | `profiles.id` | cascade |
| `ai_generations` | `page_id` | `pages.id` | set null |
| `flashcards` | `owner_id` | `profiles.id` | cascade |
| `flashcards` | `page_id` | `pages.id` | cascade |
| `flashcards` | `generation_id` | `ai_generations.id` | set null |
| `study_items` | `owner_id` | `profiles.id` | cascade |
| `study_items` | `page_id` | `pages.id` | cascade |
| `review_logs` | `owner_id` | `profiles.id` | cascade |
| `review_logs` | `item_id` | `study_items.id` | cascade |
| `page_mastery` | `owner_id` | `profiles.id` | cascade |
| `page_mastery` | `page_id` | `pages.id` | cascade |
| `flashcard_sessions` | `owner_id` | `profiles.id` | cascade |
| `flashcard_sessions` | `page_id` | `pages.id` | cascade |
| `session_feedback` | `owner_id` | `profiles.id` | cascade |
| `session_feedback` | `generation_id` | `ai_generations.id` | set null |
| `exam_questions` | `owner_id` | `profiles.id` | cascade |
| `exam_questions` | `page_id` | `pages.id` | cascade |
| `exam_questions` | `generation_id` | `ai_generations.id` | set null |
| `exam_questions` | `(root_id, owner_id, page_id)` | `exam_questions(id, owner_id, page_id)` | no action |
| `exam_questions` | `(variant_of, root_id)` | `exam_questions(id, root_id)` | no action |
| `exam_page_state` | `page_id` | `pages.id` | cascade |
| `exam_page_state` | `owner_id` | `profiles.id` | cascade |
| `exam_page_state` | `last_passed_session_id` | `exam_sessions.id` | set null |
| `exam_sessions` | `owner_id` | `profiles.id` | cascade |
| `exam_sessions` | `page_id` | `pages.id` | cascade |
| `exam_sessions` | `retake_of_session_id` | `exam_sessions.id` | set null |
| `exam_answers` | `owner_id` | `profiles.id` | cascade |
| `exam_answers` | `session_id` | `exam_sessions.id` | cascade |
| `exam_answers` | `(question_id, root_id)` | `exam_questions(id, root_id)` | cascade |
| `recall_questions` | `owner_id` | `profiles.id` | cascade |
| `recall_questions` | `page_id` | `pages.id` | cascade |
| `recall_questions` | `generation_id` | `ai_generations.id` | set null |
| `recall_sessions` | `owner_id` | `profiles.id` | cascade |
| `recall_sessions` | `page_id` | `pages.id` | cascade |
| `recall_answers` | `owner_id` | `profiles.id` | cascade |
| `recall_answers` | `(session_id, owner_id)` | `recall_sessions(id, owner_id)` | cascade |
| `recall_answers` | `(question_id, owner_id)` | `recall_questions(id, owner_id)` | cascade |
| `recall_answers` | `generation_id` | `ai_generations.id` | set null |
| `generation_fingerprints` | `owner_id` | `profiles.id` | cascade |
| `generation_fingerprints` | `page_id` | `pages.id` | cascade |

Todas las claves foráneas usan `ON UPDATE no action`. Eliminar un `Profile` elimina en cadena todos sus datos, y eliminar una `Page` elimina sus adjuntos, importaciones, tarjetas, ítems, dominio, sesiones, preguntas y huellas. Hay tres excepciones a `cascade`: `generation_id` (y `ai_generations.page_id`) queda nulo si se borra la generación o la página auditada; `exam_page_state.last_passed_session_id` y `exam_sessions.retake_of_session_id` quedan nulos si se borra la sesión referida; y las dos claves de linaje de `exam_questions` son `no action`, de modo que una raíz o una pregunta reemplazada no se puede borrar sola mientras existan sus variantes (el borrado de la página o del dueño las elimina juntas). Las referencias polimórficas (`study_items.source_id`, `review_logs.session_id`, `session_feedback.session_id`) no tienen FK física.

### 2.7 Estrategia de migraciones

Incremental-aditiva: cada cambio de esquema es un nuevo archivo `NNNN_nombre.sql` generado por `drizzle-kit generate` (nunca se edita una migración ya aplicada), registrado en `drizzle/meta/_journal.json` (15 entradas, de `0000_profiles` a `0014_document_formats`): `0000` crea `profiles`, `0001` activa su RLS, `0002` la ata a `auth.users`, `0003` crea `notebooks`, `pages` y `page_assets`, `0004` el bucket `page-assets`, `0005` `import_jobs`, `0006` el bucket `page-pdfs`, `0007` `ai_generations` y `flashcards`, `0008` las columnas de términos de `profiles`, `0009` las cinco tablas de `study-engine` y `flashcards.archived_at` (con relleno de ítems), `0010` las cuatro tablas de `exams`, `0011` `exam_sessions.question_ids`, `0012` las tres tablas de `active-recall`, `0013` `generation_fingerprints` y `0014` las columnas `format` y `skipped_images` de `import_jobs` junto con los tipos MIME de DOCX y PPTX del bucket `page-pdfs`. `drizzle-kit` no tiene comando `down`: 13 de las 15 migraciones (`0002` a `0014`) traen un `.down.sql` hermano con la reversión manual, pensado para aplicarse a mano con `psql` o el editor SQL de Supabase; las dos primeras (`0000` crea la tabla, `0001` activa RLS) no lo tienen. Las migraciones de Storage (`0004`, `0006`) son idempotentes por diseño (`on conflict (id) do update`; `0014` actualiza el mismo bucket con un `update` que también puede repetirse), para que la misma migración sea la fuente de verdad de los límites del bucket tanto en `cogni-dev` como en `cogni-prod`; las de tablas son SQL generado, salvo los bloques escritos a mano de `0002` (guarda y limpieza de huérfanos), `0009` (relleno de `study_items`) y el comentario de `0011`.

Las migraciones se aplican exclusivamente durante la construcción de producción en Vercel, nunca en previsualizaciones (`package.json`: `"build": "node scripts/migrate-in-build.mjs && next build"`). `scripts/migrate-in-build.mjs` expone el predicado puro `shouldRunMigrations(env)`, verdadero solo si `env.VERCEL_ENV === "production"` o `env.RUN_DB_MIGRATIONS === "1"` (esta última, una escotilla para migrar manualmente contra `cogni-dev` sin desplegar). Cuando el predicado es verdadero ejecuta `pnpm exec drizzle-kit migrate`; en cualquier otro caso lo omite con un mensaje en consola. `drizzle.config.ts` fija `dialect: "postgresql"`, `schema: "./src/shared/db/schema.ts"` y `out: "./drizzle"`.

---

## 3. Motor de repetición espaciada (SM-2)

**Implementado en la Fase 4** (`docs/adr/0005-motor-de-repeticion-y-flashcards.md`). La especificación proviene de `docs/documento-maestro.md` §7.1–§7.5 y corresponde a los requisitos RF-SE-01 a RF-SE-04 (motor), RF-FC-03 (calidad por técnica en flashcards), RF-EX-03 a RF-EX-06 (corrección y repetición de exámenes) y RF-AR-04 a RF-AR-05 (calidad combinada y señales metacognitivas de recordación activa), todos Implementados en `01-SRS.md` §4. La entrada pública `src/modules/study-engine/index.ts` exporta el dominio puro (`applySm2`, `computeMastery`, `MASTERY_LEVELS`, `CONSOLIDATING_THRESHOLD`/`MASTERED_THRESHOLD` desde `src/shared/kernel/mastery-thresholds.ts`, `STABILITY_HORIZON_DAYS`, `FLASHCARD_QUALITY`, `EXAM_REVIEW_QUALITY`, `examReviewQualityFor`, `recallReviewQualityFor`, `INITIAL_EASINESS`, `MIN_EASINESS`, `newStudyItem`, `newFlashcardSession`, las funciones de `SessionFeedback` y `STUDY_ENGINE_ERROR`) y las fábricas de servidor de `server-api.ts`: `createFlashcardSessionsServerApi`, `createExamReviewRecorder`, `createRecallReviewRecorder`, `createMasteryRecomputeJob`, `createPageMasteryReader`, `createSessionFeedbackSources` y `createStudyItemRepository`.

El motor decide, de forma transversal a las tres técnicas de estudio (flashcards, exámenes, recordación activa), cuándo debe repasarse cada `StudyItem` y qué nivel de dominio tiene cada `Page`. Es el único módulo autorizado a calcular fechas de vencimiento (documento-maestro §3.4); ningún otro módulo calcula vencimientos fuera de él.

### 3.1 Algoritmo SM-2 por ítem (documento-maestro §7.1)

Entrada: una calidad de respuesta `q` entera entre 0 y 5. Reglas (verbatim):

- Si `q < 3`: `repetitions = 0`, `interval_days = 1` (el ítem vuelve a empezar su secuencia de intervalos).
- Si `q >= 3`:
  - `repetitions == 0` → `interval_days = 1`.
  - `repetitions == 1` → `interval_days = 6`.
  - `repetitions >= 2` → `interval_days = round(interval_days_previo * easiness)`.
  - `repetitions += 1`.
- `easiness = easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))`, con un piso `easiness = max(easiness, 1.3)`.
- `due_at = ahora + interval_days` días.
- `lapses += 1` cuando `q < 3`.

Implementado como la función pura `applySm2(state, quality, now): Result<Sm2State, DomainError>` (`src/modules/study-engine/domain/sm2.ts`): una calidad fuera de 0–5 responde `STUDY_ENGINE_INVALID_QUALITY`; el intervalo usa el `easiness` previo a la actualización de este repaso, y "`interval_days` días" son `interval_days × 24 h` en UTC. Sus pruebas cubren el primer, segundo y tercer repaso, el fallo después de un éxito, el `easiness` mínimo y los extremos `q = 0` y `q = 5`.

### 3.2 Mapeo de calidad por técnica (documento-maestro §7.2)

| Técnica | Entrada del estudiante | Calidad (q) |
|---|---|---|
| Flashcards | Botón "Otra vez" | 1 |
| Flashcards | Botón "Difícil" | 3 |
| Flashcards | Botón "Bien" | 4 |
| Flashcards | Botón "Fácil" | 5 |
| Exámenes | Respuesta incorrecta | 1 |
| Exámenes | Respuesta correcta | 4 |
| Recordación activa | Calidad combinada (ver §3.3) | 0–5 (redondeada) |

Compuerta de vencimiento: una tarjeta solo se califica si su ítem está vencido (`STUDY_ENGINE_ITEM_NOT_DUE` en otro caso). En exámenes y recordación activa, una calidad < 3 siempre se registra y una ≥ 3 solo si el ítem estaba vencido (`examReviewQualityFor`, `recallReviewQualityFor`); un ítem suspendido no se registra.

### 3.3 Calidad combinada en recordación activa (documento-maestro §7.4)

`combined = round(0.6 * ai_score + 0.4 * self_rating)`, donde `ai_score` y `self_rating` son enteros de 0 a 5. Señales metacognitivas: `self_rating >= 4 and ai_score <= 2` marca exceso de confianza; `self_rating <= 1 and ai_score >= 4` marca falta de confianza. Se registran las tres señales (puntaje crudo de IA, autoevaluación y calidad combinada) en `RecallAnswer`.

Implementado en la Fase 6 (`docs/adr/0007`): `combinedQuality` y `calibrationOf` (`src/modules/active-recall/domain/recall-answer.ts`). La señal metacognitiva se deriva al leer los resultados y no se guarda. Solo una respuesta `done` alimenta SM-2 (`recordRecallReviews` de `study-engine`, `ReviewLog.session_kind = recall`): calidad < 3 siempre; ≥ 3 solo si el ítem está vencido.

### 3.4 Nivel de dominio por página (documento-maestro §7.3)

Para cada ítem `i` de una página: `estabilidad_i = min(1, interval_days_i / 21)`; `acierto_i = 1` si `last_quality_i >= 3`, en otro caso `0`; `aporte_i = 0.6 * estabilidad_i + 0.4 * acierto_i`. El puntaje de la página es `score = promedio(aporte_i)` sobre todos sus ítems. Niveles resultantes:

| Condición | Nivel |
|---|---|
| Página sin ítems | Nuevo |
| `score < 0.35` | Aprendiendo |
| `0.35 <= score < 0.70` | Consolidando |
| `score >= 0.70` | Dominado |

Implementado como `computeMastery` (`src/modules/study-engine/domain/mastery.ts`, horizonte `STABILITY_HORIZON_DAYS = 21`), que omite los ítems suspendidos; los umbrales 0.35 y 0.70 son `CONSOLIDATING_THRESHOLD` y `MASTERED_THRESHOLD` de `src/shared/kernel/mastery-thresholds.ts`, compartidos con `src/shared/ui/mastery-level.ts`. El resultado se guarda en `page_mastery`. "Hoy" ordena las páginas por `due_at` mínimo entre sus ítems vencidos (la que más esperó primero); el dashboard muestra `level` y `score` por página.

### 3.5 Repetición de exámenes (documento-maestro §7.5)

Al terminar una `ExamSession` (solo con todas sus preguntas respondidas; `EXAMS_SESSION_INCOMPLETE` en otro caso): `score = correct / total` y `passed = score >= 0.70` (`EXAM_PASS_THRESHOLD`). Las respuestas alimentan el `StudyItem` de su raíz con `q = 1` si fue incorrecta y `q = 4` si fue correcta y el ítem estaba vencido (§3.2). Si no aprueba, el `ExamPageState` de la página pasa a `retake_pending = true` con `failed_root_ids` poblado; si aprueba, ese estado se limpia y `last_passed_session_id` apunta a la sesión. Mientras haya una repetición pendiente no se puede iniciar un examen normal (`EXAMS_RETAKE_PENDING`). En la repetición (N de 10 a 30 y nunca menor que el número de raíces falladas), cada raíz fallada vuelve primero como una variante generada por IA con una redacción nunca usada en su linaje (`origin = ai_variant`, `variant_of` = la pregunta mostrada en el examen fallado, mismo `root_id`); la redacción reemplazada queda `retired_at`, y la sesión se completa con el resto de las preguntas de la página hasta N (decisión de usuario del 2026-10-05, `docs/adr/0006`). Si la generación de variantes falla (también tras el reintento en otro proveedor) o repite una redacción, la repetición se bloquea con `EXAMS_RETAKE_VARIANT_MISSING` sin guardar nada ni consumir el límite diario. Si el estudiante retiró todas las preguntas de los conceptos fallados, la repetición pendiente se limpia y la página vuelve a admitir un examen normal.

### 3.6 Columnas de estado por `StudyItem`

| Columna | Tipo | Valor inicial | Descripción |
|---|---|---|---|
| `easiness` | double precision | 2.5 | Factor de facilidad (EF); nunca baja de 1.3 (`CHECK study_items_easiness_min`). |
| `interval_days` | integer | 0 | Intervalo en días hasta el próximo repaso. |
| `repetitions` | integer | 0 | Repasos consecutivos exitosos (`n` en la fórmula SM-2). |
| `due_at` | timestamptz | fijado por la aplicación al crear el ítem (sin valor por defecto en la base de datos) | Fecha de vencimiento del ítem. |
| `last_quality` | integer | nulo | Última calidad (`q`, 0–5) registrada. |
| `last_reviewed_at` | timestamptz | nulo | Fecha del último repaso. |
| `lapses` | integer | 0 | Número de veces que `q < 3`. |
| `suspended_at` | timestamptz | nulo | Fecha de suspensión del ítem: se fijaba al archivar su tarjeta o al retirar la última pregunta activa de su linaje de examen (antes de la Fase 8; hoy borrar un ítem borra su fila); un ítem suspendido no vence ni cuenta para el dominio. |

---

## 4. Contrato de API

### 4.1 `identity`

Corresponden a CU-01 (Registro e inicio de sesión) y CU-02 (Recuperar contraseña), y a los requisitos RF-ID-01 a RF-ID-09 del componente `identity` (tabla de componentes, `02-SAD.md` §4.1). Todas las funciones siguientes son Server Actions (`"use server"`, `src/modules/identity/actions.ts`); ninguna declara `maxDuration`. Las acciones de formulario reciben `(_previous: AuthFormState, formData: FormData)` (firma de `useActionState`) y devuelven `AuthFormState { status, message }` o redirigen. La validación depende de la acción: `signUpAction` y `signInAction` validan `credentialsSchema` (`email` válido, `password` de al menos 8 caracteres); `requestPasswordResetAction` valida solo `email`; `updatePasswordAction` solo `password`; `signOutAction` y `signInWithGoogleAction` no reciben entrada. Los mensajes en español salen de `messageForCode` (`src/modules/identity/ui/auth-copy.ts`).

| Acción | Parámetros | Retorno | Auth | Errores |
|---|---|---|---|---|
| `signUpAction` | `_previous`, `formData` (`email`, `password`) | `AuthFormState` | No requiere sesión | `AUTH_INVALID_INPUT`, `AUTH_PROVIDER_UNAVAILABLE` |
| `signInAction` | `_previous`, `formData` (`email`, `password`) | `AuthFormState` o redirección a `/` | No requiere sesión | `AUTH_INVALID_INPUT`, `AUTH_INVALID_CREDENTIALS`, `AUTH_EMAIL_NOT_VERIFIED`, `AUTH_PROVIDER_UNAVAILABLE` |
| `signOutAction` | — | `{ status: "error"; message }` o redirección a `/login` | Requiere sesión | `AUTH_PROVIDER_UNAVAILABLE` |
| `requestPasswordResetAction` | `_previous`, `formData` (`email`) | `AuthFormState` | No requiere sesión | `AUTH_INVALID_INPUT`, `AUTH_PROVIDER_UNAVAILABLE` |
| `updatePasswordAction` | `_previous`, `formData` (`password`) | `AuthFormState` o redirección a `/` | Requiere sesión de recuperación | `AUTH_INVALID_INPUT`, `AUTH_PROVIDER_UNAVAILABLE` |
| `signInWithGoogleAction` | — | Redirección a Google OAuth o a `/login?error=google` | No requiere sesión | `AUTH_PROVIDER_UNAVAILABLE` (no se devuelve como valor; solo redirige) |
| `acceptTermsAction` (puerta de términos) | `_previous`, `formData` (`accept` = `"on"` si se marcó la casilla, `next`) | `AuthFormState` o redirección a `next` (sanitizado con `safeNext`) | Requiere sesión (sin ella, redirección a `/login`) | `TERMS_NOT_ACCEPTED`, `PROFILE_NOT_FOUND`. Guarda `terms_accepted_version = TERMS_VERSION` y `terms_accepted_at`; registra `terms_accepted` de forma diferida (`after()`) |
| `updateTimeZoneAction` (Fase 7) | `_previous: TimeZoneFormState`, `formData: FormData` (`timeZone`, nombre IANA) | `TimeZoneFormState { status, message?, timeZone? }` (zona canónica guardada) | Requiere sesión | `PROFILE_INVALID_TIME_ZONE` (texto propio); cualquier otro fallo, texto genérico. Nunca lanza |
| `adoptBrowserTimeZoneAction` (Fase 7) | `timeZone: string` | `{ ok: true; adopted: boolean }` o `{ ok: false }` | Requiere sesión | Silenciosa: solo guarda mientras el perfil sigue en `UTC`; nunca lanza |

`signUpAction` trata la respuesta `outcome === "already_registered"` de Supabase (correo ya existente) como un caso de éxito con mensaje de error de dominio (`AUTH_COPY.alreadyRegistered`), no como un `DomainError`; con un `userId`, registra `user_signed_up` de forma diferida. `signInAction` registra `user_signed_in` de forma diferida.

Marca del flujo de Google (`src/modules/identity/domain/auth-flow.ts`): `signInWithGoogleAction` pide la URL de OAuth con `redirectTo` exactamente igual a `${siteUrl()}/auth/callback` (Supabase lo compara con su lista de Redirect URLs) y, solo si la obtiene, fija la cookie `cogni_auth_flow=google` (`httpOnly`, `secure` en producción, `sameSite=lax`, `path=/auth/callback`, `maxAge` 600 s). `signUpAction` y `requestPasswordResetAction` borran una marca vieja de un intento de Google abandonado (misma ruta, `maxAge` 0), para que un enlace de correo fallido posterior no se informe como un inicio con Google cancelado. El uso de la marca se describe en Route Handlers (`/auth/callback`).

### 4.2 `notebooks`

Corresponden a CU-03 (Crear y organizar cuadernos y páginas) y CU-04 (Escribir apuntes en el editor), y a los requisitos RF-NB-01 a RF-NB-08 y RF-ED-01, RF-ED-05 y RF-ED-07 (componentes `notebooks` y `editor`, `02-SAD.md` §4.1). Server Actions (`"use server"`, `src/modules/notebooks/actions.ts`). Las siete primeras filas (las mutaciones de cuadernos y páginas) usan `requireOwnerId()` (lanza una excepción si no hay sesión, capturada por el manejador de errores de Next.js) y `unwrap()` (convierte un `DomainError` en una excepción con el mensaje en español de `notebooks-copy.ts`); las lecturas `getSidebarTree`, `listPagesForMention`, `getHomeOverview`, `getNotebookForRoute` y `getPageForRoute` también usan `requireOwnerId()`. Las marcadas "Result-returning" usan `requireOwnerIdResult()` y nunca lanzan: devuelven `Result<T, ActionError>` para que `editor`'s `useAutosave` pueda reconciliar un conflicto sin que el Server Action arroje una excepción.

| Acción | Parámetros | Retorno | Auth | Errores |
|---|---|---|---|---|
| `createNotebook` | `{ title: string; icon?: string o null; color?: string o null }` | `Notebook` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `NOTEBOOK_INVALID_TITLE`, `NOTEBOOK_INVALID_COLOR` |
| `renameNotebook` | `{ notebookId: string; title: string }` | `Notebook` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `NOTEBOOK_NOT_FOUND`, `NOTEBOOK_INVALID_TITLE` |
| `setNotebookAppearance` | `{ notebookId: string; icon?: string o null; color?: string o null }` | `Notebook` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `NOTEBOOK_NOT_FOUND`, `NOTEBOOK_INVALID_COLOR` |
| `createPage` | `{ notebookId: string; title?: string }` | `Page` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `NOTEBOOK_NOT_FOUND`, `NOTEBOOK_ARCHIVED` |
| `renamePage` | `{ pageId: string; title: string }` | `Page` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `PAGE_NOT_FOUND` |
| `previewNotebookDeletion` | `{ notebookId: string }` (Result-returning) | `Result<NotebookDeletionPreview, ActionError>` (`pages`, `decks`, `recallSets`, `examSets`), el recuento del diálogo de confirmación | Requiere sesión (Result) | `NOTEBOOK_NOT_FOUND` (también id malformado o ajeno) |
| `deleteNotebook` | `{ notebookId: string }` (Result-returning) | `Result<{ notebookId: string }, ActionError>`; borrado real del cuaderno y todo lo suyo, luego Storage | Requiere sesión (Result) | `NOTEBOOK_NOT_FOUND` |
| `previewPageDeletion` | `{ pageId: string }` (Result-returning) | `Result<PageDeletionPreview, ActionError>` (`flashcards`, `recallQuestions`, `examQuestions`, `images`) | Requiere sesión (Result) | `PAGE_NOT_FOUND` |
| `deletePage` | `{ pageId: string }` (Result-returning) | `Result<{ pageId: string }, ActionError>`; borrado real de la página y todo lo suyo, luego Storage | Requiere sesión (Result) | `PAGE_NOT_FOUND` |
| `getPagePickerTree` | — | `PagePickerNotebookEntry[]`: cuadernos y páginas activas con las palabras de cada página contadas en el servidor (sin enviar `plain_text`), para los selectores de página de los centros (mínimo de palabras de H14) | Requiere sesión (lanza) | — |
| `getSidebarTree` | — | `SidebarNotebook[]` | Requiere sesión (lanza) | — (sin canal de `DomainError`) |
| `listPagesForMention` | — | `MentionPageCandidate[]` (`id`, `title`, `notebookId`, `notebookTitle`, `notebookColor`): las páginas activas del árbol del sidebar, para el menú de menciones del editor | Requiere sesión (lanza) | — (sin canal de `DomainError`) |
| `getHomeOverview` | — | `HomeOverview` (ver ejemplo abajo) | Requiere sesión (lanza) | — (sin canal de `DomainError`) |
| `saveContent` | `{ pageId: string; expectedVersion: number; content: TiptapDoc }` (Result-returning) | `Result<{ version: number }, ActionError>` | Requiere sesión (Result) | `NOTEBOOKS_SESSION_REQUIRED`, `NOTEBOOKS_INVALID_INPUT`, `PAGE_NOT_FOUND`, `PAGE_VERSION_CONFLICT` |
| `getCurrentContent` | `pageId: string` (Result-returning) | `Result<{ content: TiptapDoc; version: number }, ActionError>` | Requiere sesión (Result) | `NOTEBOOKS_SESSION_REQUIRED`, `NOTEBOOKS_INVALID_INPUT`, `PAGE_NOT_FOUND` |
| `getNotebookForRoute` | `notebookId: string` | `{ notebook: Notebook; pages: Page[] } o null` | Requiere sesión (lanza) | — (foráneo/archivado degrada a `null`) |
| `getNotebookTitleForRoute` | `notebookId: string` | `string o null` | Requiere sesión (nunca lanza: degrada a `null`) | — |
| `requestImageUpload` | `{ pageId: string; mime: string; sizeBytes: number }` (Result-returning) | `Result<ImageUploadGrant, ActionError>` | Requiere sesión (Result) | `NOTEBOOKS_SESSION_REQUIRED`, `NOTEBOOKS_INVALID_INPUT`, `PAGE_NOT_FOUND`, `ASSET_MIME_NOT_ALLOWED`, `ASSET_TOO_LARGE` |
| `registerPageAsset` | `{ pageId: string; storagePath: string; mime: string; sizeBytes: number }` (Result-returning) | `Result<PageAsset, ActionError>` | Requiere sesión (Result) | `NOTEBOOKS_SESSION_REQUIRED`, `NOTEBOOKS_INVALID_INPUT`, `PAGE_NOT_FOUND`, `ASSET_PATH_OUT_OF_SCOPE`, `ASSET_FORBIDDEN`, `ASSET_MIME_NOT_ALLOWED`, `ASSET_TOO_LARGE` |
| `getAssetReadUrl` | `{ assetId: string }` (Result-returning) | `Result<{ url: string }, ActionError>` | Requiere sesión (Result) | `NOTEBOOKS_SESSION_REQUIRED`, `NOTEBOOKS_INVALID_INPUT`, `ASSET_FORBIDDEN` |
| `getPageForRoute` | `notebookId: string, pageId: string` | `Page o null` | Requiere sesión (lanza) | — (parámetros inválidos o página de otro cuaderno degradan a `null`) |

`registerPageAsset` nunca confía en el `mime`/`sizeBytes` que declara el cliente para el registro final: obtiene los metadatos reales del objeto de Storage (`getObjectMetadata`) antes de validarlos.

Ejemplo de retorno no trivial (`getHomeOverview`):

```json
{
  "notebookCount": 3,
  "pageCount": 12,
  "pagesEditedThisWeek": 4,
  "lastActivityAt": "2026-09-24T18:32:00.000Z",
  "notebooks": [
    { "id": "0197...", "title": "Cálculo II", "icon": "📐", "color": "blue", "pageCount": 5, "updatedAt": "2026-09-24T18:32:00.000Z" }
  ],
  "recentPages": [
    { "id": "0197...", "notebookId": "0197...", "notebookTitle": "Cálculo II", "title": "Series de Taylor", "updatedAt": "2026-09-24T18:32:00.000Z" }
  ]
}
```

#### `notebooks/server-api.ts` (composición interna, sin `"use server"`)

`createNotebooksServerApi({ db, clock? }): NotebooksServerApi` no es un punto de entrada alcanzable por el cliente: lo consumen en el mismo proceso del servidor `ingestion` (`ingestion/infrastructure/notebooks-pages-adapter.ts`), `flashcards` (`actions.ts`, `session-actions.ts`), `exams` (`actions.ts`, `session-actions.ts`, `feedback-actions.ts`, `retake-actions.ts`) y `active-recall` (`actions.ts`, `session-actions.ts`, `evaluation-runner.ts`). `NotebooksServerApi` extiende `PageTextReader` (`notebooks/domain/page-text-reader.ts`), de donde hereda `getPageText`; tiene siete métodos.

| Método | Parámetros | Retorno | Auth | Errores |
|---|---|---|---|---|
| `findActiveNotebook` | `ownerId: string, notebookId: string` | `{ id: string } o null` | N/A — invocado en proceso, no expuesto a cliente | — |
| `createPage` | `ownerId: string, { notebookId: string; title?: string }` | `Result<{ id: string; notebookId: string }, DomainError>` | N/A | `NOTEBOOK_NOT_FOUND`, `NOTEBOOK_ARCHIVED` |
| `writeImportedContent` | `ownerId: string, { pageId: string; content: TiptapDoc; expectedVersion: number }` | `Result<{ version: number }, DomainError>` | N/A | `PAGE_NOT_FOUND`, `PAGE_VERSION_CONFLICT`, `PAGE_INVALID_CONTENT` (contenido fuera del catálogo estricto) |
| `storeImportedAsset` | `ownerId: string, { pageId: string; bytes: Uint8Array; mime: string }` | `Result<{ assetId: string }, DomainError>` | N/A | `ASSET_MIME_NOT_ALLOWED`, `ASSET_TOO_LARGE`, `PAGE_NOT_FOUND`, `ASSET_UPLOAD_FAILED` |
| `deleteImportedAssets` | `ownerId: string, assetIds: readonly string[]` | `Promise<void>` (limpieza de mejor esfuerzo; nunca lanza) | N/A | — |
| `getPageText` (de `PageTextReader`) | `pageId: string, ownerId: string` | `Result<{ title: string; plainText: string }, DomainError>` | N/A | `PAGE_NOT_FOUND` (página inexistente, de otro dueño o archivada) |
| `findPageNotebookId` | `ownerId: string, pageId: string` | `string o null` | N/A | — |

`getPageText` es la única lectura del texto de una página que usan las técnicas de estudio (generación, retroalimentación y evaluación de IA) y su comprobación de propiedad de la página. Nótese el orden de parámetros: `getPageText` recibe `(pageId, ownerId)`, al revés que los otros cuatro métodos.

`writeImportedContent` usa un esquema Zod `.strict()`: un campo extra (por ejemplo `plainText`) invalida toda la entrada, a diferencia de `saveContent`, que descarta silenciosamente un `plain_text` enviado por el cliente. Desde `docs/adr/0009`, `content` se valida además con `tiptapContentSchema`, la lista de permitidos construida desde `src/shared/kernel/tiptap-catalogue.ts`: rechaza nodos, marcas o atributos desconocidos, valores inválidos, anidamientos incorrectos, nodos de texto vacíos y enlaces que no sean `http`, `https` o `mailto`. `storeImportedAsset` sube la imagen a `{ownerId}/{pageId}/{fileId}.{ext}` con la clave de servicio y reutiliza `registerPageAsset`; la validación de tipo, tamaño y propiedad la hace el caso de uso, no la RLS del bucket.

### 4.3 `ingestion`

Corresponden a CU-05 (Importar documento) y a los requisitos RF-IN-01 a RF-IN-11 (componente `ingestion`, `02-SAD.md` §4.1), además de RNF-P-01 y RNF-P-02 (presupuesto de tiempo y tamaño máximo del documento). Las acciones conservan sus nombres de la era PDF, pero aceptan PDF, Word (`.docx`) y PowerPoint (`.pptx`); `mime` debe ser `application/pdf` o el tipo de DOCX o de PPTX. Server Actions (`"use server"`, `src/modules/ingestion/actions.ts`). Las cinco están envueltas en `withBoundary()`: cualquier excepción no prevista se reporta a Sentry y se convierte en `INGESTION_UNEXPECTED` en vez de propagarse al cliente. `processPdfImport` es la única de duración larga, acotada por `maxDuration = 120` en `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`.

| Acción | Parámetros | Retorno | Auth | Errores |
|---|---|---|---|---|
| `requestPdfUpload` | `{ notebookId: string; fileName: string; mime: string; sizeBytes: number }` | `Result<PdfUploadGrant, ActionError>` | Requiere sesión (Result) | `INGESTION_SESSION_REQUIRED`, `INGESTION_INVALID_INPUT`, `DOCUMENT_FILE_NAME_INVALID`, `DOCUMENT_MIME_NOT_ALLOWED`, `DOCUMENT_TOO_LARGE`, `INGESTION_NOTEBOOK_NOT_FOUND`, `INGESTION_RATE_LIMITED` (más de 20 permisos de subida en una hora), `INGESTION_STORAGE_UNAVAILABLE`, `INGESTION_UNEXPECTED` |
| `startPdfImport` | `{ notebookId: string; storagePath: string; fileName: string; mime: string; sizeBytes: number }` | `Result<StartPdfImportResult, ActionError>` | Requiere sesión (Result) | `INGESTION_SESSION_REQUIRED`, `INGESTION_INVALID_INPUT`, `DOCUMENT_PATH_OUT_OF_SCOPE`, `DOCUMENT_UPLOAD_EXPIRED`, `DOCUMENT_OBJECT_MISSING`, `DOCUMENT_MIME_NOT_ALLOWED`, `DOCUMENT_TOO_LARGE` (revalidación de los metadatos reales del objeto con `validateDocumentInput`), `DOCUMENT_UNSUPPORTED_FORMAT` (el tipo real del objeto no es el formato que declara su ruta), `INGESTION_RATE_LIMITED` (más de 10 inicios en una hora o ya hay 3 importaciones activas), `INGESTION_NOTEBOOK_NOT_FOUND`, `INGESTION_NOTEBOOK_MISMATCH`, `NOTEBOOK_NOT_FOUND`, `NOTEBOOK_ARCHIVED` (de `notebooks` al crear la página, si el cuaderno se archivó entre la comprobación y la creación), `INGESTION_PAGE_NOT_FOUND`, `INGESTION_STORAGE_UNAVAILABLE`, `INGESTION_UNEXPECTED` |
| `processPdfImport` | `{ importJobId: string }` | `Result<ImportJobStatusView, ActionError>` | Requiere sesión (Result) | `INGESTION_SESSION_REQUIRED`, `INGESTION_INVALID_INPUT`, `IMPORT_JOB_NOT_FOUND`, `INGESTION_UNEXPECTED` |
| `getImportJobStatus` | `{ pageId: string }` | `Result<ImportJobStatusView o null, ActionError>` (`null` también para la página de otro estudiante) | Requiere sesión (Result) | `INGESTION_SESSION_REQUIRED`, `INGESTION_INVALID_INPUT`, `INGESTION_UNEXPECTED` |
| `getActiveImports` | — | `Result<string[], ActionError>` | Requiere sesión (Result) | `INGESTION_SESSION_REQUIRED`, `INGESTION_UNEXPECTED` |

`processPdfImport` nunca devuelve un error de dominio por un documento ilegible, sin texto, con conflicto de persistencia o por tiempo agotado: esos desenlaces se registran como el `status`/`error` terminal del propio `ImportJob` (ver §2.5) y se leen a través del mismo `ImportJobStatusView` que devuelven `processPdfImport` y `getImportJobStatus` con éxito (`ok(...)`). Solo se guarda el mensaje; la causa clasifica el reporte a Sentry. Mensajes exactos en español por causa:

| Causa (`IMPORT_FAILURE_KIND`) | Cuándo | Mensaje mostrado al estudiante |
|---|---|---|
| `download` | No se pudo descargar el objeto. | "No pudimos leer el archivo que subiste. Vuelve a importarlo." |
| `invalid_document` | El documento está dañado, cifrado o truncado (un PDF dañado nunca se informa como `no_text_layer`), supera 20 MiB o el extractor falla. | "Este archivo no es un documento válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo." |
| `invalid_document` (límite superado, `DOCUMENT_LIMIT_EXCEEDED`) | El documento supera un límite de importación (ZIP, XML, páginas o caracteres del PDF, límites de contenido de officeparser o memoria de su proceso de pdf.js). | "Este documento es demasiado grande o complejo para importarlo. Divídelo en partes más pequeñas e inténtalo de nuevo." |
| `unsupported_format` | Formato antiguo (`.doc`/`.ppt`), bytes desconocidos, bytes que no son el formato declarado o formato sin adaptador. | "Solo puedes importar archivos PDF, Word (.docx) o PowerPoint (.pptx)." (derivado de `IMPORTABLE_FORMATS`) |
| `no_text_layer` | Un PDF sin texto seleccionable (escaneado). | "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto." |
| `empty_document` | Un Word o un PowerPoint sin texto (en un PowerPoint, ni en las diapositivas ni en las notas). | "El documento no tiene texto que podamos importar." |
| `persistence` | La página cambió durante la importación. | "La página cambió durante la importación, así que no reemplazamos su contenido. Vuelve a importar el documento." |
| `persistence` (página no disponible) | La página destino se archivó o ya no existe. | "La página de destino ya no está disponible. Vuelve a importar el documento." |
| `timeout` | Se agotó el presupuesto de procesamiento. | "La importación tardó demasiado. Inténtalo de nuevo con un documento más pequeño o en unos minutos." |

Una importación terminada (`done`) puede traer `skippedImages > 0`: las imágenes en otros formatos (EMF, WMF, TIFF), de más de 10 MiB, más allá de los topes del documento o que no alcanzaron a subirse se omiten, y la página muestra "No pudimos importar N imágenes de este documento.".

Telemetría: cada transición terminal envía un único evento de PostHog `document_imported` (antes `pdf_imported`) con `page_count`, `pages_without_text`, `duration_ms`, `status` (`done|failed`), `format` (`pdf|docx|pptx`) y `skipped_images` (0 para un job fallido).

`getImportJobStatus` reporta como `status: "failed"` (con el mensaje de `timeout`) cualquier job cuyo último cambio de estado supere `ABANDONED_AFTER_MS` (150 000 ms) sin haber llegado a un estado terminal, aunque nunca escribe ese estado en la base de datos: solo `processPdfImport` puede hacerlo.

Ejemplo de retorno no trivial (`ImportJobStatusView`):

```json
{
  "importJobId": "0197...",
  "pageId": "0197...",
  "status": "failed",
  "pageCount": 12,
  "pagesWithoutText": 0,
  "skippedImages": 0,
  "error": "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto.",
  "createdAt": "2026-09-24T18:00:00.000Z",
  "updatedAt": "2026-09-24T18:01:32.000Z"
}
```

### 4.4 `flashcards`

Corresponden a CU-06 (Generar material de estudio con IA) y CU-07 (Repasar flashcards), y a RF-FC-01 a RF-FC-06 y RF-AI-06 (Fases 3, 4 y 8; `docs/adr/0004`, `docs/adr/0005`). Server Actions (`"use server"`) en `src/modules/flashcards/actions.ts` y `session-actions.ts`, sobre el borde compartido de `action-support.ts`: sesión primero (`FLASHCARDS_SESSION_REQUIRED`, "Debes iniciar sesión para continuar."), entrada validada con Zod (ids `z.uuid()`; `FLASHCARDS_INVALID_INPUT`) y envoltura `withBoundary()` (una excepción no prevista se reporta a Sentry y se convierte en `FLASHCARDS_UNEXPECTED`); nunca lanzan y cada `DomainError` sale como `ActionError`. La tabla lista solo los demás errores. `saveDeckEditsAction` revalida `/flashcards` (`revalidatePath("/flashcards", "layout")`) y `deleteDeckAction` todo el layout (`revalidatePath("/", "layout")`); `generateFlashcardsAction` no revalida. Desde V10 las vistas de tarjeta y de pregunta llevan `updatedAt` (ISO) y cada edición de una página de edición lo devuelve como `expectedUpdatedAt`: si el elemento cambió después (otra pestaña guardó), el guardado se rechaza entero con `FLASHCARD_CHANGED`, `RECALL_QUESTION_CHANGED` o `EXAMS_QUESTION_CHANGED` y nada se escribe.

| Acción | Parámetros | Retorno | Errores propios |
|---|---|---|---|
| `generateFlashcardsAction` | `{ pageId, count? }` (`count` entero de 3 a 20; sin `count`, el servidor pide una tarjeta por cada 15 palabras nuevas, entre 3 y 10) | `Result<GenerationView, GenerationActionError>` (`cards`, `remainingToday`, `truncated`, `wordsUsed`, `wordsTotal`) | `PAGE_NOT_FOUND`, `AI_PAGE_EMPTY`, `AI_PAGE_TOO_SHORT` (menos de 100 palabras nuevas, o de las que pide la cantidad; lleva `words`, `minWords` y `maxItems`; antes del límite diario), `FLASHCARDS_NO_NEW_CONTENT`, `AI_DAILY_LIMIT_REACHED` (con `resetAt` ISO), `AI_GENERATION_FAILED`, `AI_NO_PROVIDER_AVAILABLE` |
| `listFlashcardsAction` | `{ pageId }` | `Result<FlashcardView[], ActionError>` (`id`, `pageId`, `front`, `back`, `position`, `updatedAt`) | — |
| `getGenerationStatusAction` | — | `Result<GenerationStatusView, ActionError>` (`remainingToday`, `resetAt` ISO); solo consulta el límite, no lo consume | — |
| `listDecksAction` | — | `Result<DeckView[], ActionError>` (`pageId`, `notebookId`, `pageTitle`, `notebookTitle`, `notebookColor`, `count`, `latestCardAt` ISO, `nextDueAt` ISO o nulo) | — |
| `saveDeckEditsAction` | `{ pageId, updates: { id, expectedUpdatedAt?, front, back }[], creates: { front, back }[], deletes: id[] }` (hasta 200 por lista; cada lado hasta 1000 caracteres tras recortar espacios) | `Result<DeckEditsView, ActionError>` (`cards`, el mazo guardado); valida todo y luego aplica ediciones, altas a mano (`origin = manual`) y borrados reales (tarjeta, `study_items`, `review_logs` en cascada) en una sola unidad de trabajo (`applyDeckEdits`) | `PAGE_NOT_FOUND`, `FLASHCARD_NOT_FOUND`, `FLASHCARD_CHANGED`, `FLASHCARD_EMPTY`, `FLASHCARD_TOO_LONG`, `FLASHCARD_LAST_CARD` (el mazo conserva al menos una tarjeta) |
| `previewDeckDeletionAction` | `{ pageId }` | `Result<DeckDeletionView, ActionError>` (`cards`, `reviews`) | `FLASHCARD_NOT_FOUND` (página ajena o desconocida) |
| `deleteDeckAction` | `{ pageId }` | `Result<{ pageId }, ActionError>`; borra el mazo completo, sus sesiones de la página, su retroalimentación, sus `study_items` y sus huellas, y recalcula el dominio de la página | `FLASHCARD_NOT_FOUND` |
| `startFlashcardSessionAction` | `{ pageId? }` (sin `pageId`: sesión multipágina de "Hoy") | `Result<ReviewSessionView, ActionError>` (`sessionId`, `cards[]` con `itemId`, `flashcardId`, `front`, `back`, `nextIntervalDays` por botón) | `PAGE_NOT_FOUND`, `STUDY_ENGINE_NOTHING_DUE` |
| `gradeFlashcardAction` | `{ sessionId, itemId, rating }` (`rating`: `again`, `hard`, `good` o `easy`, claves de `FLASHCARD_QUALITY`) | `Result<GradeView, ActionError>` (`reviewedCount`, `againCount`, `masteryLevel`) | `STUDY_ENGINE_SESSION_NOT_FOUND`, `STUDY_ENGINE_SESSION_FINISHED`, `STUDY_ENGINE_ITEM_NOT_FOUND`, `STUDY_ENGINE_ITEM_SUSPENDED`, `STUDY_ENGINE_ITEM_NOT_DUE` |
| `finishFlashcardSessionAction` | `{ sessionId }` | `Result<ReviewSummaryView, ActionError>` (`reviewedCount`, `againCount`; nunca tiempo de estudio) | `STUDY_ENGINE_SESSION_NOT_FOUND` |
| `requestSessionFeedbackAction` | `{ sessionId }` | `Result<SessionFeedbackView, ActionError>` (`status` `pending`/`done`/`failed`, `content` nulo salvo en `done`) | `STUDY_ENGINE_SESSION_NOT_FOUND`, `FLASHCARDS_FEEDBACK_SESSION_OPEN`, `FLASHCARDS_FEEDBACK_NOTHING_REVIEWED` |

`generateFlashcardsAction` es incremental (`docs/adr/0007`): solo envía los párrafos que flashcards aún no usó en la página, truncados a `AI_PAGE_TOKEN_CAP`; sin párrafos nuevos responde `FLASHCARDS_NO_NEW_CONTENT` sin llamar a la IA ni consumir el límite. Consume una unidad del límite diario de generaciones (`limiter.check`) antes de llamar al modelo y registra `generation_requested` en PostHog (con el desenlace `done`, `limit`, `empty`, `no_new_content` o `failed`). Corre bajo `maxDuration = 120` de la ruta del editor que la aloja (`src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`). `requestSessionFeedbackAction` solo consulta el límite (`limiter.peek`) y nunca lo consume; si el límite está agotado o el proveedor falla, responde con éxito y `status: "failed"`, y la sesión queda cerrada igualmente.

### 4.5 `exams`

Corresponden a CU-06 y CU-08 (Presentar un examen) y a RF-EX-01 a RF-EX-08 y RF-AI-06 (Fases 5 y 8, `docs/adr/0006` y su enmienda del 2026-10-29). Server Actions (`"use server"`) en `src/modules/exams/actions.ts`, `session-actions.ts`, `feedback-actions.ts`, `hub-actions.ts`, `retake-actions.ts` y `deletion-actions.ts`, con el mismo borde que flashcards (`action-support.ts`): `EXAMS_SESSION_REQUIRED`, `EXAMS_INVALID_INPUT` y `EXAMS_UNEXPECTED`; nunca lanzan. Las acciones que cambian preguntas (guardar la página de edición y generar), además de iniciar, terminar y repetir un examen, revalidan `/exams`; `deleteExamSetAction` revalida todo el layout (`/`); `answerExamQuestionAction` no revalida. La tabla lista solo los demás errores.

| Acción | Parámetros | Retorno | Errores propios |
|---|---|---|---|
| `listExamQuestionsAction` | `{ pageId }` | `Result<ExamQuestionView[], ActionError>` (`id`, `pageId`, `stem`, `options[4]`, `correctIndex`, `explanation`, `concept`, `origin`, `updatedAt`) | — |
| `saveExamEditsAction` | `{ pageId, updates: { id, expectedUpdatedAt?, stem, options (4), correctIndex (0–3), explanation, concept }[], creates: (sin `id`)[], deletes: id[] }` (hasta 200 por lista; límites tras recortar: enunciado 1000, opción 300, explicación 2000, concepto 120 caracteres; opciones repetidas se rechazan) | `Result<ExamQuestionView[], ActionError>` (las preguntas activas de la página tras guardar); aplica en una transacción (`applyExamEdits`) ediciones en el lugar, altas a mano (`origin = manual`) y borrados reales: cada borrado quita antes el linaje de los exámenes abiertos y de la repetición pendiente (`ExamLineageReferences.dropLineage`) y luego borra el linaje completo con el `study_item` de su raíz; los exámenes terminados conservan su nota (sus respuestas a ese linaje se van en cascada); si la raíz era la última fallada de la repetición pendiente, la repetición deja de estar pendiente | `PAGE_NOT_FOUND`, `EXAMS_QUESTION_NOT_FOUND`, `EXAMS_QUESTION_CHANGED`, `EXAMS_INVALID_QUESTION`, `EXAMS_LAST_QUESTION` |
| `previewExamSetDeletionAction` | `{ pageId }` | `Result<ExamSetDeletionPreview, ActionError>` (`questions`, `attempts`) | `EXAMS_SET_NOT_FOUND` |
| `deleteExamSetAction` | `{ pageId }` | `Result<{ pageId }, ActionError>`; borra todas las preguntas de la página en cualquier estado, sesiones, respuestas, retroalimentación, `study_items`, `exam_page_state` y huellas, y recalcula el dominio | `EXAMS_SET_NOT_FOUND` |
| `generateExamQuestionsAction` | `{ pageId, count? }` (`count` de 10 a 30; 10 por defecto; solo las cantidades que caben en las palabras nuevas, 15 por pregunta) | `Result<ExamGenerationView, ExamGenerationActionError>` (`questions`, `created`, `skipped`, `remainingToday`, `truncated`, `wordsUsed`, `wordsTotal`) | `PAGE_NOT_FOUND`, `AI_PAGE_EMPTY`, `AI_PAGE_TOO_SHORT` (menos de 100 palabras nuevas, o de las que pide la cantidad; lleva `words`, `minWords` y `maxItems`; antes del límite diario), `EXAMS_NO_NEW_CONTENT`, `EXAMS_INVALID_QUESTION_COUNT`, `AI_DAILY_LIMIT_REACHED` (con `resetAt`), `AI_GENERATION_FAILED`, `AI_NO_PROVIDER_AVAILABLE` |
| `getExamStartAction` | `{ pageId }` | `Result<ExamStartView, ActionError>` (`activeQuestionCount`, `retakePending`, `failedRootCount`, `openSessionId`, `openRetakeSessionId`, `lastFinishedSessionId`) | — |
| `startExamSessionAction` | `{ pageId, count? }` (N de 10 a 30; 10 por defecto) | `Result<{ sessionId, resumed }, ActionError>` (reanuda la sesión abierta de la página si existe) | `PAGE_NOT_FOUND`, `EXAMS_RETAKE_PENDING`, `EXAMS_NOT_ENOUGH_QUESTIONS`, `EXAMS_INVALID_QUESTION_COUNT` |
| `getExamSessionAction` | `{ sessionId }` | `Result<ExamSessionView, ActionError>` (`sessionId`, `pageId`, `startedAt`, `finished`, `isRetake`, `questions[]` con su `answer` revelada solo si ya se respondió) | `EXAMS_SESSION_NOT_FOUND` |
| `answerExamQuestionAction` | `{ sessionId, questionId, selectedIndex (0–3) }` | `Result<ExamAnswerView, ActionError>` (`questionId`, `selectedIndex`, `isCorrect`, `correctIndex`, `explanation`, `concept`) | `EXAMS_SESSION_NOT_FOUND`, `EXAMS_SESSION_FINISHED`, `EXAMS_QUESTION_NOT_IN_SESSION`, `EXAMS_DUPLICATE_ANSWER` |
| `finishExamSessionAction` | `{ sessionId }` | `Result<{ sessionId, passed }, ActionError>` | `EXAMS_SESSION_NOT_FOUND`, `EXAMS_SESSION_FINISHED`, `EXAMS_SESSION_INCOMPLETE` |
| `getExamResultsAction` | `{ pageId, sessionId? }` (sin `sessionId`: el último examen terminado de la página) | `Result<ExamResultsView, ActionError>` (`total`, `correct`, `scorePercent`, `passed`, `durationSeconds`, `questions[]`, `failedConcepts[]`, `feedback` o nulo) | `EXAMS_SESSION_NOT_FOUND` (sin examen terminado, sesión abierta o de otra página) |
| `requestExamFeedbackAction` | `{ sessionId }` | `Result<ExamFeedbackView, ActionError>` (`status`, `reused`, `content`) | `EXAMS_SESSION_NOT_FOUND`, `EXAMS_FEEDBACK_SESSION_OPEN` |
| `getExamReviewNoticeAction` | `{ pageId }` | `Result<ExamReviewNotice o null, ActionError>`: conceptos fallados de la repetición pendiente, para el aviso "Repasa antes de repetir el examen" | — |
| `listExamHubAction` | — | `Result<ExamHubPageView[], ActionError>`: páginas con preguntas (sin páginas ni cuadernos archivados), ordenadas por cuaderno y página, con `lastFinishedAt` ISO y conteos de vencidas (nulos si su lectura falla) | — |
| `startExamRetakeAction` | `{ pageId, count }` (N de 10 a 30, obligatorio) | `Result<StartedExamRetakeView, ExamGenerationActionError>`: `{ kind: "started", sessionId, resumed, remainingToday (nulo sin llamada a la IA) }` o `{ kind: "cleared" }` | `PAGE_NOT_FOUND`, `EXAMS_NO_RETAKE_PENDING`, `EXAMS_INVALID_QUESTION_COUNT`, `EXAMS_NOT_ENOUGH_QUESTIONS`, `AI_DAILY_LIMIT_REACHED` (con `resetAt`), `EXAMS_RETAKE_VARIANT_MISSING` |

`generateExamQuestionsAction` es incremental como la de flashcards (sin párrafos nuevos, `EXAMS_NO_NEW_CONTENT` sin llamada ni consumo) y consume una unidad del límite diario de generaciones; una pregunta generada inválida se descarta y cuenta en `skipped`. `startExamRetakeAction` aplica las reglas de §3.5: consulta el límite antes de llamar a la IA y consume una unidad solo cuando la repetición se creó y hubo llamada; revalida también `/notebooks`. `requestExamFeedbackAction` solo consulta el límite y nunca lo consume; un fallo del proveedor responde con éxito y `status: "failed"`, y la retroalimentación de un aprobado se reutiliza tras otro aprobado (`reused`). Las acciones de generación y repetición corren bajo `maxDuration = 120` de la ruta que las aloja: la página del editor y `src/app/(app)/exams/[notebookId]/[pageId]/page.tsx`; las demás rutas de exámenes no declaran `maxDuration`.

### 4.6 `active-recall`

Corresponden a CU-09 y a RF-AR-01 a RF-AR-06, RF-AI-03 y RF-AI-06 (Fases 6 y 8, `docs/adr/0007`). Server Actions (`"use server"`) en `src/modules/active-recall/actions.ts`, `session-actions.ts`, `evaluation-actions.ts`, `hub-actions.ts` y `deletion-actions.ts`. Todas validan la entrada con Zod (ids `z.uuid()`), están envueltas en `withBoundary()` (una excepción no prevista se reporta a Sentry y se convierte en `RECALL_UNEXPECTED`) y nunca lanzan. Todas requieren sesión: sin ella responden `RECALL_SESSION_REQUIRED`; una entrada inválida, `RECALL_INVALID_INPUT`. La tabla lista solo los demás errores.

| Acción | Parámetros | Retorno | Errores propios |
|---|---|---|---|
| `generateRecallQuestionsAction` | `{ pageId }` | `Result<RecallGenerationView, RecallGenerationActionError>` (`questions`, `created`, `skipped`, `remainingToday`, `truncated`, `wordsUsed`, `wordsTotal`) | `PAGE_NOT_FOUND`, `AI_PAGE_EMPTY`, `AI_PAGE_TOO_SHORT` (menos de 100 palabras nuevas, o de las que pide la cantidad; lleva `words`, `minWords` y `maxItems`; antes del límite diario), `RECALL_NO_NEW_CONTENT`, `AI_DAILY_LIMIT_REACHED` (con `resetAt` ISO), `AI_GENERATION_FAILED`, `AI_NO_PROVIDER_AVAILABLE` |
| `listRecallQuestionsAction` | `{ pageId }` | `Result<RecallQuestionView[], ActionError>` (`id`, `pageId`, `prompt`, `keyConcepts`, `acceptableAnswerSummary`, `origin`, `updatedAt`): las preguntas activas de la página, para su página de edición | — |
| `saveRecallEditsAction` | `{ pageId, updates: { id, expectedUpdatedAt?, prompt, keyConcepts[], acceptableAnswerSummary }[], creates: (sin `id`)[], deletes: id[] }` (hasta 200 por lista) | `Result<RecallQuestionView[], ActionError>` (las preguntas de la página tras guardar); aplica en una transacción (`applyRecallEdits`) ediciones, altas a mano (`origin = manual`) y borrados reales (pregunta, respuestas en cascada, `study_item` e historial), bajo el bloqueo de la fila de la página para que dos guardados no borren la última pregunta | `PAGE_NOT_FOUND`, `RECALL_QUESTION_NOT_FOUND`, `RECALL_QUESTION_CHANGED`, `RECALL_INVALID_QUESTION`, `RECALL_LAST_QUESTION` |
| `previewRecallSetDeletionAction` | `{ pageId }` | `Result<RecallSetDeletionPreview, ActionError>` (`questions`, `sessions`) | `RECALL_SET_NOT_FOUND` |
| `deleteRecallSetAction` | `{ pageId }` | `Result<{ pageId }, ActionError>`; borra todas las preguntas de la página, sesiones, respuestas, retroalimentación, `study_items` y huellas, y recalcula el dominio | `RECALL_SET_NOT_FOUND` |
| `getRecallSessionPlanAction` | `{ pageId }` | `Result<RecallSessionPlanView, ActionError>` | — (solo lectura; no crea sesión) |
| `getRecallPageSummaryAction` | `{ pageId }` | `Result<{ questionCount }, ActionError>` | — |
| `startRecallSessionAction` | `{ pageId }` | `Result<StartedRecallSessionView, ActionError>` (`sessionId`, `questions`) | `PAGE_NOT_FOUND`, `RECALL_NO_QUESTIONS` |
| `saveRecallAnswerAction` | `{ sessionId, questionId, answerText (≤ 20 000 caracteres), selfRating }` | `Result<SavedRecallAnswerView, ActionError>` | `RECALL_SESSION_NOT_FOUND`, `RECALL_SESSION_FINISHED`, `RECALL_QUESTION_NOT_IN_SESSION`, `RECALL_INVALID_ANSWER` |
| `finishRecallSessionAction` | `{ sessionId }` | `Result<FinishedRecallSessionView, ActionError>` (`sessionId`, `answeredCount`, `evaluationStatus`) | `RECALL_SESSION_NOT_FOUND` |
| `getRecallSessionResultsAction` | `{ sessionId }` | `Result<RecallSessionResultsView, ActionError>` | `RECALL_SESSION_NOT_FOUND` |
| `retryRecallEvaluationAction` | `{ sessionId }` | `Result<RetriedRecallEvaluationView, ActionError>` | `RECALL_SESSION_NOT_FOUND` |
| `disagreeRecallAnswerAction` | `{ answerId }` | `Result<DisagreedRecallAnswerView, ActionError>` | `RECALL_ANSWER_NOT_FOUND` |
| `listRecallHubAction` | — | `Result<RecallHubView, ActionError>` | — |
| `getRecallSessionReviewAction` | `{ pageId, sessionId }` | `Result<RecallSessionReviewView, ActionError>` | `RECALL_SESSION_NOT_FOUND` |

`finishRecallSessionAction` responde sin esperar a la IA: si la sesión queda `pending`, programa `evaluateRecallSession` con `after()` dentro de `maxDuration = 300` de la ruta de la sesión (`docs/adr/0003`). La evaluación no devuelve errores al cliente: cada respuesta queda `done` o `failed` con su registro crudo (§1, RecallAnswer); dentro de ese registro, `code` puede ser `AI_GENERATION_FAILED`, `AI_DAILY_LIMIT_REACHED`, `AI_NO_PROVIDER_AVAILABLE` (u otro código devuelto por `generateStructured`), `RECALL_QUESTION_NOT_IN_SESSION`, `RECALL_INVALID_SCORE` (puntuación combinada inválida) o `RECALL_UNEXPECTED`. `getRecallSessionResultsAction` vuelve a programar una evaluación cuando la sesión terminada sigue `pending` y ninguna respuesta pendiente se guardó o reclamó dentro del plazo de 6 minutos. `RECALL_INVALID_QUESTION` es interno: una pregunta generada inválida se descarta y cuenta en `skipped`.

### 4.7 `scheduling`

Corresponden a CU-10 y a RF-SC-01 a RF-SC-04 (Fase 7, `docs/adr/0008`). Server Actions (`"use server"`) en `src/modules/scheduling/actions.ts`; sesión primero, nunca lanzan (un error inesperado va a Sentry como `SCHEDULING_UNEXPECTED`; los errores de control de Next.js se relanzan). Sin sesión responden `SCHEDULING_SESSION_REQUIRED`. Solo leen; no tienen límite de tasa.

| Acción | Parámetros | Retorno | Errores propios |
|---|---|---|---|
| `listDueTodayAction` | — | `Result<DueTodayPageView[], ActionError>`: páginas con ítems no suspendidos y `due_at <= now` (sin páginas ni cuadernos archivados), con `due` por técnica y `earliestDueAt`, la que más esperó primero | — |
| `listCalendarDaysAction` | `{ fromDay, toDay, timeZone }` (días ISO locales, `[fromDay, toDay)`) | `Result<CalendarDayPageView[], ActionError>`: por día local y página, los ítems cuyo próximo `due_at` cae ese día; lo vencido, en hoy | `SCHEDULING_INVALID_RANGE` (días no ISO, rango vacío o de más de 42 días, rango que no se solapa con la ventana del calendario —se exige `fromDay <= 9998-12-31` y `toDay > 1970-01-01` (`isValidRange`, `scheduling/calendar-days.ts`)—, o zona inválida) |

Lecturas de servidor sin `"use server"`: `getCalendarDays({ fromDay, toDay, timeZone, now })` (`calendar-days.ts`), la misma lectura con el instante con que pinta `/calendario`; la acción usa siempre el reloj del sistema y nunca acepta uno del cliente. `createSchedulingServerApi({ db, clock? })` (`server-api.ts`) expone `listDueToday(ownerId)` y `listCalendarDays(ownerId, range)` para un dueño ya autenticado (lo usa el hub de exámenes).

### 4.8 `analytics`

Corresponden a CU-11 y a RF-AN-01 a RF-AN-05 (Fase 7, `docs/adr/0008`). Server Actions (`"use server"`) en `src/modules/analytics/actions.ts`, sobre las lecturas compartidas de `dashboard-reads.ts`: sesión primero ("Debes iniciar sesión para continuar.", `ANALYTICS_SESSION_REQUIRED`), luego la entrada, que no es de confianza (se lee dentro del camino protegido y se reduce a sus campos conocidos; nunca trae un reloj), y nunca lanzan (un error inesperado va a Sentry como `ANALYTICS_UNEXPECTED`, "No pudimos cargar tus métricas. Inténtalo de nuevo."). Solo leen; ninguna métrica se guarda.

| Acción | Parámetros | Retorno | Errores propios |
|---|---|---|---|
| `getProgressAction` | `{ timeZone, weeks }` (`weeks` entero de 1 a 26) | `Result<ProgressView, ActionError>`: progreso por página (nivel, puntaje, ítems totales y vencidos, tendencia semanal de calidad) y por cuaderno | `ANALYTICS_INVALID_INPUT` ("El período o la zona horaria no son válidos.") |
| `getTechniqueMetricsAction` | `{ fromDay, toDay, timeZone }` (rango no vacío de hasta 92 días) | `Result<TechniqueMetricsView, ActionError>`: por técnica, repasos completados, tasa de acierto del período y del anterior y racha; repasos por día; totales con `streakDays` y `streakDaysWeekAgo` | `ANALYTICS_INVALID_INPUT` |
| `getCalibrationAction` | `{ fromDay, toDay, timeZone }` (mismo tope de 92 días que `getTechniqueMetricsAction`) | `Result<CalibrationView, ActionError>`: por página, conteos de exceso, falta de confianza y calibradas, y promedios de autoevaluación y puntaje de IA | `ANALYTICS_INVALID_INPUT` |

Lecturas de servidor sin `"use server"` (`dashboard-reads.ts`): `getDashboardProgress`, `getDashboardTechniqueMetrics` (ambas con el `now` con que pinta `/dashboard`) y `getDashboardCalibration`. `createAnalyticsServerApi({ db, clock? })` (`server-api.ts`) expone `getProgress`, `getTechniqueMetrics` y `getCalibration` para un dueño ya autenticado y un rango ya validado. Las definiciones de cada métrica están en `docs/adr/0008`. Las acciones aceptan rangos de hasta 92 días (`MAX_RANGE_DAYS`) y 26 semanas (`MAX_TREND_WEEKS`), pero la interfaz de `/dashboard` solo ofrece 7, 15 y 30 días (`?range=`).

### Route Handlers

| Método | Ruta | Cuerpo | Respuesta | Auth | Descripción |
|---|---|---|---|---|---|
| `GET` | `/api/keep-alive` | — | `{ ok: true }` (200) o vacío (401) | Cabecera `Authorization: Bearer <CRON_SECRET>`, comparada con `timingSafeEqual` | Ejecuta `select 1` para evitar que Supabase Free pause el proyecto por inactividad; Vercel Cron la llama a diario (`0 6 * * *`, `vercel.json`). |
| `GET` | `/api/recompute-mastery` | — | `{ ok: true, pagesRecomputed, pagesFailed, complete }` (200); `{ ok: false }` (500) si falla el listado; vacío (401) con una cabecera incorrecta; vacío (500) si `CRON_SECRET` no está configurado | Cabecera `Authorization: Bearer <CRON_SECRET>`, comparada con `timingSafeEqual` tras comparar longitudes | Recalcula la `PageMastery` de cada página (`createMasteryRecomputeJob` de `study-engine`, documento-maestro §7.3) para que `items_due`, `level` y `score` sigan vigentes aunque nadie repase. `dynamic = "force-dynamic"`, `maxDuration = 300`; deja de empezar páginas 60 s antes del límite (`complete: false`) y las pendientes van primero en la corrida siguiente. Una página fallida se registra en el log con su id y el mensaje de error (sin contenido) y no detiene la corrida. Vercel Cron la llama a diario (`30 6 * * *`). |
| `GET` | `/auth/callback` | Query `code`, `next` | Redirección 302 a `next` (sanitizado con `safeNext`), a `/login?error=google` o a `/login?error=link` | Ninguna (recibe el código PKCE de Supabase Auth) | Intercambia el código de OAuth de Google, verificación de correo o recuperación de contraseña por una sesión. Con éxito redirige a `next` y, si el intercambio trae `userId`, registra `user_signed_in` de forma diferida (`after()`). Si falta el código o el intercambio falla, redirige a `/login?error=google` solo cuando la petición trae la cookie `cogni_auth_flow=google` (fijada por `signInWithGoogleAction`, §4.1; la comparación exige el nombre exacto de la cookie, `isGoogleAuthFlow`), y a `/login?error=link` (enlace inválido o vencido) en cualquier otro caso. Toda respuesta borra la cookie (`path=/auth/callback`, `maxAge` 0) (`src/app/auth/callback/route.ts`). |

### Límites de tasa

Upstash Ratelimit con ventana fija de un día por usuario (`src/modules/ai/infrastructure/upstash-rate-limiter.ts`; documento-maestro §8.3). En `AI_PROVIDER_MODE=fake` (CI y e2e) los mismos límites viven en memoria.

| Límite | Variable (por defecto) | Clave en Redis | Se consume | Al agotarse |
|---|---|---|---|---|
| Generaciones de IA | `AI_DAILY_GENERATIONS` (6) | `{REDIS_KEY_PREFIX}:ai:gen` | Una unidad por "Generar" de flashcards o exámenes (antes de llamar al modelo y después de descartar páginas vacías o sin contenido nuevo); recordación activa la consume solo tras guardar las preguntas; la repetición de un examen, solo cuando se creó con llamada a la IA. La retroalimentación de sesión de flashcards y exámenes solo consulta el límite (`peek`) y nunca lo consume | `AI_DAILY_LIMIT_REACHED` con `resetAt`; la retroalimentación queda `failed` |
| Evaluaciones de recordación activa | `AI_DAILY_EVALUATIONS` (60) | `{REDIS_KEY_PREFIX}:ai:eval` | Una unidad por respuesta evaluada por el modelo, solo si queda `done` (Fase 6); las respuestas saltadas no consumen | La respuesta queda `failed` con `code: "AI_DAILY_LIMIT_REACHED"` y `resetAt`; "Reintentar" la evalúa tras la renovación |

Importación de documentos (`docs/adr/0009`): límites por estudiante con `src/shared/rate-limit` (ventana deslizante de Upstash con `AI_PROVIDER_MODE=live`; ventana fija en memoria en los demás modos), sin variables nuevas. Un error de Upstash falla abierto (se registra); el tope de importaciones activas lo aplica la base de datos.

| Límite | Valor | Clave en Redis | Se consume | Al agotarse |
|---|---|---|---|---|
| `UPLOAD_GRANTS_PER_HOUR` | 20 por hora | `{REDIS_KEY_PREFIX}:rl:import-upload` | En `requestPdfUpload`, después de validar la entrada y antes de pedir la URL firmada | `INGESTION_RATE_LIMITED` |
| `IMPORT_STARTS_PER_HOUR` | 10 por hora | `{REDIS_KEY_PREFIX}:rl:import-start` | En `startPdfImport`, solo para una importación nueva, después de validar el objeto guardado y justo antes de crear la página; una repetición idempotente no consume | `INGESTION_RATE_LIMITED` |
| `MAX_ACTIVE_IMPORTS` | 3 en `queued`/`processing` (sin contar las abandonadas) | — (Postgres) | `ImportJobRepository.create(job, { maxActiveJobs })` cuenta e inserta en una transacción bajo `pg_advisory_xact_lock` por dueño | `INGESTION_RATE_LIMITED` |


### Variables de entorno del contrato

Validadas con Zod al arrancar (`src/shared/config/env.schema.ts`); una cadena vacía cuenta como ausente. Solo se listan las que usan los puntos de entrada de esta sección.

| Variable | Valor (por defecto) | Uso |
|---|---|---|
| `DATABASE_URL` | URL obligatoria | Conexión de servidor (pooler de Supabase) de todas las Server Actions y Route Handlers. |
| `CRON_SECRET` | Texto obligatorio de al menos 32 caracteres | Portador de `/api/keep-alive` y `/api/recompute-mastery`. |
| `SUPABASE_STORAGE_BUCKET`, `SUPABASE_PDF_BUCKET` | Texto obligatorio | Nombres de los buckets de imágenes (`page-assets`) y de documentos importados (`page-pdfs`, nombre histórico de la era PDF). |
| `SUPABASE_SERVICE_ROLE_KEY` | Texto obligatorio | Operaciones de Storage del servidor (URLs firmadas, metadatos). |
| `AI_PROVIDER_MODE` | `live` o `fake` (`live`) | `fake` (CI y e2e) usa un proveedor simulado y límites en memoria. |
| `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`, `OPENROUTER_API_KEY` | Opcionales | Claves de los cuatro proveedores de IA; en modo `live` se exige al menos una de Google, OpenRouter o el par de Cloudflare (que va completo o no va). |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Opcionales; obligatorias en modo `live` | Límites de tasa diarios (Upstash Ratelimit). |
| `REDIS_KEY_PREFIX` | Texto (`cogni:dev`) | Prefijo de las claves de los límites. |
| `AI_DAILY_GENERATIONS` | Entero positivo (6) | Generaciones diarias por usuario. |
| `AI_DAILY_EVALUATIONS` | Entero positivo (60) | Evaluaciones diarias de recordación activa por usuario. |
| `AI_PAGE_TOKEN_CAP` | Entero positivo (12000) | Tope de tokens del texto de página enviado en una generación; lo excedente se trunca (`truncated`, `wordsUsed`, `wordsTotal`). |
| `NEXT_PUBLIC_SITE_URL` | URL obligatoria | Base de `redirectTo` de los flujos de autenticación (`siteUrl()`). |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Opcionales | Eventos de producto (`user_signed_up`, `user_signed_in`, `terms_accepted`, `generation_requested`, …). |

---

## 5. Índices y restricciones

```sql
-- Búsqueda de cuadernos por propietario (sidebar, listSidebar)
CREATE INDEX "notebooks_owner_id_idx" ON "notebooks" USING btree ("owner_id");

-- Árbol del sidebar: páginas de un cuaderno
CREATE INDEX "pages_notebook_id_idx" ON "pages" USING btree ("notebook_id");

-- Adjuntos de imagen de una página
CREATE INDEX "page_assets_page_id_idx" ON "page_assets" USING btree ("page_id");

-- Importaciones de una página y cola de importaciones activas por propietario
CREATE INDEX "import_jobs_page_id_idx" ON "import_jobs" USING btree ("page_id");
CREATE INDEX "import_jobs_owner_status_idx" ON "import_jobs" USING btree ("owner_id","status");

-- Fase 3 — auditoría de IA por dueño y fecha, y por página
CREATE INDEX "ai_generations_owner_created_idx" ON "ai_generations" USING btree ("owner_id","created_at");
CREATE INDEX "ai_generations_page_id_idx" ON "ai_generations" USING btree ("page_id");

-- Fase 3 — mazo de una página en orden, y tarjetas por dueño
CREATE INDEX "flashcards_page_position_idx" ON "flashcards" USING btree ("page_id","position");
CREATE INDEX "flashcards_owner_id_idx" ON "flashcards" USING btree ("owner_id");

-- Fase 4 — ítems vencidos por dueño ("Hoy", calendario, conteos) e ítems de una página
CREATE INDEX "study_items_owner_due_idx" ON "study_items" USING btree ("owner_id","due_at");
CREATE INDEX "study_items_page_id_idx" ON "study_items" USING btree ("page_id");

-- Fase 4 — historial de repasos por ítem y por dueño (dashboard, racha)
CREATE INDEX "review_logs_item_reviewed_idx" ON "review_logs" USING btree ("item_id","reviewed_at");
CREATE INDEX "review_logs_owner_reviewed_idx" ON "review_logs" USING btree ("owner_id","reviewed_at");

-- Fase 4 — dominio, sesiones y retroalimentación por dueño
CREATE INDEX "page_mastery_owner_id_idx" ON "page_mastery" USING btree ("owner_id");
CREATE INDEX "flashcard_sessions_owner_started_idx" ON "flashcard_sessions" USING btree ("owner_id","started_at");
CREATE INDEX "flashcard_sessions_page_id_idx" ON "flashcard_sessions" USING btree ("page_id");
CREATE INDEX "session_feedback_owner_id_idx" ON "session_feedback" USING btree ("owner_id");

-- Fase 5 — preguntas activas de una página y linajes
CREATE INDEX "exam_questions_page_active_idx" ON "exam_questions" USING btree ("page_id","created_at") WHERE "exam_questions"."retired_at" is null;
CREATE INDEX "exam_questions_root_id_idx" ON "exam_questions" USING btree ("root_id");
CREATE INDEX "exam_questions_owner_id_idx" ON "exam_questions" USING btree ("owner_id");

-- Fase 5 — sesiones de una página y del dueño, respuestas y estado de página
CREATE INDEX "exam_sessions_page_finished_idx" ON "exam_sessions" USING btree ("page_id","finished_at");
CREATE INDEX "exam_sessions_owner_started_idx" ON "exam_sessions" USING btree ("owner_id","started_at");
CREATE INDEX "exam_answers_question_id_idx" ON "exam_answers" USING btree ("question_id");
CREATE INDEX "exam_answers_owner_id_idx" ON "exam_answers" USING btree ("owner_id");
CREATE INDEX "exam_page_state_owner_id_idx" ON "exam_page_state" USING btree ("owner_id");

-- Fase 6 — preguntas activas de una página, en orden de creación
CREATE INDEX "recall_questions_page_active_idx" ON "recall_questions" USING btree ("page_id","created_at") WHERE "recall_questions"."archived_at" is null;
CREATE INDEX "recall_questions_owner_id_idx" ON "recall_questions" USING btree ("owner_id");

-- Fase 6 — sesiones de una página y del dueño, la más reciente primero (hub)
CREATE INDEX "recall_sessions_page_started_idx" ON "recall_sessions" USING btree ("page_id","started_at" DESC NULLS LAST);
CREATE INDEX "recall_sessions_owner_started_idx" ON "recall_sessions" USING btree ("owner_id","started_at" DESC NULLS LAST);

-- Fase 6 — respuestas pendientes de una sesión (reclamo de la evaluación)
CREATE INDEX "recall_answers_session_pending_idx" ON "recall_answers" USING btree ("session_id") WHERE "recall_answers"."evaluation_status" = 'pending';
CREATE INDEX "recall_answers_question_id_idx" ON "recall_answers" USING btree ("question_id");
CREATE INDEX "recall_answers_owner_id_idx" ON "recall_answers" USING btree ("owner_id");

-- Fase 6 — huellas por dueño (la clave primaria cubre la lectura por página y técnica)
CREATE INDEX "generation_fingerprints_owner_id_idx" ON "generation_fingerprints" USING btree ("owner_id");
```

Fase 7 (sin índices nuevos): las lecturas de `scheduling` ("Hoy", calendario) y los conteos de ítems de `analytics` usan `study_items_owner_due_idx` (`owner_id`, `due_at`); el historial de repasos del dashboard y la racha usan `review_logs_owner_reviewed_idx` (`owner_id`, `reviewed_at`), ambos de `drizzle/0009_study_engine.sql` (arriba).

```sql
-- Idempotencia de subida: un mismo objeto de Storage se registra una sola vez
CONSTRAINT "page_assets_storage_path_key" UNIQUE("storage_path")
CONSTRAINT "import_jobs_storage_path_key" UNIQUE("storage_path")

-- Estado cerrado de ImportJob sin pgEnum de Postgres
CONSTRAINT "import_jobs_status_check" CHECK ("import_jobs"."status" in ('queued', 'processing', 'done', 'failed'))
-- Formato del documento e imágenes omitidas (0014)
CONSTRAINT "import_jobs_format_check" CHECK ("import_jobs"."format" in ('pdf', 'docx', 'pptx'))
CONSTRAINT "import_jobs_skipped_images_check" CHECK ("import_jobs"."skipped_images" >= 0)

-- Fase 4 — un ítem por fuente, un dominio por página, una retroalimentación por sesión
CONSTRAINT "study_items_kind_source_key" UNIQUE("kind","source_id")
CONSTRAINT "page_mastery_page_id_key" UNIQUE("page_id")
CONSTRAINT "session_feedback_session_key" UNIQUE("session_kind","session_id")

-- Fase 5 — destino de las claves foráneas compuestas del linaje y de exam_answers
CONSTRAINT "exam_questions_id_owner_page_key" UNIQUE("id","owner_id","page_id")
CONSTRAINT "exam_questions_id_root_key" UNIQUE("id","root_id")
-- Fase 5 — una respuesta por pregunta y un concepto por sesión; estado por página
CONSTRAINT "exam_answers_pkey" PRIMARY KEY("session_id","question_id")
CONSTRAINT "exam_answers_session_root_key" UNIQUE("session_id","root_id")
"page_id" uuid PRIMARY KEY NOT NULL -- exam_page_state

-- Fase 6 — destino de las claves foráneas compuestas de recall_answers
CONSTRAINT "recall_questions_id_owner_key" UNIQUE("id","owner_id")
CONSTRAINT "recall_sessions_id_owner_key" UNIQUE("id","owner_id")
-- Fase 6 — una respuesta por pregunta y sesión
CONSTRAINT "recall_answers_session_question_key" UNIQUE("session_id","question_id")
-- Fase 6 — una fila por párrafo (huella) por página, dueño y técnica
CONSTRAINT "generation_fingerprints_pkey" PRIMARY KEY("page_id","owner_id","technique","fingerprint")
```

Restricciones `CHECK` de las Fases 3 a 5 (texto completo en §2.4): `ai_generations_status_check`, `ai_generations_purpose_check`; `flashcards_origin_check`, `flashcards_front_not_blank`, `flashcards_back_not_blank`; `study_items_kind_check`, `study_items_easiness_min`, `study_items_counters_non_negative`, `study_items_last_quality_range`; `review_logs_quality_range`, `review_logs_session_kind_check`; `page_mastery_level_check`, `page_mastery_score_range`; `session_feedback_session_kind_check`, `session_feedback_status_check`; `exam_questions_origin_check`, `exam_questions_options_count`, `exam_questions_correct_index_range`, `exam_questions_stem_not_blank`, `exam_questions_concept_not_blank`, `exam_questions_lineage_check`; `exam_page_state_failed_root_ids_array`; `exam_sessions_requested_count_range`, `exam_sessions_retake_check`, `exam_sessions_result_check`, `exam_sessions_question_ids_check` (`0011`); `exam_answers_selected_index_range`.

Restricciones `CHECK` de la Fase 6 (texto completo en §2.4): `recall_questions_origin_check`, `recall_questions_prompt_not_blank`, `recall_questions_rubric_shape`; `recall_sessions_evaluation_status_check`, `recall_sessions_finished_after_start`; `recall_answers_self_rating_range`, `recall_answers_ai_score_range`, `recall_answers_combined_quality_range`, `recall_answers_evaluation_check`; `generation_fingerprints_technique_check`, `generation_fingerprints_fingerprint_format`.

Entre las cinco tablas de las Fases 0 a 2, ninguna declara restricciones `CHECK` además de las de `import_jobs` (`import_jobs_status_check` y, desde `0014`, `import_jobs_format_check` e `import_jobs_skipped_images_check`), y ninguna columna de esas cinco tablas es nula salvo las explícitamente marcadas como opcionales en el esquema (`profiles.display_name`, `profiles.onboarding_completed_at`, `profiles.terms_accepted_version`/`terms_accepted_at` (migración `0008`), `notebooks.icon`/`color`/`archived_at`, `pages.archived_at`, `import_jobs.page_count`/`error`/`started_at`/`finished_at`). Las dos restricciones `UNIQUE` sobre `storage_path` son la base de la idempotencia de `registerPageAsset` (`onConflictDoUpdate`) y de `DrizzleImportJobRepository.create()` (que traduce su violación en `IMPORT_JOB_STORAGE_PATH_CONFLICT`).
