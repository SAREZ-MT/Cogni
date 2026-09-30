# Modelo de datos y contrato de API — Cogni

**Proyecto:** Cogni — plataforma web de estudio a partir de apuntes propios
**Versión:** 1.0
**Fecha:** 2026-09-25
**Estado:** Borrador
**Autor:** Javier Sarez
**Documentos relacionados:** ./01-SRS.md, ./02-SAD.md

---

## 0. Nota de estado actual (2026-09-25)

- Fase 0 (Cimientos) y Fase 1 (Cuadernos y editor) están desplegadas en producción; sus tablas (`profiles`, `notebooks`, `pages`, `page_assets`) existen en el esquema real.
- Fase 2 (Importación de PDF) fue implementada bajo Organic Driven Development (ODD) el 2026-09-23; la tabla `import_jobs` y el bucket `page-pdfs` son reales.
- Fase 3 (Capa de IA) no ha iniciado: no existe la tabla `AiGeneration` ni ninguna dependencia `ai`/`@ai-sdk/*` en `package.json`.
- Las Fases 4 a 7 (motor de repetición espaciada, flashcards, exámenes, recordación activa, calendario y dashboard) no tienen esquema ni migración en este código base; existen únicamente como especificación en `docs/documento-maestro.md` §6.1 y, para su interfaz visual, como diseño con datos de muestra en la rama `design/shell-look` no integrada a `main`.
- En este documento: 5 tablas reales (`profiles`, `notebooks`, `pages`, `page_assets`, `import_jobs`) están completamente documentadas contra su migración y su `schema.ts`; las 14 entidades restantes del modelo de dominio (§6.1 del documento maestro) se documentan como especificación de datos, marcadas Roadmap, sin migración asociada. El contrato de API (§4) cubre únicamente Server Actions y Route Handlers que existen hoy en el código; no se documenta ningún endpoint de las fases roadmap.

### Documento vivo

Este documento se actualiza a medida que avanza la construcción de Cogni. Por ejemplo, cuando la Fase 4 implemente `study-engine`, la sección 3 (Motor de repetición espaciada) dejará de decir "pendiente de implementación" y ganará una referencia a `drizzle/000N_study_items.sql` y al wrapper real de `applySm2`; y cuando la Fase 3 implemente la capa de IA, la sección "Límites de tasa" de §4 dejará de decir `N/A` y documentará el limitador real (Upstash Ratelimit u otro mecanismo elegido) con sus ventanas exactas.

### Correspondencia con las fases RAD

| Sección de este documento | Fase RAD | Uso en la tesis |
|---|---|---|
| 1. Modelo entidad-relación | Diseño de usuario / Construcción | Sustenta el modelo de datos como evidencia de diseño previo a la implementación. |
| 2. Esquema por módulo | Construcción | Evidencia directa y verificable (SQL real) del trabajo de construcción de la base de datos. |
| 3. Motor de repetición espaciada (SM-2) | Diseño de usuario | Especificación de un algoritmo aún no construido, útil como diseño detallado pendiente de Implementación. |
| 4. Contrato de API | Construcción | Documenta el contrato real entre interfaz y servidor, insumo de pruebas de Implementación. |
| 5. Índices y restricciones | Construcción | Evidencia de las decisiones de integridad y desempeño tomadas durante la construcción. |

---

## 1. Modelo entidad-relación

