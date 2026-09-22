# Exploración: Fase 2 — Importación de PDF

> Change: `phase-2-pdf-import` · Fecha: 2026-09-22 · Espejo en Engram: topic `sdd/phase-2-pdf-import/explore` (obs #234)

## Estado actual

**`ingestion` (documento-maestro §5.2, §13):** esqueleto vacío. `src/modules/ingestion/index.ts` solo exporta `{}` y `README.md` documenta que está "pendiente". No hay `domain/`, `application/`, `infrastructure/` ni `ui/`.

**`@trigger.dev/sdk` y `unpdf` NO están instalados** (confirmado en `package.json`, líneas 23-77). El `openspec/config.yaml` ya los declara en el stack (línea 9) pero no hay código que los use. No existe carpeta `src/trigger/`.

**`notebooks` (Fase 1, ya en `openspec/specs/`) da el patrón exacto a reutilizar, no a reinventar:**
- `Page.content` es un `TiptapDoc` (`{ type: "doc", content: TiptapNode[] }`), `TiptapNode = { type, content?, text?, attrs?, marks? }` (`src/modules/notebooks/domain/plain-text.ts`). La conversión de texto a bloques de Fase 2 debe producir directamente este árbol (p.ej. `{ type: "heading", attrs: { level }, content: [{ type: "text", text }] }`, `{ type: "paragraph", ... }`, `{ type: "bulletList", content: [{ type: "listItem", ... }] }`).
- `extractPlainText(doc)` (mismo archivo) es un recorrido puro de AST sin dependencias de Tiptap/ProseMirror — es el modelo exacto a seguir para la función pura del heurístico texto→bloques en `ingestion.domain` (testeable con TDD, sin tocar infraestructura).
- `createPage` (`notebooks/domain/page.ts` + `notebooks/application/create-page.ts`) crea una página vacía (`EMPTY_DOC`, `contentVersion: 1`). La importación necesita o bien reutilizar `createPage` y luego un `save`/`updateIfVersion` con el contenido convertido, o un nuevo caso de uso que persista contenido no vacío desde el inicio — decisión de diseño, no de exploración.
- **Patrón de subida firmada a Storage** (`request-image-upload.ts`, `register-page-asset.ts`, `get-asset-read-url.ts`, `supabase-storage-gateway.ts`, migración `0004_page_assets_storage.sql`): permiso firmado emitido por el servidor (`StorageGateway.createSignedUploadUrl`), subida directa desde el navegador, registro server-side que re-valida `mime`/`sizeBytes` desde los metadatos reales del objeto (nunca confía en lo declarado por el cliente), ruta canónica `{ownerId}/{pageId o resourceId}/{id}.{ext}`, RLS por primer segmento de la ruta = `auth.uid()`. Este es el patrón a clonar para la subida de PDF.
- `StorageGateway` actual (`notebooks/domain/storage-gateway.ts`) SOLO expone `createSignedUploadUrl`, `createSignedUrl`, `getObjectMetadata` — **no tiene método de descarga**. La tarea Trigger.dev necesita bajar los bytes del PDF; hace falta añadir un método de descarga al puerto (o un puerto nuevo en `ingestion.domain`, ya que `ingestion` no debería importar `notebooks.domain.StorageGateway` directamente — la regla de dependencia 5.3.5 obliga a pasar por `index.ts` público, y `notebooks/index.ts` no expone hoy ese puerto).
- El bucket `page-assets` (migración `0004`) está limitado a `file_size_limit: 10485760` (10 MB) y `allowed_mime_types` solo imágenes — **no sirve para PDFs sin una migración nueva** (bucket propio, p.ej. `page-pdfs`, con su propio límite de tamaño y `allowed_mime_types: ['application/pdf']`, y su propia variable de entorno servidor, ya que `SUPABASE_STORAGE_BUCKET` está atada al pipeline de imágenes).

**Folder structure y regla de latencia (documento-maestro §5.4, §8.1 regla 5):** `src/trigger/` son tareas delgadas que llaman a `application`; toda operación que pueda tardar más de unos segundos corre en Trigger.dev, las Server Actions solo encolan y consultan. Esto aplica literalmente a Fase 2: la Server Action de importación crea el `ImportJob` (status `queued`) y hace `tasks.trigger()`; la tarea hace descarga+extracción+conversión+persistencia.

**Pendientes de Fase 1 relevantes (Engram obs #232):**
- `SUPABASE_STORAGE_BUCKET=page-assets` ya está configurado en `.env.local`/Vercel y en CI (`main.yml` línea 45) — Fase 2 NO depende de esto para el pipeline de PDF (necesita su propia variable), pero confirma que sin una var de entorno de bucket el arranque del servidor falla (mismo patrón aplicaría a la var del bucket de PDFs).
- `tests/e2e/fixtures/auth.ts`'s `clickAndWaitForAction` matchea cualquier POST 2xx — riesgo directo para un e2e de "subir PDF y esperar el import job": un beacon de analítica no relacionado podría resolver la espera antes que la Server Action real. Hay que acotar el predicado o usar otro mecanismo de espera (polling del estado del `ImportJob`) al escribir el e2e de esta fase.
- La configuración del bucket `page-assets` en `cogni-prod` seguía pendiente de verificación visual por el usuario (tarea 6.2) — no bloquea Fase 2 en `cogni-dev`, pero si Fase 2 añade un bucket nuevo, ese mismo tipo de verificación manual en `cogni-prod` se repite.

**CI actual:** `pr.yml` corre `biome ci`, `typecheck`, `pnpm test` (Vitest), `depcruise`, `pnpm audit` — sin Playwright, sin secretos. `main.yml` añade un job `e2e` con Playwright contra `cogni-dev` usando secretos reales de Supabase, y las migraciones corren dentro del build de Vercel (`scripts/migrate-in-build.mjs`), nunca en un workflow. **No existe ningún paso de deploy de Trigger.dev** en ninguno de los dos workflows — hay que añadirlo.

## Evidencia externa (primaria, con fecha de consulta 2026-09-22)

**Trigger.dev v4 + Next.js App Router** ([guía oficial](https://trigger.dev/docs/guides/frameworks/nextjs)):
- Se dispara una tarea desde una Server Action con `tasks.trigger<typeof myTask>("task-id", payload)` de `@trigger.dev/sdk`, devolviendo un `handle` con el `run id`.
- Desarrollo local: `npx trigger.dev@latest dev` — vigila `/trigger` y registra las tareas contra la plataforma de Trigger.dev (necesita conectividad real, no hay modo 100% offline).
- Deploy: **separado del deploy de Vercel**. Se hace con `npx trigger.dev@latest deploy` manual o vía GitHub Actions cuando cambia el directorio `trigger`. La documentación indica explícitamente que a la fecha de esta exploración no hay integración oficial de Vercel — el deploy de Trigger.dev debe ser un paso propio de CI (p.ej. en `main.yml`, gated a cambios en `src/trigger/**`).

**Límites free tier de Trigger.dev** ([trigger.dev/pricing](https://trigger.dev/pricing), [trigger.dev/docs/limits](https://trigger.dev/docs/limits)): USD 5/mes de crédito incluido, **20 ejecuciones concurrentes**, 10 conexiones Realtime concurrentes, 1 día de retención de logs. Coincide con lo ya documentado en documento-maestro §4.2.

**`unpdf`** ([unjs.io/packages/unpdf](https://unjs.io/packages/unpdf)):
- `extractText(data | PDFDocumentProxy, { mergePages? })` → `{ totalPages, text }`. Con `mergePages: false` (o sin especificar) `text` es un **array, una entrada por página** — exactamente lo que se necesita para convertir página por página y para contar `page_count`.
- No hay una función dedicada para detectar "PDF sin capa de texto"; el heurístico razonable (no verificado en la documentación, es una inferencia) es: texto extraído vacío o solo espacios en blanco en todas (o casi todas) las páginas ⇒ tratar como "sin capa de texto".
- Funciona en Node.js, browser y workers; el build serverless corre en el mismo event loop (sin worker dedicado) — para PDFs grandes conviene correr con un timeout explícito, algo que la propia tarea de Trigger.dev ya maneja de forma nativa.

## Áreas afectadas

- `src/modules/ingestion/` — implementación completa: `domain/` (heurístico texto→bloques, entidad `ImportJob`, puerto de descarga de Storage), `application/` (casos de uso: `RequestPdfUpload`/`enqueue import`, `ProcessImportJob` invocado por la tarea, consulta de estado), `infrastructure/` (repositorio Drizzle de `ImportJob`, adaptador de Storage con descarga), `ui/` (botón "Importar PDF", indicador de progreso), `index.ts`.
- `src/trigger/` — carpeta nueva, primera tarea del proyecto (procesar PDF). Debe ser delgada y solo llamar a `ingestion.application`.
- `src/modules/notebooks/domain/storage-gateway.ts` y `notebooks/index.ts` — decisión de si se extiende el puerto existente con descarga y se expone, o `ingestion` define su propio puerto de Storage independiente (más alineado con la regla 5.3.5, pero duplica el adaptador `SupabaseStorageGateway`).
- `drizzle/` — nueva migración para la tabla `import_jobs` (columnas de §6.1: `page_id`, `storage_path`, `file_name`, `status`, `page_count`, `error`, `trigger_run_id`) y para el bucket de PDFs (RLS + `allowed_mime_types`/`file_size_limit` nuevos, siguiendo el patrón de `0004_page_assets_storage.sql`).
- `src/shared/config/env.schema.ts` / `env.server.ts` — nuevas variables: credenciales de Trigger.dev (`TRIGGER_SECRET_KEY` o equivalente v4) y el nombre del bucket de PDFs.
- `package.json` — añadir `@trigger.dev/sdk`, `unpdf`, y la CLI `trigger.dev` (dev dependency para `dev`/`deploy`).
- `.github/workflows/main.yml` (o un workflow nuevo) — paso de deploy de Trigger.dev tras el merge a `main`, gated a cambios en `src/trigger/**`, con el secreto correspondiente.
- `tests/e2e/` — nuevo spec de importación de PDF; revisar `clickAndWaitForAction` (riesgo ya señalado).
- `src/modules/notebooks/ui/` o el shell del notebook — punto de entrada de UI para "Importar PDF" (no hay ubicación definida en el documento maestro; es una decisión de producto).
- Evento de observabilidad `pdf_imported` (§10.3) — instrumentar en el punto donde el `ImportJob` pasa a `done`.

## Enfoques a comparar

1. **Trigger.dev task delgada que hace descarga + unpdf + conversión + persistencia, Server Action solo encola y consulta, UI hace polling del `ImportJob`** (la que exige literalmente el documento maestro §5.4/§8.1).
   - Pros: sigue la regla de dependencia obligatoria (todo lo que tarda corre en Trigger.dev); reutiliza el patrón ya probado de Server Actions delgadas de `notebooks`; el polling con TanStack Query ya es un patrón existente en el editor (autosave).
   - Contras: Trigger.dev deploy es un paso de CI nuevo a mantener sincronizado con Vercel; latencia de cold start del free tier no está garantizada bajo el presupuesto de 60 s.
   - Esfuerzo: Medio.

2. **Supabase Edge Functions + pg_cron como alternativa** (mencionada solo como salida de contingencia en §4.2, fila Trigger.dev).
   - Pros: sin dependencia de un servicio externo adicional si Trigger.dev se agota o cae.
   - Contras: el documento maestro la marca como "alternativa" de mitigación, no como plan primario; Edge Functions de Supabase corren en Deno, no Node — `unpdf` dice soportar workers/edge, pero no está verificado contra el runtime específico de Supabase Edge Functions; añadiría una segunda forma de ejecutar trabajo en segundo plano cuando el resto del producto ya estandariza en Trigger.dev (Fase 3-8 también lo usan). No se investigó a fondo por ser explícitamente secundaria.
   - Esfuerzo: Alto (para no ganar nada hoy).

3. **Dónde vive el heurístico texto→bloques:**
   - **3a. Función pura en `ingestion.domain`** (paralelo exacto a `extractPlainText` en `notebooks.domain`): recibe `string[]` (una por página de `unpdf`) o el texto ya unido, devuelve `TiptapNode[]`. Testeable con Vitest sin mocks, sin tocar la tarea de Trigger.dev.
   - **3b. Lógica embebida dentro de la tarea de Trigger.dev**: más rápido de escribir, pero no testeable con TDD de dominio puro (rompe la convención `strict_tdd: true` y el patrón ya establecido en Fase 1) y mezcla la extracción de I/O con la lógica de conversión.
   - Recomendación clara: 3a. Es el único enfoque consistente con cómo se testeó `extractPlainText` y con `strict_tdd`.

## Recomendación

Enfoque 1 (Trigger.dev + Server Action delgada + polling) con el heurístico en `ingestion.domain` (3a). Es la única combinación que el documento maestro exige explícitamente y la que más reutiliza del trabajo ya hecho en Fase 1 (patrón de subida firmada, patrón de recorrido puro de AST, patrón de Server Action delgada con `Result<T, ActionError>`). La alternativa de Edge Functions + pg_cron queda documentada solo como nota de respaldo, sin diseño adicional.

## Riesgos

- **Sin descarga en `StorageGateway` actual**: hay que decidir el diseño del puerto de descarga antes de escribir la tarea; si se reutiliza el puerto de `notebooks` hay que exponerlo en `notebooks/index.ts`, lo cual amplía la superficie pública de ese módulo para uso de `ingestion` — revisar si eso respeta la regla 5.3.5.
- **Deploy de Trigger.dev no está automatizado**: si se olvida el paso de CI, un cambio en `src/trigger/` puede quedar desplegado en Vercel pero no en la plataforma de Trigger.dev (o viceversa), dejando la tarea desincronizada de la Server Action que la dispara.
- **Presupuesto de 60 s no tiene margen documentado**: cold start de Trigger.dev en el free tier, tiempo de cola, y el hecho de que `unpdf` en build serverless corre sin worker dedicado, son todas variables sin medir. No hay evidencia primaria del tiempo real de cold start del free tier de Trigger.dev.
- **`clickAndWaitForAction` en los fixtures e2e** puede dar falsos positivos en el e2e de importación de PDF si no se acota el predicado antes de escribirlo (deuda ya señalada en el cierre de Fase 1).
- **Bucket de PDFs nuevo** implica una migración RLS nueva y, típicamente, una verificación manual del usuario en `cogni-prod` (como ocurrió con `page-assets`), lo cual puede introducir el mismo tipo de tarea "usuario-owned pendiente" que quedó abierta en Fase 1.
- **Heurístico de "sin capa de texto"** no tiene una API dedicada en `unpdf`; se basa en inferencia (texto vacío/blanco), no en documentación oficial verificada.

## Decisiones abiertas (para preguntar al usuario antes de proponer)

1. **Nombre y límites del bucket de PDFs**: ¿bucket nuevo dedicado (p.ej. `page-pdfs`) con su propia variable de entorno servidor, o se reutiliza `page-assets` ampliando `allowed_mime_types`/`file_size_limit`? El límite actual de ese bucket (10 MB) probablemente sea insuficiente para PDFs de 30 páginas con imágenes incrustadas.
2. **Progreso en UI: polling vs Trigger.dev Realtime**. Polling con TanStack Query reutiliza un patrón ya existente (autosave) y no requiere tokens de acceso público de Trigger.dev; Realtime da una UX más inmediata pero añade una integración nueva no probada en el proyecto. ¿Cuál se prefiere?
3. **Punto de entrada de "Importar PDF" en la UI**: el documento maestro no especifica dónde vive el botón (¿sidebar del notebook, dentro de una página vacía, ambos?).
4. **Estrategia de e2e para Trigger.dev en CI**: ¿el spec de Playwright dispara una ejecución real contra el proyecto de Trigger.dev de desarrollo (como ya se hace con Supabase `cogni-dev`), con el tiempo de espera que eso implica, o se necesita un seam/mock para no depender de infraestructura externa en cada PR? Nota: hoy `pr.yml` no corre e2e; solo `main.yml` lo hace contra `cogni-dev`, así que el mismo patrón (secretos reales, sin mocks) podría extenderse a Trigger.dev.
5. **Regla exacta del heurístico de encabezados**: el documento maestro solo dice "títulos por heurística" sin especificar la regla (longitud de línea, mayúsculas, ausencia de puntuación final, etc.) — necesita definirse en la propuesta/spec, no en código.
6. **PDF con páginas mixtas (algunas con texto, algunas sin)**: ¿se marca todo el `ImportJob` como `failed`, o se importan solo las páginas con texto y se deja constancia de las que no lo tienen? El "hecho" de la fase solo cubre el caso de 30 páginas con capa de texto completa.

## Listo para propuesta

Sí, con la condición de que las 6 decisiones abiertas anteriores se resuelvan (al menos las 1, 2 y 6, que son arquitectónicas) antes o durante `sdd-propose`, ya que cambian el diseño del bucket, el mecanismo de progreso y el criterio de éxito parcial.