> **Decisiones de modelado (documento-maestro §6.2 y código real):**
> - **Autorización por propiedad, no por RLS de negocio:** el servidor se conecta con el pooler de Supabase y omite Row Level Security; cada caso de uso de `application` recibe `ownerId` de la sesión y filtra explícitamente por él (`src/shared/db/client.ts`, `prepare: false, max: 1`). RLS está **activa** en las 5 tablas (`.enableRLS()`) pero sin políticas: solo la conexión de servidor las alcanza.
> - **RLS real en Supabase Storage:** a diferencia de las tablas de negocio, los buckets `page-assets` y `page-pdfs` sí tienen políticas RLS por `owner_id`, porque el navegador sube archivos directamente a Storage con la clave pública.
> - **Borrado lógico (`archived_at`):** `notebooks` y `pages` no se eliminan físicamente; el archivado de un cuaderno propaga `archived_at` a sus páginas activas en la capa de aplicación, no mediante un trigger de base de datos.
> - **`content` jsonb + `plain_text` materializado:** `pages.content` guarda el documento Tiptap tal cual; `plain_text` se recalcula en el servidor en cada guardado mediante un recorrido puro del árbol (`extractPlainText`), nunca se acepta el `plain_text` que envíe el cliente.
> - **`content_version` como concurrencia optimista:** cada guardado de página es un `UPDATE ... WHERE content_version = expected` atómico (comparar-e-intercambiar), no un patrón leer-luego-escribir.
> - **`ImportJob` como máquina de estados:** `import_jobs.status` (`queued → processing → done/failed`) es el único registro de progreso de una importación; no existe columna `trigger_run_id` (ver ADR-009: la importación corre de forma síncrona dentro de la propia Server Action, bajo `maxDuration`, sobre Vercel Fluid Compute).
> - **`StudyItem.root_id` y referencias polimórficas (especificación, no implementadas):** el documento maestro especifica que cada `StudyItem` de examen apunta a la pregunta raíz de su linaje, y que `ReviewLog.session_id` es una referencia polimórfica según `session_kind` (sin FK física), para que el motor siga el concepto evaluado y no la redacción de una variante.
> - **Identificadores UUID v7:** todo `id` se genera en la aplicación con `createId()` (48 bits de marca de tiempo en milisegundos + bits aleatorios, RFC 9562), nunca con un valor por defecto de Postgres.
> - **Columnas comunes:** `id`, `owner_id`, `created_at`, `updated_at` son comunes a toda entidad de usuario (documento-maestro §6.1); se listan completas en cada tabla de esta sección aunque el documento maestro las omita por brevedad.

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
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con `auth.users` de Supabase: comparte el mismo `id` y depende de él (`ON DELETE CASCADE`, `drizzle/0002_profiles_auth_fk.sql`). Se relaciona con Notebook, Page, PageAsset e ImportJob: un Profile tiene muchos de cada uno; cada tabla dependiente se elimina en cascada cuando se elimina el Profile.

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

Se relaciona con Profile: pertenece a uno (`owner_id`, `ON DELETE CASCADE`). Se relaciona con Page: un Notebook tiene muchas Page; archivar un Notebook propaga `archived_at` a sus páginas activas (regla de la capa de aplicación, no de la base de datos).

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

Se relaciona con Notebook: pertenece a uno (`notebook_id`, `ON DELETE CASCADE`). Se relaciona con Profile: pertenece a uno (`owner_id`, `ON DELETE CASCADE`). Se relaciona con PageAsset e ImportJob: una Page tiene muchos de cada uno; ambos se eliminan en cascada.

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

Se relaciona con Page: pertenece a una (`page_id`, `ON DELETE CASCADE`). Se relaciona con Profile: pertenece a uno (`owner_id`, `ON DELETE CASCADE`). `storage_path` es único (`UNIQUE`), lo que permite registrar el mismo objeto subido de forma idempotente.

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
| page_count | integer |
| pages_without_text | integer |
| error | text |
| started_at | timestamptz |
| finished_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

Se relaciona con Page: pertenece a una (`page_id`, `ON DELETE CASCADE`). Se relaciona con Profile: pertenece a uno (`owner_id`, `ON DELETE CASCADE`). `storage_path` es único. A diferencia de la especificación original del documento maestro (§6.1), esta tabla **no** tiene columna `trigger_run_id`: el ADR-009 fija el procesamiento síncrono dentro de la propia Server Action (`maxDuration = 120`, Vercel Fluid Compute) como mecanismo de trabajo en segundo plano.

### Entidades roadmap (especificación, sin migración)

#### StudyItem — Estado: Roadmap (Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| page_id | uuid |
| kind | text |
| source_id | uuid |
| easiness | real |
| interval_days | integer |
| repetitions | integer |
| due_at | timestamptz |
| last_quality | integer |
| last_reviewed_at | timestamptz |
| lapses | integer |
| suspended_at | timestamptz |

Se relacionará con Page: muchos StudyItem por página (`page_id`). `kind` distingue si `source_id` apunta a una Flashcard, a la `ExamQuestion` raíz de su linaje o a una RecallQuestion, de forma que las variantes de examen (§7.5) alimentan el mismo ítem que su pregunta original.

#### ReviewLog — Estado: Roadmap (Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| item_id | uuid |
| quality | integer |
| reviewed_at | timestamptz |
| interval_before | integer |
| interval_after | integer |
| easiness_after | real |
| session_kind | text |
| session_id | uuid |

Se relacionará con StudyItem: muchos ReviewLog por ítem (`item_id`). `session_id` es una referencia polimórfica sin FK física: apunta a FlashcardSession, ExamSession o RecallSession según `session_kind` (documento-maestro §6.1).

#### PageMastery — Estado: Roadmap (Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| page_id | uuid |
| level | text |
| score | real |
| items_total | integer |
| items_due | integer |
| computed_at | timestamptz |

Se relacionará con Page: una PageMastery por página (`page_id`), recalculada por el motor de repetición espaciada según la fórmula de §3 de este documento (documento-maestro §7.3).

#### Flashcard — Estado: Roadmap (Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| page_id | uuid |
| front | text |
| back | text |
| origin | text |
| generation_id | uuid |
| archived_at | timestamptz |

Se relacionará con Page: muchas Flashcard por página. Se relacionará con AiGeneration cuando `origin` sea `ai` (`generation_id`).

#### FlashcardSession — Estado: Roadmap (Fase 4)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| page_id | uuid |
| started_at | timestamptz |
| finished_at | timestamptz |
| reviewed_count | integer |
| again_count | integer |

Se relacionará con Page cuando la sesión sea de una sola página; `page_id` queda nulo en la vista "Hoy" multipágina (documento-maestro §6.1). Se relacionará con ReviewLog y SessionFeedback a través de `session_id`/`session_kind`.

#### ExamQuestion — Estado: Roadmap (Fase 5)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
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

Se relacionará con Page: muchas ExamQuestion por página. `root_id` apunta a la pregunta original de su linaje (a sí misma si es original); `variant_of` apunta a la pregunta que reemplaza en una repetición (documento-maestro §7.5).

#### ExamPageState — Estado: Roadmap (Fase 5)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| page_id | uuid |
| retake_pending | boolean |
| failed_root_ids | jsonb |
| last_passed_session_id | uuid |

Se relacionará con Page: un ExamPageState por página. `last_passed_session_id` apunta a la ExamSession aprobada más reciente; `failed_root_ids` guarda los `root_id` fallados en el último examen (documento-maestro §7.5).

#### ExamSession — Estado: Roadmap (Fase 5)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| page_id | uuid |
| is_retake | boolean |
| retake_of_session_id | uuid |
| started_at | timestamptz |
| finished_at | timestamptz |
| total | integer |
| correct | integer |
| score | real |
| passed | boolean |

Se relacionará con Page: muchas ExamSession por página. `retake_of_session_id` apunta a la sesión original cuando `is_retake` es verdadero.

#### ExamAnswer — Estado: Roadmap (Fase 5)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| session_id | uuid |
| question_id | uuid |
| root_id | uuid |
| selected_index | integer |
| is_correct | boolean |
| answered_at | timestamptz |

Se relacionará con ExamSession: muchas ExamAnswer por sesión (`session_id`). `question_id` referencia la variante realmente mostrada al estudiante; `root_id` preserva el concepto evaluado independientemente de la redacción.

#### RecallQuestion — Estado: Roadmap (Fase 6)

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

Se relacionará con Page: muchas RecallQuestion por página. `rubric` guarda `keyConcepts[]` y `acceptableAnswerSummary` (documento-maestro §8.4).

#### RecallSession — Estado: Roadmap (Fase 6)

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

Se relacionará con Page: muchas RecallSession por página. `evaluation_status` (`pending`/`done`/`partial`) refleja que la evaluación de IA de cada respuesta es asíncrona.

#### RecallAnswer — Estado: Roadmap (Fase 6)

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

Se relacionará con RecallSession: muchas RecallAnswer por sesión. `combined_quality` es la calidad SM-2 calculada según la fórmula de §3.4 de este documento (documento-maestro §7.4).

#### SessionFeedback — Estado: Roadmap (Fase 4-6)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
| session_kind | text |
| session_id | uuid |
| content | jsonb |
| generation_id | uuid |
| status | text |

Se relacionará, de forma polimórfica según `session_kind`, con FlashcardSession, ExamSession o RecallSession (igual que ReviewLog); existirá una SessionFeedback por sesión terminada de cualquiera de las tres técnicas.

#### AiGeneration — Estado: Roadmap (Fase 3)

| Atributo | Tipo |
|---|---|
| id | uuid |
| owner_id | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |
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

Se relacionará con Page cuando el propósito lo requiera (`page_id` nulo si no aplica). Alimentará Flashcard, ExamQuestion, RecallQuestion y SessionFeedback mediante `generation_id`. El documento maestro también lista `trigger_run_id` para esta entidad; se omite aquí por la misma razón que en ImportJob (ADR-009: el trabajo en segundo plano corre de forma síncrona dentro de una función de Vercel, sin un mecanismo externo de colas).

### Resumen de entidades

| Entidad | Tabla | Módulo | Estado | Fase |
|---|---|---|---|---|
| Profile | profiles | identity | Implementado | Fase 0 |
| Notebook | notebooks | notebooks | Implementado | Fase 1 |
| Page | pages | notebooks | Implementado | Fase 1 |
| PageAsset | page_assets | notebooks | Implementado | Fase 1 |
| ImportJob | import_jobs | ingestion | Implementado | Fase 2 |
| StudyItem | — | study-engine | Roadmap | Fase 4 |
| ReviewLog | — | study-engine | Roadmap | Fase 4 |
| PageMastery | — | study-engine | Roadmap | Fase 4 |
| Flashcard | — | flashcards | Roadmap | Fase 4 |
| FlashcardSession | — | flashcards | Roadmap | Fase 4 |
| ExamQuestion | — | exams | Roadmap | Fase 5 |
| ExamPageState | — | exams | Roadmap | Fase 5 |
| ExamSession | — | exams | Roadmap | Fase 5 |
| ExamAnswer | — | exams | Roadmap | Fase 5 |
| RecallQuestion | — | active-recall | Roadmap | Fase 6 |
| RecallSession | — | active-recall | Roadmap | Fase 6 |
| RecallAnswer | — | active-recall | Roadmap | Fase 6 |
| SessionFeedback | — | flashcards / exams / active-recall | Roadmap | Fase 4-6 |
| AiGeneration | — | ai | Roadmap | Fase 3 |

---

## 2. Esquema por módulo

Las 7 migraciones reales viven en `drizzle/*.sql`, generadas por `drizzle-kit generate` a partir de `src/shared/db/schema.ts` (`drizzle.config.ts`: `dialect: "postgresql"`, `schema: "./src/shared/db/schema.ts"`, `out: "./drizzle"`) y aplicadas con `drizzle-kit migrate`. Las migraciones de Storage (buckets y políticas RLS) son SQL escrito a mano, porque Drizzle no introspecta el esquema `storage` de Supabase.

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
-- drizzle/0004_page_assets_storage.sql
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
-- drizzle/0006_page_pdfs_storage.sql
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

### 2.4 Módulos roadmap

`ai`, `study-engine`, `flashcards`, `exams`, `active-recall`, `scheduling` y `analytics`: sin tablas en este código base; ver §1 para la especificación de sus entidades.

### 2.5 Enumeraciones

No existe ningún `pgEnum` de Drizzle en `src/shared/db/schema.ts`. El único conjunto cerrado de valores hoy en el esquema real es `import_jobs.status`, declarado como `text` con un `$type<ImportJobStatusValue>()` de TypeScript en el lado de la aplicación y reforzado en la base de datos con la restricción `CHECK import_jobs_status_check`, no con un tipo enumerado nativo de Postgres.

| Valor | Significado |
|---|---|
| `queued` | Job creado, aún no reclamado por `processImportJob`. |
| `processing` | Job reclamado; descarga, extracción y conversión en curso. |
| `done` | Importación terminada con éxito; el contenido ya está escrito en `pages.content`. |
| `failed` | Importación terminada sin éxito; `error` contiene el mensaje en español correspondiente (ver §4.4). |

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

Todas las claves foráneas del esquema usan `ON DELETE cascade` y `ON UPDATE no action`; eliminar un `Profile` elimina en cadena sus cuadernos, páginas, adjuntos e importaciones.

### 2.7 Estrategia de migraciones

Incremental-aditiva: cada cambio de esquema es un nuevo archivo `NNNN_nombre.sql` generado por `drizzle-kit generate` (nunca se edita una migración ya aplicada), registrado en `drizzle/meta/_journal.json` (7 entradas, `0000_profiles` a `0006_page_pdfs_storage`). `drizzle-kit` no tiene comando `down`: 5 de las 7 migraciones (`0002`, `0003`, `0004`, `0005`, `0006`) traen un `.down.sql` hermano con la reversión manual documentada en comentarios, pensado para aplicarse a mano con `psql` o el editor SQL de Supabase; las dos primeras (`0000` crea la tabla, `0001` activa RLS) no lo necesitan. Las migraciones de Storage (`0004`, `0006`) son idempotentes por diseño (`on conflict (id) do update`), para que la misma migración sea la fuente de verdad de los límites del bucket tanto en `cogni-dev` como en `cogni-prod`.

Las migraciones se aplican exclusivamente durante la construcción de producción en Vercel, nunca en previsualizaciones (`package.json`: `"build": "node scripts/migrate-in-build.mjs && next build"`). `scripts/migrate-in-build.mjs` expone el predicado puro `shouldRunMigrations(env)`, verdadero solo si `env.VERCEL_ENV === "production"` o `env.RUN_DB_MIGRATIONS === "1"` (esta última, una escotilla para migrar manualmente contra `cogni-dev` sin desplegar). Cuando el predicado es verdadero ejecuta `pnpm exec drizzle-kit migrate`; en cualquier otro caso lo omite con un mensaje en consola. `drizzle.config.ts` fija `dialect: "postgresql"`, `schema: "./src/shared/db/schema.ts"` y `out: "./drizzle"`.

---

## 3. Motor de repetición espaciada (SM-2)

**Fase 4 — pendiente de implementación.** El módulo `src/modules/study-engine/index.ts` es `export {};`; ninguna de las fórmulas de esta sección tiene código en este repositorio. La especificación completa proviene de `docs/documento-maestro.md` §7.1–§7.5, y corresponde a los requisitos RF-SE-01 a RF-SE-04 (motor), RF-FC-03 (calidad por técnica en flashcards), RF-EX-03 a RF-EX-06 (corrección y repetición de exámenes) y RF-AR-04 a RF-AR-05 (calidad combinada y señales metacognitivas de recordación activa), todos marcados Roadmap / Diseño visual en `01-SRS.md` §4.

El motor decide, de forma transversal a las tres técnicas de estudio (flashcards, exámenes, recordación activa), cuándo debe repasarse cada `StudyItem` y qué nivel de dominio tiene cada `Page`. Es el único módulo autorizado a calcular fechas de vencimiento (documento-maestro §3.4); ningún otro módulo calculará vencimientos fuera de él.

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

Se especifica como una función pura `applySm2(state, quality, now) → newState`, con objetivo de cobertura de pruebas del 100 % (primer, segundo y tercer repaso, fallo después de un éxito, `easiness` mínimo, y los extremos `q = 0` y `q = 5`).

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

### 3.3 Calidad combinada en recordación activa (documento-maestro §7.4)

`combined = round(0.6 * ai_score + 0.4 * self_rating)`, donde `ai_score` y `self_rating` son enteros de 0 a 5. Señales metacognitivas registradas junto a la calidad combinada: `self_rating >= 4 and ai_score <= 2` marca exceso de confianza; `self_rating <= 1 and ai_score >= 4` marca falta de confianza. Se registran las tres señales (puntaje crudo de IA, autoevaluación y calidad combinada) en `RecallAnswer`.

### 3.4 Nivel de dominio por página (documento-maestro §7.3)

Para cada ítem `i` de una página: `estabilidad_i = min(1, interval_days_i / 21)`; `acierto_i = 1` si `last_quality_i >= 3`, en otro caso `0`; `aporte_i = 0.6 * estabilidad_i + 0.4 * acierto_i`. El puntaje de la página es `score = promedio(aporte_i)` sobre todos sus ítems. Niveles resultantes:

| Condición | Nivel |
|---|---|
| Página sin ítems | Nuevo |
| `score < 0.35` | Aprendiendo |
| `0.35 <= score < 0.70` | Consolidando |
| `score >= 0.70` | Dominado |

El calendario ordena las páginas por `due_at` mínimo entre sus ítems; el dashboard muestra `level` y `score` por página.

### 3.5 Repetición de exámenes (documento-maestro §7.5)

Al terminar una `ExamSession`: `score = correct / total`. Cada respuesta alimenta `RecordReview` con `q = 4` si fue correcta o `q = 1` si fue incorrecta. Si `score < 0.70`, el `ExamPageState` de la página pasa a `retake_pending = true` con `failed_root_ids` poblado; si `score >= 0.70`, ese estado se limpia. En la repetición, nunca se repite la misma pregunta con la misma redacción: se genera por IA una variante distinta por cada `root_id` fallado (`variant_of` apunta a la pregunta reemplazada, `root_id` se preserva), la pregunta original queda `retired_at`, y la sesión de repetición se completa con preguntas nuevas hasta un máximo de 5 si hubo menos de 5 falladas. Las respuestas de la repetición alimentan el `StudyItem` de la pregunta raíz. Si la generación de variantes falla en todos los proveedores de IA, la repetición se bloquea con un mensaje claro al estudiante.

### 3.6 Columnas de estado por `StudyItem`

| Columna | Tipo | Valor inicial | Descripción |
|---|---|---|---|
| `easiness` | real | 2.5 | Factor de facilidad (EF); nunca baja de 1.3. |
| `interval_days` | integer | 0 | Intervalo en días hasta el próximo repaso. |
| `repetitions` | integer | 0 | Repasos consecutivos exitosos (`n` en la fórmula SM-2). |
| `due_at` | timestamptz | fecha de creación | Fecha de vencimiento del ítem. |
| `last_quality` | integer | nulo | Última calidad (`q`, 0–5) registrada. |
| `last_reviewed_at` | timestamptz | nulo | Fecha del último repaso. |
| `lapses` | integer | 0 | Número de veces que `q < 3`. |
| `suspended_at` | timestamptz | nulo | Fecha de suspensión manual del ítem, si el estudiante la solicita. |

---

## 4. Contrato de API

### 4.1 `identity`

Corresponden a CU-01 (Registro e inicio de sesión) y CU-02 (Recuperar contraseña), y a los requisitos RF-ID-01 a RF-ID-07 del componente `identity` (tabla de componentes, `02-SAD.md` §4.1). Todas las funciones siguientes son Server Actions (`"use server"`, `src/modules/identity/actions.ts`); ninguna declara `maxDuration`. Cada una valida la entrada con `credentialsSchema` (`email`, `password` de al menos 8 caracteres) a través de la capa de aplicación antes de llamar al `AuthGateway`.

| Acción | Parámetros | Retorno | Auth | Errores |
|---|---|---|---|---|
| `signUpAction` | `formData: FormData` (`email`, `password`) | `AuthFormState { status, message }` | No requiere sesión | `AUTH_INVALID_INPUT`, `AUTH_PROVIDER_UNAVAILABLE` |
| `signInAction` | `formData: FormData` (`email`, `password`) | `AuthFormState` o redirección a `/` | No requiere sesión | `AUTH_INVALID_INPUT`, `AUTH_INVALID_CREDENTIALS`, `AUTH_EMAIL_NOT_VERIFIED`, `AUTH_PROVIDER_UNAVAILABLE` |
| `signOutAction` | — | `{ status: "error"; message }` o redirección a `/login` | Requiere sesión | `AUTH_PROVIDER_UNAVAILABLE` |
| `requestPasswordResetAction` | `formData: FormData` (`email`) | `AuthFormState` | No requiere sesión | `AUTH_INVALID_INPUT`, `AUTH_PROVIDER_UNAVAILABLE` |
| `updatePasswordAction` | `formData: FormData` (`password`) | `AuthFormState` o redirección a `/` | Requiere sesión de recuperación | `AUTH_INVALID_INPUT`, `AUTH_PROVIDER_UNAVAILABLE` |
| `signInWithGoogleAction` | — | Redirección a Google OAuth o a `/login?error=google` | No requiere sesión | `AUTH_PROVIDER_UNAVAILABLE` (no se devuelve como valor; solo redirige) |

`signUpAction` trata la respuesta `outcome === "already_registered"` de Supabase (correo ya existente) como un caso de éxito con mensaje de error de dominio (`AUTH_COPY.alreadyRegistered`), no como un `DomainError`.

### 4.2 `notebooks`

Corresponden a CU-03 (Crear y organizar cuadernos y páginas) y CU-04 (Escribir apuntes en el editor), y a los requisitos RF-NB-01 a RF-NB-08 y RF-ED-01, RF-ED-05 y RF-ED-07 (componentes `notebooks` y `editor`, `02-SAD.md` §4.1). Server Actions (`"use server"`, `src/modules/notebooks/actions.ts`). Las seis primeras filas usan `requireOwnerId()` (lanza una excepción si no hay sesión, capturada por el manejador de errores de Next.js) y `unwrap()` (convierte un `DomainError` en una excepción con el mensaje en español de `notebooks-copy.ts`). Las marcadas "Result-returning" usan `requireOwnerIdResult()` y nunca lanzan: devuelven `Result<T, ActionError>` para que `editor`'s `useAutosave` pueda reconciliar un conflicto sin que el Server Action arroje una excepción.

| Acción | Parámetros | Retorno | Auth | Errores |
|---|---|---|---|---|
| `createNotebook` | `{ title: string; icon?: string o null; color?: string o null }` | `Notebook` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `NOTEBOOK_INVALID_TITLE`, `NOTEBOOK_INVALID_COLOR` |
| `renameNotebook` | `{ notebookId: string; title: string }` | `Notebook` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `NOTEBOOK_NOT_FOUND`, `NOTEBOOK_INVALID_TITLE` |
| `setNotebookAppearance` | `{ notebookId: string; icon?: string o null; color?: string o null }` | `Notebook` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `NOTEBOOK_NOT_FOUND`, `NOTEBOOK_INVALID_COLOR` |
| `archiveNotebook` | `{ notebookId: string }` | `Notebook` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `NOTEBOOK_NOT_FOUND` |
| `createPage` | `{ notebookId: string; title?: string }` | `Page` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `NOTEBOOK_NOT_FOUND`, `NOTEBOOK_ARCHIVED` |
| `renamePage` | `{ pageId: string; title: string }` | `Page` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `PAGE_NOT_FOUND` |
| `archivePage` | `{ pageId: string }` | `Page` | Requiere sesión (lanza) | `NOTEBOOKS_INVALID_INPUT`, `PAGE_NOT_FOUND` |
| `getSidebarTree` | — | `SidebarNotebook[]` | Requiere sesión (lanza) | — (sin canal de `DomainError`) |
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

`createNotebooksServerApi({ db, clock? }): NotebooksServerApi` no es un punto de entrada alcanzable por el cliente: lo consume únicamente `ingestion/infrastructure/notebooks-pages-adapter.ts` en el mismo proceso del servidor.

| Método | Parámetros | Retorno | Auth | Errores |
|---|---|---|---|---|
| `findActiveNotebook` | `ownerId: string, notebookId: string` | `{ id: string } o null` | N/A — invocado en proceso, no expuesto a cliente | — |
| `createPage` | `ownerId: string, { notebookId: string; title?: string }` | `Result<{ id: string; notebookId: string }, DomainError>` | N/A | `NOTEBOOK_NOT_FOUND`, `NOTEBOOK_ARCHIVED` |
| `writeImportedContent` | `ownerId: string, { pageId: string; content: TiptapDoc; expectedVersion: number }` | `Result<{ version: number }, DomainError>` | N/A | `PAGE_NOT_FOUND`, `PAGE_VERSION_CONFLICT`, `PAGE_INVALID_CONTENT` |
| `findPageNotebookId` | `ownerId: string, pageId: string` | `string o null` | N/A | — |

`writeImportedContent` usa un esquema Zod `.strict()`: un campo extra (por ejemplo `plainText`) invalida toda la entrada, a diferencia de `saveContent`, que descarta silenciosamente un `plain_text` enviado por el cliente.

### 4.3 `ingestion`

Corresponden a CU-05 (Importar PDF) y a los requisitos RF-IN-01 a RF-IN-08 (componente `ingestion`, `02-SAD.md` §4.1), además de RNF-P-01 y RNF-P-02 (presupuesto de tiempo y tamaño máximo del PDF). Server Actions (`"use server"`, `src/modules/ingestion/actions.ts`). Las cinco están envueltas en `withBoundary()`: cualquier excepción no prevista se reporta a Sentry y se convierte en `INGESTION_UNEXPECTED` en vez de propagarse al cliente. `processPdfImport` es la única de duración larga, acotada por `maxDuration = 120` en `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`.

| Acción | Parámetros | Retorno | Auth | Errores |
|---|---|---|---|---|
| `requestPdfUpload` | `{ notebookId: string; fileName: string; mime: string; sizeBytes: number }` | `Result<PdfUploadGrant, ActionError>` | Requiere sesión (Result) | `INGESTION_SESSION_REQUIRED`, `INGESTION_INVALID_INPUT`, `PDF_FILE_NAME_INVALID`, `PDF_MIME_NOT_ALLOWED`, `PDF_TOO_LARGE`, `INGESTION_NOTEBOOK_NOT_FOUND`, `INGESTION_STORAGE_UNAVAILABLE`, `INGESTION_UNEXPECTED` |
| `startPdfImport` | `{ notebookId: string; storagePath: string; fileName: string; mime: string; sizeBytes: number }` | `Result<StartPdfImportResult, ActionError>` | Requiere sesión (Result) | `INGESTION_SESSION_REQUIRED`, `INGESTION_INVALID_INPUT`, `PDF_PATH_OUT_OF_SCOPE`, `PDF_UPLOAD_EXPIRED`, `PDF_OBJECT_MISSING`, `INGESTION_NOTEBOOK_NOT_FOUND`, `INGESTION_NOTEBOOK_MISMATCH`, `INGESTION_PAGE_NOT_FOUND`, `INGESTION_STORAGE_UNAVAILABLE`, `INGESTION_UNEXPECTED` |
| `processPdfImport` | `{ importJobId: string }` | `Result<ImportJobStatusView, ActionError>` | Requiere sesión (Result) | `INGESTION_SESSION_REQUIRED`, `INGESTION_INVALID_INPUT`, `IMPORT_JOB_NOT_FOUND`, `INGESTION_UNEXPECTED` |
| `getImportJobStatus` | `{ pageId: string }` | `Result<ImportJobStatusView o null, ActionError>` | Requiere sesión (Result) | `INGESTION_SESSION_REQUIRED`, `INGESTION_INVALID_INPUT`, `IMPORT_JOB_NOT_FOUND`, `INGESTION_UNEXPECTED` |
| `getActiveImports` | — | `Result<string[], ActionError>` | Requiere sesión (Result) | `INGESTION_SESSION_REQUIRED`, `INGESTION_UNEXPECTED` |

`processPdfImport` nunca devuelve un error de dominio por un PDF ilegible, sin capa de texto, con conflicto de persistencia o por tiempo agotado: esos cinco desenlaces se registran como el `status`/`error` terminal del propio `ImportJob` (ver §2.5) y se leen a través del mismo `ImportJobStatusView` que devuelven `processPdfImport` y `getImportJobStatus` con éxito (`ok(...)`). Mensajes exactos en español por causa:

| Causa (`IMPORT_FAILURE_KIND`) | Mensaje mostrado al estudiante |
|---|---|
| `download` | "No pudimos leer el archivo que subiste. Vuelve a importarlo." |
| `invalid_pdf` | "Este archivo no es un PDF válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo." |
| `no_text_layer` | "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto." |
| `persistence` | "La página cambió durante la importación, así que no reemplazamos su contenido. Vuelve a importar el PDF." |
| `timeout` | "La importación tardó demasiado. Inténtalo de nuevo con un PDF más pequeño o en unos minutos." |

`getImportJobStatus` reporta como `status: "failed"` (con el mensaje de `timeout`) cualquier job cuyo último cambio de estado supere `ABANDONED_AFTER_MS` (150 000 ms) sin haber llegado a un estado terminal, aunque nunca escribe ese estado en la base de datos: solo `processPdfImport` puede hacerlo.

Ejemplo de retorno no trivial (`ImportJobStatusView`):

```json
{
  "importJobId": "0197...",
  "pageId": "0197...",
  "status": "failed",
  "pageCount": 12,
  "pagesWithoutText": 0,
  "error": "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto.",
  "createdAt": "2026-09-24T18:00:00.000Z",
  "updatedAt": "2026-09-24T18:01:32.000Z"
}
```

### Route Handlers

| Método | Ruta | Cuerpo | Respuesta | Auth | Descripción |
|---|---|---|---|---|---|
| `GET` | `/api/keep-alive` | — | `{ ok: true }` (200) o vacío (401) | Cabecera `Authorization: Bearer <CRON_SECRET>`, comparada con `timingSafeEqual` | Ejecuta `select 1` para evitar que Supabase Free pause el proyecto por inactividad; llamado a diario por Vercel Cron. |
| `GET` | `/auth/callback` | Query `code`, `next` | Redirección 302 a `next` (sanitizado con `safeNext`) o a `/login?error=google` | Ninguna (recibe el código PKCE de Supabase Auth) | Intercambia el código de OAuth de Google, verificación de correo o recuperación de contraseña por una sesión; registra `user_signed_in` de forma diferida (`after()`) cuando el intercambio corresponde a un inicio de sesión con `userId`. |

### Límites de tasa

N/A — se incorpora con la Fase 3 (documento-maestro §8.3: 20 generaciones/día, 60 evaluaciones/día por usuario, mecanismo pendiente).

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
```

```sql
-- Idempotencia de subida: un mismo objeto de Storage se registra una sola vez
CONSTRAINT "page_assets_storage_path_key" UNIQUE("storage_path")
CONSTRAINT "import_jobs_storage_path_key" UNIQUE("storage_path")

-- Estado cerrado de ImportJob sin pgEnum de Postgres
CONSTRAINT "import_jobs_status_check" CHECK ("import_jobs"."status" in ('queued', 'processing', 'done', 'failed'))
```

Ninguna tabla real declara una restricción `CHECK` adicional a `import_jobs_status_check`, y ninguna columna de las 5 tablas implementadas es nula salvo las explícitamente marcadas como opcionales en el esquema (`profiles.display_name`, `profiles.onboarding_completed_at`, `notebooks.icon`/`color`/`archived_at`, `pages.archived_at`, `import_jobs.page_count`/`error`/`started_at`/`finished_at`). Las dos restricciones `UNIQUE` sobre `storage_path` son la base de la idempotencia de `registerPageAsset` (`onConflictDoUpdate`) y de `DrizzleImportJobRepository.create()` (que traduce su violación en `IMPORT_JOB_STORAGE_PATH_CONFLICT`).
