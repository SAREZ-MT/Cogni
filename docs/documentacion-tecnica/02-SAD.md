# Documento de Arquitectura de Software (SAD) — Cogni

**Proyecto:** Cogni — plataforma web de estudio a partir de apuntes propios
**Versión:** 1.2
**Fecha:** 2026-10-26
**Estado:** Borrador
**Autor:** Javier Sarez
**Documentos relacionados:** ./01-SRS.md, ./03-DATA-API.md, ./04-ADR.md

---

## 0. Nota de estado actual (revisada el 2026-10-15 contra el código)

- Las Fases 0 a 7 están implementadas y los 11 módulos de `src/modules/` son reales; ninguno es un esqueleto.
  - Fase 0 (Cimientos) y Fase 1 (Cuadernos y editor): desplegadas en producción (`identity`, `notebooks`, `editor`).
  - Fase 2 (Importación de PDF): implementada bajo Organic Driven Development (ODD) el 2026-09-23 (`src/modules/ingestion`). Ampliada el 2026-10-26 (rama `feat/document-import`) a Word (`.docx`) con mammoth y officeparser y a PowerPoint (`.pptx`) con officeparser, imágenes importadas y un catálogo estricto de contenido. Decisiones en `docs/adr/0009-importacion-multiformato-y-catalogo-de-contenido.md`.
  - Fase 3 (Capa de IA, PR #63–#69) y aceptación de términos de uso (PR #70): `src/modules/ai` e `identity`; decisiones en `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md`.
  - Fase 4 (Motor de repetición y flashcards, PR #71–#77): `src/modules/study-engine` y `src/modules/flashcards`; decisiones en `docs/adr/0005-motor-de-repeticion-y-flashcards.md`.
  - Fase 5 (Exámenes, PR #78–#86): `src/modules/exams`; decisiones en `docs/adr/0006-examenes-y-repeticion-con-variantes.md`.
  - Fase 6 (Recordación activa, PR #87–#94): `src/modules/active-recall`; decisiones en `docs/adr/0007-recordacion-activa-y-generacion-incremental.md`.
  - Fase 7 (Calendario y dashboard, PR #95–#100): `src/modules/scheduling` y `src/modules/analytics`, sin tablas nuevas; decisiones en `docs/adr/0008-calendario-y-dashboard.md`.
- Fase 9 (Endurecimiento) está parcialmente cubierta: la Content Security Policy con nonce por petición, la redirección del dominio apex y la protección de sesión ya existen en `src/proxy.ts` y `src/shared/config/security-headers.ts`; el resto (registro de logs externo, pruebas de carga, auditoría de accesibilidad) no se ha iniciado.
- Todas las secciones de este documento describen arquitectura implementada y verificable contra el código de la rama principal; cada elemento de las tablas indica su estado.
- Referencias a decisiones: "`04-ADR.md`, ADR-0NN" designa una entrada del registro de decisiones de esta suite (`./04-ADR.md`); "`docs/adr/00NN`" designa un ADR numerado del repositorio. Son dos numeraciones distintas (por ejemplo, `04-ADR.md`, ADR-008 trata el Vercel AI SDK, mientras que `docs/adr/0008` trata el calendario y el dashboard).

### Documento vivo

Este documento se actualiza a medida que avanza la construcción de Cogni; la nota de estado de esta sección es el punto de anclaje de esas actualizaciones. Cuando una fase posterior (por ejemplo, la Fase 9) agregue contenedores, módulos o reglas, esta nota y las vistas afectadas se revisarán contra el código en la misma entrega.

### Correspondencia con las fases RAD

| Sección de este documento | Fase RAD | Uso en la tesis |
|---|---|---|
| 1. Introducción; 2, 3 y 4. Vistas de contexto, contenedores y componentes | Diseño de usuario | Muestra cómo el sistema se descompuso en piezas antes de programar, evidencia de diseño previo a la construcción. |
| 5. Vista de código; 7. Vista de módulos; 9. Patrones arquitectónicos | Construcción | Documenta la arquitectura tal como quedó construida (módulos reales, reglas de dependencia verificadas en CI, patrones aplicados), evidencia directa del trabajo de Construcción. |
| 8. Justificación del stack tecnológico | Planificación de requisitos / Diseño de usuario | Argumenta por qué se eligió cada tecnología frente a alternativas reales, insumo para sustentar decisiones de diseño ante el jurado. |
| 10. Flujos arquitectónicos clave | Construcción | Muestra el comportamiento real del sistema como evidencia de la lógica construida. |
| 6. Despliegue; 11. Infraestructura; 12. Seguridad; 13. Observabilidad | Implementación | Evidencia de cómo el sistema construido se despliega, opera y se protege, propia de la fase de Implementación. |

---

## 1. Introducción

### 1.1 Propósito

Este documento describe la arquitectura de software de Cogni usando el modelo C4 (Contexto, Contenedores, Componentes y Código de Simon Brown), complementado con una vista de despliegue, una vista de módulos propia del monolito modular y cinco flujos arquitectónicos clave. No se incluyen diagramas en formato Mermaid ni ningún otro código de diagrama: cada vista se describe como una tabla de elementos y una tabla o secuencia numerada de conexiones, con precisión suficiente para que un diagrama pueda construirse a partir de esa descripción con la herramienta `archify`. El documento cubre la arquitectura implementada de las Fases 0 a 7: identidad, cuadernos, editor, importación de PDF, capa de IA, motor de repetición espaciada, flashcards, exámenes, recordación activa, calendario y dashboard, marcando explícitamente el estado de cada elemento.

### 1.2 Atributos de calidad priorizados

| Prioridad | Atributo | Justificación |
|---|---|---|
| 1 | Costo cero de operación | El proyecto corre sobre planes gratuitos (Vercel Hobby, Supabase Free, Cloudflare DNS gratuito) sin fecha de monetización (`docs/documento-maestro.md` §4.2, §14; SRS §2.3). Toda decisión de infraestructura se evalúa primero contra este límite. |
| 2 | Simplicidad para un equipo de una persona | Cogni lo construye y mantiene una sola persona (`docs/documento-maestro.md` §14, riesgo "Una sola persona desarrollando"). Se prioriza un stack con curva de aprendizaje conocida y una arquitectura que un solo desarrollador pueda razonar por completo. |
| 3 | Mantenibilidad por arquitectura verificable | Los límites entre capas y módulos se verifican automáticamente en cada `pull request`, no solo por convención (RNF-M-01 a RNF-M-06; `.dependency-cruiser.cjs`, `tsconfig.json`, `.github/workflows/pr.yml`). |
| 4 | Seguridad de los datos del estudiante | Cada estudiante solo puede ver y modificar sus propios cuadernos, páginas y archivos (RNF-S-01 a RNF-S-08; Row Level Security, `src/proxy.ts`, `security-headers.ts`). |
| 5 | Rendimiento percibido del editor | El autoguardado y la importación de documentos tienen presupuestos de tiempo explícitos y verificados por prueba (RNF-P-01 a RNF-P-05; `debounceMs`, `maxDuration`). |

---

## 2. Vista de contexto — C4 Nivel 1

> Diagrama a construir con archify a partir de esta descripción.

### 2.1 Elementos

| Elemento | Tipo | Responsabilidad | Estado |
|---|---|---|---|
| Estudiante | Actor humano | Escribe o importa apuntes, genera material de estudio y lo repasa con flashcards, exámenes y recordación activa (SRS §2.2). | Implementado |
| Cogni | Sistema de software | La plataforma web en sí: organiza apuntes en cuadernos y páginas, genera material de estudio con IA y coordina flashcards, exámenes y recordación activa con un motor de repetición espaciada, un calendario y un dashboard. | Implementado |
| Supabase — Auth, Postgres, Storage | Sistema externo (BaaS) | Autentica al estudiante, persiste todos los datos relacionales y almacena imágenes y documentos importados en buckets privados. | Implementado |
| Google (OAuth) | Sistema externo | Proveedor de identidad federada; el navegador del estudiante navega directamente a su pantalla de consentimiento antes de volver a Cogni (`form-action` de la CSP incluye `https://accounts.google.com`). | Implementado |
| Vercel (Cron) | Sistema externo | Dispara dos peticiones HTTP diarias autenticadas: `/api/keep-alive` (evita que el proyecto gratuito de Supabase se pause) y `/api/recompute-mastery` (recalcula el nivel de dominio de las páginas). | Implementado |
| Cloudflare (DNS) | Sistema externo | Registrador y proveedor de DNS del dominio canónico; resuelve el dominio antes de que cualquier petición llegue a Vercel. No recibe llamadas de la aplicación en tiempo de ejecución. | Implementado |
| Proveedores de IA (Google AI Studio — Gemini, Groq, Cloudflare Workers AI, OpenRouter) | Sistema externo | Generan flashcards, preguntas de examen y sus variantes, preguntas de recordación activa y retroalimentación de sesión, y evalúan respuestas abiertas, a través del Vercel AI SDK (`src/modules/ai/infrastructure/provider-registry.ts`). | Implementado |
| Upstash Redis | Sistema externo (Redis serverless, REST) | Guarda el estado compartido entre invocaciones de la capa de IA: límites diarios por estudiante (generaciones y evaluaciones), cuota diaria por proveedor y estado del *circuit breaker* (`src/modules/ai/infrastructure/upstash-*.ts`). | Implementado |
| Sentry | Sistema externo | Recibe errores no controlados de Server Components, Server Actions y Route Handlers. | Implementado |
| PostHog | Sistema externo | Recibe cinco eventos de producto explícitos (`user_signed_up`, `user_signed_in`, `document_imported`, `generation_requested`, `terms_accepted`). | Implementado |

### 2.2 Conexiones

| Origen | Destino | Protocolo / mecanismo | Dirección | Descripción |
|---|---|---|---|---|
| Estudiante | Cogni | HTTPS (navegador) | Estudiante → Cogni | Navega la aplicación, escribe apuntes, importa documentos (PDF, Word y PowerPoint). |
| Cogni | Supabase Auth | HTTPS, `@supabase/ssr` (cookies de sesión) | Cogni → Supabase | Registro, inicio de sesión, verificación de correo, recuperación de contraseña. |
| Estudiante (navegador) | Google | Redirección HTTP + consentimiento OAuth | Estudiante → Google → Cogni (`/auth/callback`) | Inicio de sesión con Google (RF-ID-02). |
| Cogni | Supabase Postgres | Drizzle ORM sobre `postgres.js` (TCP, *transaction pooler*, `max: 1`) | Cogni → Supabase | Lectura/escritura de las 20 tablas del esquema (cuadernos, páginas, adjuntos, importaciones, generaciones de IA, material de estudio, estado SM-2, sesiones y respuestas). |
| Cogni / Estudiante (navegador) | Supabase Storage | HTTPS, URL firmada (subida directa) y API con `service role` (servidor) | Bidireccional | Subida de imágenes y documentos, lectura de adjuntos; el servidor sube las imágenes extraídas de un documento importado. |
| Vercel Cron | Cogni (`/api/keep-alive`, `/api/recompute-mastery`) | HTTPS GET, `Authorization: Bearer <CRON_SECRET>` | Vercel → Cogni | Mantiene activo el proyecto gratuito de Supabase y al día el nivel de dominio de cada página (RNF-F-01). |
| Cogni | Proveedores de IA | HTTPS, Vercel AI SDK (`generateObject`), salida estructurada validada con Zod | Cogni → Proveedor | Generación y evaluación de material de estudio. |
| Cogni | Upstash Redis | HTTPS (API REST de `@upstash/redis`, `@upstash/ratelimit`) | Cogni → Upstash | Consulta y consume límites diarios, cuota por proveedor y estado del *circuit breaker*. |
| Cogni | Sentry | HTTPS (túnel `/monitoring` en el navegador; SDK directo en servidor) | Cogni → Sentry | Reporta excepciones no controladas. |
| Cogni | PostHog | HTTPS (`posthog-js` en navegador, `posthog-node` en servidor) | Cogni → PostHog | Envía eventos de producto explícitos. |

---

## 3. Vista de contenedores — C4 Nivel 2

> Diagrama a construir con archify a partir de esta descripción.

### 3.1 Elementos

| Contenedor | Tecnología | Responsabilidad | Estado |
|---|---|---|---|
| Aplicación web Cogni | Next.js 16 (App Router) sobre Vercel, TypeScript | Sirve la interfaz (Server/Client Components), ejecuta Server Actions y Route Handlers, y aplica el proxy de sesión y las cabeceras de seguridad. | Implementado |
| Proxy de sesión | `src/proxy.ts` (Next.js `proxy`, ejecutado en cada petición) | Refresca la sesión de Supabase, genera el nonce de CSP por petición, redirige al apex canónico y protege rutas sin sesión. | Implementado |
| Base de datos Postgres | Supabase Postgres, Drizzle ORM | Persiste las 20 tablas del esquema (`src/shared/db/schema.ts`), todas con Row Level Security activa. | Implementado |
| Almacenamiento de objetos | Supabase Storage (buckets `page-assets`, `page-pdfs`) | Guarda imágenes de página (también las extraídas de documentos importados) y documentos subidos (PDF, DOCX y PPTX en `page-pdfs`, nombre histórico), con políticas RLS por `owner_id`. | Implementado |
| Servicio de identidad | Supabase Auth | Emite y valida sesiones (correo/contraseña y Google OAuth). | Implementado |
| Programador de tareas | Vercel Cron (`vercel.json`) | Dispara `/api/keep-alive` (`0 6 * * *`) y `/api/recompute-mastery` (`30 6 * * *`) una vez al día. | Implementado |
| Registro de proveedores de IA | Vercel AI SDK (lógico, dentro de la aplicación) | Selecciona y rota entre proveedores de IA por cuota y salud (`src/modules/ai/infrastructure/provider-registry.ts`). | Implementado |
| Almacén de límites de IA | Upstash Redis (`@upstash/redis`, `@upstash/ratelimit`) | Guarda límites diarios por estudiante, cuota diaria por proveedor y estado del *circuit breaker*, con claves bajo `REDIS_KEY_PREFIX`. Con `AI_PROVIDER_MODE=fake` (CI y e2e) se sustituye por almacenes en memoria. | Implementado |
| Monitoreo de errores | Sentry (`@sentry/nextjs`) | Captura excepciones de servidor y cliente. | Implementado |
| Analítica de producto | PostHog (`posthog-js`, `posthog-node`) | Registra eventos de producto explícitos. | Implementado |

### 3.2 Conexiones

| Origen | Destino | Protocolo / mecanismo | Dirección |
|---|---|---|---|
| Estudiante (navegador) | Aplicación web Cogni | HTTPS | Bidireccional |
| Proxy de sesión | Servicio de identidad | `@supabase/ssr`, cookies HTTP-only | Bidireccional |
| Aplicación web Cogni | Base de datos Postgres | Drizzle ORM / `postgres.js` (TCP, pooler de transacciones) | Aplicación → Base de datos |
| Aplicación web Cogni (servidor) | Almacenamiento de objetos | API de Storage con `service role` | Aplicación → Storage |
| Estudiante (navegador) | Almacenamiento de objetos | `PUT` HTTPS directo a una URL firmada | Navegador → Storage |
| Programador de tareas | Aplicación web Cogni | HTTPS GET autenticado con `CRON_SECRET` | Programador → Aplicación |
| Aplicación web Cogni | Registro de proveedores de IA | Llamada de función interna (`ai.generateStructured`) | Aplicación → Registro |
| Registro de proveedores de IA | Proveedores de IA externos | HTTPS, respuesta estructurada completa (`generateObject`, sin *streaming*) | Registro → Proveedor |
| Aplicación web Cogni | Almacén de límites de IA | HTTPS (API REST de Upstash) | Aplicación → Upstash |
| Aplicación web Cogni | Monitoreo de errores | HTTPS (SDK de Sentry, túnel `/monitoring`) | Aplicación → Sentry |
| Aplicación web Cogni | Analítica de producto | HTTPS (SDK de PostHog) | Aplicación → PostHog |

---

## 4. Vista de componentes — C4 Nivel 3

> Diagrama a construir con archify a partir de esta descripción.

La aplicación web Cogni (el contenedor Next.js) se descompone en el proxy, el árbol de rutas de `src/app`, los 11 módulos de `src/modules/*` y la capa compartida `src/shared/*`. Cada módulo sigue la forma hexagonal `domain → application → infrastructure/ui` descrita en la sección 7; cada componente de la tabla es el conjunto de las capas de ese módulo y sus entradas públicas.

### 4.1 Tabla de componentes

| Componente | Responsabilidad | Tecnología | Estado |
|---|---|---|---|
| `src/proxy.ts` | Refresca sesión, genera nonce de CSP, redirige apex/`www`, protege rutas sin sesión. | Next.js `proxy` | Implementado |
| `src/app` (App Router) | Páginas, layouts y Route Handlers (`/api/keep-alive`, `/api/recompute-mastery`, `/auth/callback`); shell autenticado y shell público (incluida `/terminos`). | Next.js App Router, React Server Components | Implementado |
| `identity` | Registro, inicio de sesión (correo y Google), recuperación de contraseña, perfil del estudiante, aceptación de términos de uso y zona horaria. | Supabase Auth, `@supabase/ssr` | Implementado |
| `notebooks` | Cuadernos, páginas, `plain_text` materializado, adjuntos de imagen; sus Server Actions satisfacen la forma del `SavePagePort` del editor (la ruta de página compone el puerto) y `server-api.ts` sirve a otros módulos. | Drizzle ORM, Supabase Storage | Implementado |
| `editor` | Autoguardado, estado de conflicto de versión y el editor de bloques Tiptap (menú `/`, barra contextual, resaltado); declara su propio `SavePagePort`. | Tiptap 3, TanStack Query | Implementado |
| `ingestion` | Importación de un documento PDF, Word o PowerPoint a una página editable, con `ImportJob` como máquina de estados, imágenes importadas y límites por usuario. | `mammoth`, `officeparser`, Supabase Storage, `src/shared/rate-limit` | Implementado (PDF, Word y PowerPoint) |
| `ai` | Registro de proveedores de IA, rotación por cuota y salud, *circuit breaker*, límites diarios por estudiante, salida estructurada validada con Zod, prompts versionados y auditoría de cada intento (`ai_generations`). | Vercel AI SDK 7, Upstash Redis | Implementado (Fase 3) |
| `study-engine` | Estado SM-2 por ítem (`StudyItem`), historial (`ReviewLog`), nivel de dominio por página (`PageMastery`), sesiones de flashcards y retroalimentación de sesión; registra los repasos de exámenes y recordación activa. | Drizzle ORM | Implementado (Fase 4; ver §5.2) |
| `flashcards` | Mazo de tarjetas por página, generación incremental con IA, tarjetas manuales y retroalimentación de la sesión de repaso. | Drizzle ORM | Implementado (Fase 4; ver §10.2) |
| `exams` | Preguntas de opción múltiple, sesiones de examen, corrección determinista, repetición con variantes reformuladas y retroalimentación. | Drizzle ORM | Implementado (Fase 5; ver §10.3) |
| `active-recall` | Preguntas abiertas, sesiones de respuesta, evaluación combinada IA + autoevaluación; expone `calibration.ts` como entrada solo de dominio. | Drizzle ORM | Implementado (Fase 6; ver §10.4) |
| `scheduling` | Calendario y vista "Hoy" de repasos vencidos. | Drizzle (lectura) | Implementado (Fase 7; ver §10.5) |
| `analytics` | Dashboard de progreso, métricas por técnica, calibración metacognitiva. | Drizzle (lectura), Recharts en la ruta | Implementado (Fase 7; ver §10.5) |
| `shared/config` | Validación de variables de entorno (Zod), cabeceras de seguridad, patrones de imágenes remotas. | Zod | Implementado |
| `shared/db` | Cliente único de Postgres (Drizzle + `postgres.js`) y el esquema de las 20 tablas. | Drizzle ORM | Implementado |
| `shared/kernel` | Primitivas transversales puras: `Clock`, `DomainError`/`ActionError`, `createId` (UUID v7), tipo `Result`, tipos del documento Tiptap (`tiptap-doc.ts`), catálogo estricto de contenido (`tiptap-catalogue.ts`), umbrales de dominio (`mastery-thresholds.ts`), párrafos de página, conteo de palabras y huellas de generación. | TypeScript puro | Implementado |
| `shared/observability` | Puerto `Analytics` (PostHog) y opciones de Sentry compartidas. | `@sentry/nextjs`, `posthog-node` | Implementado |
| `shared/rate-limit` | Limitador por clave con ventana deslizante en Upstash (`AI_PROVIDER_MODE=live`) o ventana fija en memoria (resto); falla abierto ante un error de Upstash. Lo usa `ingestion`. | `@upstash/ratelimit` | Implementado |
| `shared/ui` | Primitivos de estilo shadcn/ui (`Button`, `Dialog`, `DropdownMenu`, etc.) y unos 60 átomos de dominio (`Card`, `Pill`, `KpiCard`, `CalendarGrid`, `FlipCard`, `Chart`, `Sparkline`, etc.), documentados en `docs/design-system/ATOMS.md`. | Radix UI, `class-variance-authority`, Recharts | Implementado |

---

## 5. Vista de código — C4 Nivel 4

Esta vista se limita a dos módulos, ambos con código suficientemente cargado de decisiones: `ingestion` (la máquina de estados de la importación de documentos) y `study-engine` (el algoritmo central del producto).

### 5.1 `ingestion` — implementado

> Diagrama a construir con archify a partir de esta descripción.

#### 5.1.1 Elementos

| Elemento | Tipo | Responsabilidad |
|---|---|---|
| `ImportJob` | Entidad + máquina de estados (`domain/import-job.ts`) | Representa una importación con su formato (`format`) y las imágenes omitidas (`skippedImages`); expone `createImportJob`, `start`, `complete`, `fail`, `isTerminal`, `isAbandoned`. |
| `ImportJobStatus` | Tipo (`domain/import-job.ts`) | Unión de cadenas: `"queued"`, `"processing"`, `"done"`, `"failed"`. |
| `ImportFailureKind` | Tipo (`domain/import-failure.ts`) | `download`, `invalid_document`, `unsupported_format`, `no_text_layer`, `empty_document`, `persistence`, `timeout`, cada uno con su mensaje en español. |
| `detectDocumentFormat` | Función de dominio pura (`domain/document-format.ts`) | Detecta el formato por los bytes reales: `%PDF-`, o un ZIP con `[Content_Types].xml` y `word/document.xml` (DOCX) o `ppt/presentation.xml` (PPTX); OLE2 → `legacy`. |
| `inspectOoxmlPackage` | Función de dominio pura (`domain/ooxml-guard.ts`) | Revisa el directorio central del ZIP antes de analizar y rechaza un paquete no confiable o que declare demasiado (`OOXML_LIMITS`). |
| `textToBlocks` | Función de dominio pura (`domain/text-to-blocks.ts`) | Convierte el texto de un PDF de solo párrafos en bloques Tiptap mediante heurísticas deterministas (respaldo del adaptador PDF desde T8). |
| `ImportedDoc` | Tipo (`domain/imported-doc.ts`) | Documento importado restringido a los bloques del catálogo de contenido (`src/shared/kernel/tiptap-catalogue.ts`). |
| `resolvePendingImages` | Función de dominio pura (`domain/pending-images.ts`) | Cambia el `pendingId` de cada imagen guardada por su `assetId` y quita las que no se guardaron, a cualquier profundidad. |
| `PdfStorageGateway` | Puerto (`domain/pdf-storage-gateway.ts`) | Subida firmada, metadatos y descarga del documento subido (conserva su nombre de la era PDF). |
| `DocumentExtractor` | Puerto (`domain/document-extractor.ts`) | Extrae de los bytes y el formato un `ExtractedDocument`: contenido, páginas, imágenes e imágenes omitidas. |
| `NotebookPagesPort` | Puerto (`domain/notebook-pages-port.ts`) | Busca cuadernos/páginas, escribe el contenido importado y guarda o borra las imágenes importadas, sin depender de `notebooks` directamente. |
| `ImportJobRepository` | Puerto (`domain/import-job-repository.ts`) | Persistencia de `ImportJob` mediante transiciones atómicas, con el tope atómico de importaciones activas. |
| `ImportRateLimiter` | Puerto (`domain/import-rate-limiter.ts`) | Límites por estudiante de permisos de subida e inicios por hora; implementado con `src/shared/rate-limit`. |
| `SupabasePdfStorageGateway` | Adaptador (`infrastructure/`) | Implementa `PdfStorageGateway` contra el bucket `page-pdfs`. |
| `FormatRoutingDocumentExtractor` | Adaptador (`infrastructure/`) | Implementa `DocumentExtractor` eligiendo el adaptador del formato (`createDocumentExtractor()`). |
| `PdfDocumentExtractor` | Adaptador (`infrastructure/`) | Lee el PDF con officeparser (geometría activada, pdf.js en un proceso aparte, a lo sumo `PDF_LIMITS.maxPages` páginas) y `pdf-ast-mapper.ts` emite títulos, formato en línea, enlaces, listas, tablas, código e imágenes; si el árbol no tiene títulos, listas ni tablas, aplica `textToBlocks` al texto de cada página. Si pdf.js no puede correr en su proceso, analiza en el del servidor bajo `PDF_IN_PROCESS_LIMITS` (50 páginas, topes de texto y de contenido más estrictos) y lo informa a Sentry como advertencia en cada análisis. |
| `DocxDocumentExtractor` | Adaptador (`infrastructure/`) | Lee el Word con mammoth (estructura) y officeparser (colores, numeración, ecuaciones), uno después del otro, sobre un `OoxmlPackage` que infla cada parte con tope de salida. |
| `PptxDocumentExtractor` | Adaptador (`infrastructure/`) | Lee el PowerPoint con officeparser sobre el mismo `OoxmlPackage`; del XML de las diapositivas (`domain/pptx-xml.ts`) toma el orden, las diapositivas y formas ocultas, las viñetas heredadas del patrón y las celdas combinadas de las tablas; `pptx-slide-mapper.ts` emite por diapositiva título, cuerpo y notas del orador ("Notas del orador"). |
| `NotebooksPagesAdapter` | Adaptador (`infrastructure/`) | Implementa `NotebookPagesPort` envolviendo `createNotebooksServerApi` de `notebooks` (incluidos `storeImportedAsset` y `deleteImportedAssets`). |
| `DrizzleImportJobRepository` | Adaptador (`infrastructure/`) | Implementa `ImportJobRepository` sobre la tabla `import_jobs`. |
| `ImportTelemetryAdapter` | Adaptador (`infrastructure/`) | Reporta a Sentry y registra el evento `document_imported` en PostHog. |
| `requestPdfUpload`, `startPdfImport`, `processImportJob`, `getImportJobStatus`, `getActiveImports` | Casos de uso (`application/`) | Orquestan el ciclo completo de importación (conservan sus nombres de la era PDF). |

#### 5.1.2 Relaciones

1. `requestPdfUpload` valida tipo, tamaño y nombre, consume `UPLOAD_GRANTS_PER_HOUR` e invoca `PdfStorageGateway.createSignedUploadUrl`.
2. `startPdfImport` revalida los metadatos reales del objeto, consume `IMPORT_STARTS_PER_HOUR`, crea la página e invoca `ImportJobRepository.create` (idempotente por `storagePath`, con `maxActiveJobs = MAX_ACTIVE_IMPORTS` aplicado bajo un candado consultivo por dueño) con un `ImportJob` de `createImportJob`.
3. `processImportJob` invoca `ImportJobRepository.claim` (aplica `start` sobre el `ImportJob`), luego `PdfStorageGateway.download`, `detectDocumentFormat` y `DocumentExtractor.extract` en carrera contra `PROCESSING_BUDGET_MS`; después guarda cada imagen con `NotebookPagesPort.storeImportedAsset` mientras quede más de `IMAGE_UPLOAD_RESERVE_MS`, aplica `resolvePendingImages`, invoca `NotebookPagesPort.writeImportedContent` y finalmente `ImportJobRepository.markDone` (aplica `complete`, con `skippedImages`) o `ImportJobRepository.markFailed` (aplica `fail`) según el resultado. Si la escritura devuelve un error, borra las imágenes guardadas con `deleteImportedAssets`.
4. `processImportJob` invoca `ImportTelemetryAdapter.finished` exactamente una vez por transición terminal.
5. `getImportJobStatus` busca el job por (página, dueño), responde `null` para una página ajena y usa `ImportJob.isAbandoned` (función de solo lectura) para reportar como fallido por tiempo agotado un job que el runtime ya interrumpió, sin escribir ese estado.
6. `SupabasePdfStorageGateway` implementa `PdfStorageGateway`; `FormatRoutingDocumentExtractor` implementa `DocumentExtractor` y delega en `PdfDocumentExtractor`, `DocxDocumentExtractor` o `PptxDocumentExtractor`; `NotebooksPagesAdapter` implementa `NotebookPagesPort`; `DrizzleImportJobRepository` implementa `ImportJobRepository`.
7. `DrizzleImportJobRepository` persiste sobre la tabla `import_jobs` (Postgres) mediante una sentencia `UPDATE ... RETURNING` atómica por cada transición.
8. Solo `src/modules/ingestion/infrastructure/` puede importar `mammoth` y `officeparser` (reglas `mammoth-only-in-ingestion-infra` y `officeparser-only-in-ingestion-infra` de `.dependency-cruiser.cjs`): mammoth lo importa `docx-document-extractor.ts`, y officeparser, los tres adaptadores de formato. Ningún módulo puede importar `unpdf` ni `pdfjs-dist` (regla `no-in-process-pdfjs`): otro pdf.js cargado en el proceso del servidor publica un trabajador global que officeparser toma como propio y rompe sus análisis de PDF.

### 5.2 `study-engine` — implementado

> Diagrama a construir con archify a partir de esta descripción.

**Implementado (Fase 4)** — `src/modules/study-engine`; decisiones en `docs/adr/0005-motor-de-repeticion-y-flashcards.md`; algoritmo especificado en `docs/documento-maestro.md` §7. Siguiendo la nota de implementación de `docs/documento-maestro.md` §5.2 y las notas de §6.1, `study-engine` también persiste las sesiones de flashcards (`FlashcardSession`) y la retroalimentación de sesión (`SessionFeedback`), y ofrece la sesión de repaso de flashcards (iniciar, calificar, terminar) como API de servidor.

#### 5.2.1 Elementos

| Elemento | Tipo | Responsabilidad |
|---|---|---|
| `StudyItem` | Entidad (`domain/study-item.ts`) | Estado SM-2 de un ítem (`kind`: `flashcard`, `exam_question` o `recall_question`): intervalo, factor de facilidad, repeticiones, vencimiento (`due_at`), fallos (`lapses`) y suspensión. |
| `ReviewLog` | Entidad (`domain/review-log.ts`) | Registro histórico de cada calificación; `session_kind` (`flashcards`, `exam`, `recall`) indica a qué tipo de sesión apunta `session_id`. |
| `PageMastery` | Entidad (`domain/page-mastery.ts`) | Nivel de dominio derivado por página (`Nuevo`, `Aprendiendo`, `Consolidando`, `Dominado`) y su `score` numérico. |
| `FlashcardSession` | Entidad (`domain/flashcard-session.ts`) | Sesión de repaso de flashcards (`page_id` nulo en la vista "Hoy" multipágina), con contadores `reviewed_count` y `again_count`; abierta mientras `finished_at` es nulo. |
| `SessionFeedback` | Entidad (`domain/session-feedback.ts`) | Retroalimentación de IA de una sesión terminada, una fila por (`session_kind`, `session_id`), compartida por flashcards y exámenes; la recordación activa no la crea (`docs/adr/0007`). |
| `applySm2` | Función de dominio pura (`domain/sm2.ts`) | `applySm2(state, quality, now) → newState`, el algoritmo SM-2 (`docs/documento-maestro.md` §7.1). |
| `computeMastery` | Función de dominio pura (`domain/mastery.ts`) | Calcula el `score` y el nivel de dominio de una página a partir del estado SM-2 de sus ítems (§7.3), con los umbrales compartidos de `src/shared/kernel/mastery-thresholds.ts`. |
| `startFlashcardSession`, `gradeFlashcard`, `finishFlashcardSession` | Casos de uso (`application/`) | Sesión de repaso de flashcards; `gradeFlashcard` escribe en una sola unidad de trabajo el nuevo estado del `StudyItem`, su `ReviewLog`, los contadores de la sesión y el `PageMastery` de la página. |
| `recordExamReviews`, `recordRecallReviews` | Casos de uso (`application/`) | Registran los repasos de un examen terminado y de las respuestas de recordación evaluadas (SM-2, `ReviewLog`, `PageMastery`). |
| `recomputeAllPageMastery` | Caso de uso (`application/`) | Recalcula el dominio de las páginas más desactualizadas primero, dentro de un presupuesto de tiempo, para el cron diario. |
| `DrizzleStudyUnitOfWork` y repositorios Drizzle | Adaptadores (`infrastructure/`) | Persisten `study_items`, `review_logs`, `page_mastery` y `flashcard_sessions` dentro de una transacción (`StudyRepositories`); `session_feedback` se escribe fuera de ella con `DrizzleSessionFeedbackRepository` (`createSessionFeedbackSources`, `server-api.ts`). |
| `server-api.ts` | API de servidor (exportada por `index.ts`) | `createStudyItemRepository`, `createPageMasteryReader`, `createFlashcardSessionsServerApi`, `createExamReviewRecorder`, `createRecallReviewRecorder`, `createSessionFeedbackSources` y `createMasteryRecomputeJob`. |

#### 5.2.2 Relaciones

1. `flashcards`, `exams` y `active-recall` crean el `StudyItem` de cada ítem nuevo con `createStudyItemRepository`, sobre la misma transacción en que guardan sus tarjetas o preguntas.
2. `flashcards` invoca `createFlashcardSessionsServerApi` (iniciar, calificar, terminar); `gradeFlashcard` aplica `applySm2`, escribe un `ReviewLog(session_kind = flashcards)`, actualiza los contadores de la sesión y recalcula `PageMastery` con `computeMastery`, todo en una transacción (`DrizzleStudyUnitOfWork`).
3. `exams` invoca `createExamReviewRecorder` dentro de la transacción que cierra el examen (punto de guardado), y `active-recall` invoca `createRecallReviewRecorder` tras evaluar las respuestas; ambos aplican `applySm2`, escriben `ReviewLog` y recalculan `PageMastery`.
4. `flashcards` y `exams` leen y escriben su `SessionFeedback` con `createSessionFeedbackSources`.
5. `active-recall` lee el nivel de dominio con `createPageMasteryReader`; `src/app/api/recompute-mastery/route.ts` ejecuta `createMasteryRecomputeJob`.
6. `study-engine` nunca importa un módulo de técnica: la regla `study-engine-knows-no-technique` de `.dependency-cruiser.cjs` prohíbe cualquier import de `flashcards`, `exams` o `active-recall` desde `study-engine`. Eso es lo que la arquitectura garantiza; el motor sí conoce la sesión de flashcards y el tipo de sesión (`session_kind`) como datos, por decisión de `docs/adr/0005`.

Nota de la Fase 7 (`docs/adr/0008`): `scheduling` y `analytics` no leen por un puerto de `study-engine`, que no ofrece lecturas por dueño y rango; cada uno tiene lectores Drizzle propios de solo lectura. `scheduling` lee `study_items`, `pages` y `notebooks`; `analytics` lee `review_logs`, `study_items`, `page_mastery`, `exam_answers`, `exam_sessions`, `recall_answers` y `recall_sessions`, unidas a `pages` y `notebooks` (§10.5). Ninguno calcula vencimientos ni dominio ni escribe en esas tablas.

### 5.3 Detalle de interfaces y tipos clave

Bloques copiados verbatim de `src/modules/ingestion/domain/` (sin comentarios de línea completa).

```ts
// src/modules/ingestion/domain/import-job.ts
export const IMPORT_JOB_STATUS = [
  "queued",
  "processing",
  "done",
  "failed",
] as const;

export type ImportJobStatus = (typeof IMPORT_JOB_STATUS)[number];

export interface ImportJob {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly sizeBytes: number; // from the real Storage object
  readonly format: DocumentFormat;
  readonly status: ImportJobStatus;
  readonly pageCount: number | null; // null until known
  readonly pagesWithoutText: number; // starts at 0
  readonly skippedImages: number; // starts at 0
  readonly error: string | null; // UI-safe Spanish message, only when failed
  readonly startedAt: Date | null; // start of processing
  readonly finishedAt: Date | null; // terminal instant
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

```ts
// src/modules/ingestion/domain/notebook-pages-port.ts
export interface NotebookPagesPort {
  findActiveNotebook(
    ownerId: string,
    notebookId: string,
  ): Promise<{ id: string } | null>;
  createPage(
    ownerId: string,
    input: { notebookId: string; title?: string },
  ): Promise<Result<{ id: string; notebookId: string }, DomainError>>;
  findPageNotebookId(ownerId: string, pageId: string): Promise<string | null>;
  writeImportedContent(
    ownerId: string,
    input: { pageId: string; content: ImportedDoc; expectedVersion: number },
  ): Promise<Result<{ version: number }, DomainError>>;
  storeImportedAsset(
    ownerId: string,
    input: { pageId: string; bytes: Uint8Array; mime: string },
  ): Promise<Result<{ assetId: string }, DomainError>>;
  deleteImportedAssets(
    ownerId: string,
    assetIds: readonly string[],
  ): Promise<void>;
}
```

```ts
// src/modules/ingestion/domain/document-extractor.ts
export type ExtractedImage = {
  key: string;
  bytes: Uint8Array;
  mime: string;
  alt: string | null;
};

export type ExtractedDocument = {
  content: ImportedDoc;
  totalPages: number;
  pagesWithoutText: number;
  images: ExtractedImage[];
  skippedImages: number;
};

export type ExtractOptions = { signal?: AbortSignal };

export interface DocumentExtractor {
  extract(
    bytes: Uint8Array,
    format: DocumentFormat,
    options?: ExtractOptions,
  ): Promise<Result<ExtractedDocument, DomainError>>;
}
```

```ts
// src/modules/ingestion/domain/pdf-storage-gateway.ts
export interface PdfStorageGateway {
  createSignedUploadUrl(
    path: string,
  ): Promise<{ signedUrl: string; token: string; bucket: string }>;
  getObjectMetadata(
    path: string,
  ): Promise<{ sizeBytes: number; mime: string } | null>;
  download(
    path: string,
    options?: { signal?: AbortSignal },
  ): Promise<Uint8Array | null>;
}
```

```ts
// src/modules/ingestion/domain/import-job-repository.ts
export interface ImportJobRepository {
  create(
    job: ImportJob,
    options?: { maxActiveJobs?: number },
  ): Promise<Result<void, DomainError>>;
  findById(id: string): Promise<ImportJob | null>;
  findByStoragePath(storagePath: string): Promise<ImportJob | null>;
  findLatestByPage(pageId: string, ownerId?: string): Promise<ImportJob | null>;
  listActivePageIds(ownerId: string): Promise<string[]>;
  countActiveJobs(ownerId: string, now: Date): Promise<number>;
  claim(input: { id: string; now: Date }): Promise<ImportJob | null>;
  markDone(input: {
    id: string;
    pageCount: number;
    pagesWithoutText: number;
    skippedImages: number;
    now: Date;
  }): Promise<ImportJob | null>;
  markFailed(input: {
    id: string;
    kind: ImportFailureKind;
    message: string;
    pageCount?: number;
    pagesWithoutText?: number;
    now: Date;
  }): Promise<ImportJob | null>;
}
```

```ts
// src/modules/ingestion/domain/import-budget.ts
export const MAX_DURATION_S = 120;
export const PROCESSING_BUDGET_MS = 100_000;
export const IMAGE_UPLOAD_RESERVE_MS = 10_000;
export const ABANDONED_AFTER_MS = (MAX_DURATION_S + 30) * 1000;
```

```ts
// src/modules/ingestion/domain/import-rate-limiter.ts
export interface ImportRateLimiter {
  consume(ownerId: string): Promise<{ allowed: boolean }>;
}

const HOUR_MS = 60 * 60 * 1000;

export const IMPORT_STARTS_PER_HOUR = { limit: 10, windowMs: HOUR_MS };
export const UPLOAD_GRANTS_PER_HOUR = { limit: 20, windowMs: HOUR_MS };
export const MAX_ACTIVE_IMPORTS = 3;
```

```ts
// src/modules/ingestion/domain/document-file.ts (extracto)
export const PDF_MIME = "application/pdf";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const MAX_DOCUMENT_BYTES = 20_971_520;
export const UPLOAD_GRANT_TTL_MS = 10 * 60 * 1000; // C3: 10-minute upload grant
```

```ts
// src/modules/ingestion/domain/document-format.ts (extracto)
export const DOCUMENT_FORMATS = ["pdf", "docx", "pptx"] as const;
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number];
export type DetectedFormat = DocumentFormat | "legacy" | "unknown";
export function detectDocumentFormat(bytes: Uint8Array): DetectedFormat {
  // …
}
```

---

## 6. Diagrama de despliegue

> Diagrama a construir con archify a partir de esta descripción.

### 6.1 Descripción de nodos de despliegue

| Nodo | Tipo | Descripción | Tecnología/Servicio |
|---|---|---|---|
| Dispositivo del estudiante | Cliente | Navegador de escritorio o móvil que ejecuta la interfaz de Cogni. | Navegador web |
| Cloudflare (DNS) | Servicio de red | Resuelve el dominio canónico de Cogni antes de que la petición llegue a Vercel; también actúa como registrador. | Cloudflare DNS |
| Vercel (funciones y borde) | Plataforma de cómputo serverless | Ejecuta la aplicación Next.js: Server Components, Server Actions y Route Handlers, con Fluid Compute para invocaciones más largas (importación de documentos y acciones de la página de examen con `maxDuration = 120`; evaluación de recordación activa y recálculo de dominio con `maxDuration = 300`). | Vercel (funciones Node.js) |
| Vercel Cron | Programador gestionado | Invoca `/api/keep-alive` y `/api/recompute-mastery` diariamente según `vercel.json`. | Vercel Cron |
| Supabase Postgres | Servicio de base de datos gestionado | Almacena las 20 tablas del esquema, todas con RLS activa. | Supabase (Postgres) |
| Supabase Storage | Servicio de almacenamiento de objetos gestionado | Guarda imágenes de página (`page-assets`) y documentos importados (`page-pdfs`, PDF, DOCX y PPTX) en buckets privados. | Supabase (Storage, compatible S3) |
| Supabase Auth | Servicio de identidad gestionado | Emite y valida sesiones. | Supabase Auth |
| Upstash Redis | Servicio Redis serverless gestionado | Guarda límites diarios, cuota por proveedor y estado del *circuit breaker* de la capa de IA. | Upstash (Redis, API REST) |
| Proveedores de IA | SaaS externos | Google AI Studio (Gemini), Groq, Cloudflare Workers AI y OpenRouter, en sus niveles gratuitos. | APIs HTTPS de cada proveedor |
| Sentry | SaaS externo | Recibe reportes de error. | Sentry |
| PostHog | SaaS externo | Recibe eventos de producto. | PostHog |

### 6.2 Mapeo de contenedores a infraestructura

| Contenedor (Nivel 2) | Nodo de despliegue | Protocolo |
|---|---|---|
| Aplicación web Cogni | Vercel (funciones y borde) | HTTPS |
| Proxy de sesión | Vercel (funciones y borde, ejecutado por petición) | Interno al *runtime* de Next.js |
| Base de datos Postgres | Supabase Postgres | Drizzle ORM / `postgres.js` (TCP, *pooler* de transacciones) |
| Almacenamiento de objetos | Supabase Storage | HTTPS (API de Storage / URL firmada) |
| Servicio de identidad | Supabase Auth | HTTPS (`@supabase/ssr`) |
| Programador de tareas | Vercel Cron | HTTPS GET programado |
| Registro de proveedores de IA | Vercel (dentro de la aplicación) → Proveedores de IA | HTTPS (Vercel AI SDK) |
| Almacén de límites de IA | Upstash Redis | HTTPS (API REST) |
| Monitoreo de errores | Sentry | HTTPS (SDK / túnel `/monitoring`) |
| Analítica de producto | PostHog | HTTPS (SDK) |

### 6.3 Mecanismos de resiliencia (implementados)

Estos mecanismos son reales y acotados; no existe un mecanismo de reintento genérico en la plataforma: cada uno vive en el módulo que lo necesita.

1. **Reintento único con degradación** (`ensureProfileResilient`, `src/modules/identity/application/`): si crear el perfil falla, reintenta una vez tras 150 ms; si vuelve a fallar, invoca un `onTransientFailure` de degradación en vez de lanzar una excepción, para que el layout autenticado siga renderizando (RNF-F-02 lo generaliza para `getActiveImports`).
2. **Degradación a lista vacía** (`getActiveImports()`, `src/app/(app)/layout.tsx`): si la consulta de importaciones activas falla, devuelve `[]` y el shell se renderiza con normalidad, en vez de fallar la página completa (hoy ningún componente consume esos identificadores).
3. **Descarte silencioso de fallos de analítica** (`createServerAnalytics`, `src/shared/observability/analytics.ts`): un fallo al enviar un evento a PostHog se captura y se descarta; nunca propaga la excepción a la petición del estudiante (RNF-F-03).
4. **Abandono por edad, no por *lease*** (`isAbandoned`, `src/modules/ingestion/domain/import-job.ts`): un `ImportJob` no terminal sin escritura reciente se reporta como fallido por tiempo agotado sin que ningún proceso deba liberar un candado explícito.
5. ***Circuit breaker* por proveedor de IA** (`src/modules/ai/domain/circuit-breaker.ts`): 3 fallos consecutivos (`BREAKER_FAILURE_THRESHOLD`) marcan al proveedor como no sano durante 10 minutos (`BREAKER_OPEN_MS`); su estado se comparte entre invocaciones en Upstash Redis (`UpstashBreakerStore`).
6. **Rotación de proveedores y un único reintento** (`generateStructured`, `src/modules/ai/application/generate-structured.ts`): se elige un proveedor sano y con cuota diaria disponible; si la llamada falla o la salida no cumple el esquema Zod, se reintenta una sola vez con otro proveedor (`MAX_ATTEMPTS = 2`). Si ambos intentos fallan, la generación queda `failed` en `ai_generations` y no se inventa contenido.
7. **Reclamo de evaluaciones abandonadas** (`evaluateRecallSession`, `src/modules/active-recall`): un reclamo de evaluación de más de 6 minutos se retoma, y la vista de resultados vuelve a programar la evaluación si la sesión terminada sigue pendiente sin una corrida viva (§10.4).

---

## 7. Vista de módulos (monolito modular)

### 7.0 Estilo arquitectónico

**Monolito modular con arquitectura hexagonal por módulo** (`docs/documento-maestro.md` §5.1): una única aplicación Next.js desplegable, dividida en 11 módulos bajo `src/modules/`, cada uno con dominio puro, casos de uso de aplicación, adaptadores de infraestructura y, cuando tiene componentes propios, una capa de interfaz.

Los 11 módulos tienen capas reales; la forma de cada uno depende de lo que necesita aislar:

- **Con las cuatro capas** (`domain/`, `application/`, `infrastructure/`, `ui/`): `identity` (sin `README.md` propio, a diferencia de los demás), `notebooks` e `ingestion`.
- **Sin `infrastructure/`**: `editor` tiene `domain/`, `application/` y `ui/`; no tiene ningún adaptador externo que aislar y declara sus propios puertos (`SavePagePort`, `ImageUploadPort`, `MentionPort`), que la ruta de página compone con las Server Actions de `notebooks`.
- **Sin `ui/`**: `ai`, `study-engine`, `flashcards`, `exams`, `active-recall`, `scheduling` y `analytics` tienen `domain/`, `application/` e `infrastructure/`; sus pantallas viven en `src/app/(app)/…` (`flashcards`, `exams`, `active-recall`, `calendario`, `dashboard`) y componen los átomos de `src/shared/ui`.

Además de las capas, la raíz de los módulos con Server Actions (todos salvo `ai`, `editor` y `study-engine`) contiene esas acciones (`actions.ts` y, según el módulo, `session-actions.ts`, `hub-actions.ts`, `retake-actions.ts`, `feedback-actions.ts`, `evaluation-actions.ts`) y, en cinco módulos (`ai`, `notebooks`, `study-engine`, `scheduling`, `analytics`), un `server-api.ts`: la raíz de composición sin `"use server"` que el `index.ts` reexporta para que otros módulos o Route Handlers usen el módulo desde el servidor. `ai`, `flashcards`, `notebooks`, `scheduling`, `analytics` y `study-engine` exponen también un `testing.ts` con dobles de prueba.

**Entradas públicas.** Entre módulos, cada módulo se importa por su `index.ts` (regla `cross-module-via-index`, que solo se aplica a importaciones con origen en `src/modules/`). La capa de aplicación (`src/app`) importa además, de forma directa, la `ui/` y el `actions.ts` de algunos módulos (por ejemplo `@/modules/identity/ui`, `@/modules/ingestion/ui/document-import-provider`, `@/modules/notebooks/actions`, `@/modules/notebooks/ui/notebook-actions-slot` y `@/modules/notebooks/ui/page-title-editor`). Hay dos entradas públicas adicionales, cada una protegida por su propia regla (§7.3):

- `src/modules/identity/proxy.ts` — entrada liviana que solo reexporta `updateSession`, para que `src/proxy.ts` (que corre en cada petición) no cargue el grafo `server-only` del `index.ts` de `identity` (regla `proxy-via-public-entry`).
- `src/modules/active-recall/calibration.ts` — entrada solo de dominio que expone `calibrationOf`, para que `analytics` la use sin cargar las Server Actions de `active-recall` (regla `domain-entry-is-pure`).

**Tipos compartidos sin dependencia entre módulos.** Los tipos del documento Tiptap (`TiptapDoc`, `TiptapNode`) viven en `src/shared/kernel/tiptap-doc.ts` (`notebooks` los reexporta) y los umbrales de dominio (0,35 / 0,7) en `src/shared/kernel/mastery-thresholds.ts`, usados por `study-engine/domain/mastery.ts` y `src/shared/ui/mastery-level.ts`. Así el dominio de `editor` no depende de `notebooks` ni la interfaz duplica umbrales del motor.

### 7.1 Estructura de directorios

Recorte de `eza -T -L 2 src` (trimming: solo carpetas de rutas significativas y los archivos de configuración de nivel raíz de `src`, sin repetir los `.test.ts` unitarios):

```
src
├── app
│   ├── (app)/                 # shell autenticado: inicio, notebooks, flashcards, exams, active-recall, calendario, dashboard, configuracion
│   ├── (public)/              # /login, /register, /forgot-password, /reset-password, /terminos
│   ├── api/keep-alive/        # Route Handler para Vercel Cron (mantener activo Supabase)
│   ├── api/recompute-mastery/ # Route Handler para Vercel Cron (dominio por página)
│   ├── auth/callback/         # Route Handler para el intercambio PKCE
│   ├── global-error.tsx
│   └── layout.tsx
├── instrumentation-client.ts
├── instrumentation.ts
├── proxy.ts
├── modules
│   ├── identity/                 (domain, application, infrastructure, ui; proxy.ts)
│   ├── notebooks/                (domain, application, infrastructure, ui; server-api.ts)
│   ├── editor/                   (domain, application, ui — sin infrastructure)
│   ├── ingestion/                (domain, application, infrastructure, ui)
│   ├── ai/                       (domain, application, infrastructure; server-api.ts)
│   ├── study-engine/             (domain, application, infrastructure; server-api.ts)
│   ├── flashcards/               (domain, application, infrastructure; Server Actions en la raíz)
│   ├── exams/                    (domain, application, infrastructure; Server Actions en la raíz)
│   ├── active-recall/            (domain, application, infrastructure; Server Actions y calibration.ts en la raíz)
│   ├── scheduling/               (domain, application, infrastructure; Server Actions y server-api.ts en la raíz)
│   └── analytics/                (domain, application, infrastructure; Server Actions y server-api.ts en la raíz)
└── shared
    ├── config/        # env.schema.ts, env.server.ts, env.client.ts, security-headers.ts, image-remote-patterns.ts, design-previews.ts
    ├── db/            # client.ts, schema.ts
    ├── kernel/        # clock.ts, domain-error.ts, id.ts, result.ts, tiptap-doc.ts, mastery-thresholds.ts, page-paragraphs.ts, words.ts, generation-fingerprints.ts
    ├── observability/ # analytics.ts, sentry-options.ts
    └── ui/            # primitivos shadcn/ui y unos 60 átomos de dominio (card.tsx, pill.tsx, chart.tsx, sparkline.tsx, ...)
```

### 7.2 Dependencias entre módulos

> Diagrama a construir con archify a partir de esta descripción.

Especificado en `docs/documento-maestro.md` §5.2; la tercera columna registra las importaciones reales entre módulos del código de producción (sin pruebas), obtenidas de `src/modules/*`.

| Módulo | Depende de (especificado) | Dependencia real |
|---|---|---|
| `identity` | Supabase Auth (externo) | Ningún otro módulo. |
| `notebooks` | `identity` (vía su `index.ts`, para `ownerId`/sesión) | `identity`. |
| `editor` | `notebooks` (solo el puerto de guardado, inyectado) | Ningún otro módulo: declara su propio `SavePagePort`; la ruta de página lo compone con las Server Actions de `notebooks`. |
| `ingestion` | `notebooks` (para crear páginas y escribir contenido) | `notebooks` (vía `createNotebooksServerApi`, también para guardar las imágenes importadas) e `identity` (sesión); además `src/shared/rate-limit`. |
| `ai` | Upstash y proveedores de IA (externos) | Ningún otro módulo; externos: Vercel AI SDK, proveedores de IA y Upstash. |
| `study-engine` | Ninguna del dominio de estudio (es la base) | Ningún otro módulo. |
| `flashcards` | `study-engine`, `ai`, `notebooks` | `study-engine`, `ai`, `notebooks` e `identity` (sesión). |
| `exams` | `study-engine`, `ai`, `notebooks` | `study-engine`, `ai`, `notebooks`, `identity` (sesión) y `scheduling` (`createSchedulingServerApi`, en `exams/hub-actions.ts`, para contar las preguntas de examen vencidas hoy por página). |
| `active-recall` | `study-engine`, `ai`, `notebooks` | `study-engine`, `ai`, `notebooks` e `identity` (sesión). |
| `scheduling` | `study-engine`, `notebooks` | `study-engine` (solo el tipo `StudyItemKind`) e `identity` (sesión); lee `pages` y `notebooks` con sus propios lectores, sin importar `notebooks`. |
| `analytics` | `study-engine`, técnicas (solo lectura) | `study-engine` (tipos `MasteryLevel` y `SessionKind`), `active-recall` (`calibrationOf`, vía `active-recall/calibration.ts`) e `identity` (sesión); lee las tablas de las técnicas con sus propios lectores. |

Todos los módulos dependen además de `src/shared/kernel` (dominio puro compartido) y, fuera de la capa de dominio, de `src/shared/config`, `src/shared/db` y `src/shared/observability`. Ningún módulo importa a otro fuera de sus entradas públicas (`index.ts` y, para `analytics`, `active-recall/calibration.ts`). Las técnicas (`flashcards`, `exams`, `active-recall`) dependen de `study-engine` y nunca al revés (regla `study-engine-knows-no-technique`); ninguna técnica importa a otra. Fuera de `identity`, que los módulos con Server Actions usan para leer la sesión, la única dependencia entre módulos que el mapa de `docs/documento-maestro.md` §5.2 no lista es `exams → scheduling`: el centro de exámenes lee de la vista "Hoy" cuántas preguntas de examen vence cada página (`examQuestionsDueByPage`).

### 7.3 Reglas de dependencia

Las 14 reglas reales de `.dependency-cruiser.cjs`, todas con `severity: "error"`, verificadas con `pnpm depcruise` dentro de `.github/workflows/pr.yml` y `.github/workflows/main.yml`. La opción `tsPreCompilationDeps: true` hace que también cuenten los imports solo de tipos (`import type`), que `tsc` borra pero siguen siendo dependencias arquitectónicas.

1. **`domain-is-pure`** — el dominio no debe importar de otras capas ni de otros módulos; solo `shared/kernel` está permitido.
2. **`domain-no-npm`** — el dominio no debe depender de paquetes npm externos (Next.js, Drizzle, AI SDK, React, etc.); Zod es la única excepción permitida.
3. **`application-no-infra-or-ui`** — la capa de aplicación depende solo de dominio y puertos; nunca debe importar infraestructura ni interfaz de usuario.
4. **`ui-never-touches-infra`** — la interfaz (y las rutas de la aplicación) consumen la aplicación a través de Server Actions o Route Handlers; nunca deben importar infraestructura directamente.
5. **`cross-module-via-index`** — un módulo solo puede importarse a través de su `index.ts` público o de una entrada `calibration.ts` solo de dominio (hoy, la de `active-recall`), nunca a través de rutas internas.
6. **`domain-entry-is-pure`** — una entrada pública solo de dominio (`calibration.ts` en la raíz de un módulo) solo puede reexportar el dominio de su módulo o `shared/kernel`, para que importarla nunca cargue Server Actions, infraestructura ni interfaz.
7. **`proxy-via-public-entry`** — `src/proxy.ts` solo puede importar un módulo por una entrada pública: su `index.ts` o una entrada liviana `proxy.ts` (`identity/proxy.ts`) que evita el grafo `server-only` del índice.
8. **`editor-tiptap-only-in-ui`** — los paquetes de Tiptap y ProseMirror solo pueden importarse desde `editor/ui`; `editor/domain` y `editor/application` deben permanecer independientes del framework.
9. **`study-engine-knows-no-technique`** — `study-engine` es agnóstico de técnica; no puede importar `flashcards`, `exams` ni `active-recall`, que le hablan a través de su API pública.
10. **`no-in-process-pdfjs`** — ningún módulo puede importar `unpdf` ni `pdfjs-dist` (T8): el PDF se lee solo con officeparser, cuyo pdf.js corre en un proceso aparte, y otro pdf.js en el proceso del servidor rompe sus análisis.
11. **`mammoth-only-in-ingestion-infra`** — mammoth (estructura de Word) solo puede importarse desde `ingestion/infrastructure` (`docx-document-extractor.ts`).
12. **`officeparser-only-in-ingestion-infra`** — officeparser (colores, numeración y ecuaciones de Word; PowerPoint y PDF completos) solo puede importarse desde `ingestion/infrastructure`.
13. **`ai-sdk-only-in-ai-infra`** — el Vercel AI SDK y sus paquetes de proveedor (`ai`, `@ai-sdk/*`, `@openrouter/*`) solo pueden importarse desde `ai/infrastructure`; el resto pasa por `ai.application`.
14. **`upstash-only-in-ai-infra`** — los paquetes de Upstash solo pueden importarse desde `ai/infrastructure` y desde el limitador compartido `src/shared/rate-limit`; el dominio y la aplicación dependen de puertos.

---

## 8. Justificación del stack tecnológico

### 8.1 Next.js 16 + React 19 + TypeScript

| Criterio | Evaluación |
|---|---|
| Costo | Gratuito; despliegue en Vercel Hobby sin costo (RNF alineado con la prioridad 1 de la sección 1.2). |
| Curva de aprendizaje para un equipo de una persona | Un solo framework cubre frontend y backend (Server Actions, Route Handlers), evitando mantener un servicio separado. |
| Mantenibilidad | TypeScript estricto (`tsconfig.json`, `"strict": true`) detecta errores de tipos en compilación (RNF-M-01). |
| Rendimiento percibido | Server Components reducen JavaScript en el cliente; Server Actions evitan una capa de API REST intermedia. |
| Riesgo | Next.js 16 renombró `middleware.ts` a `proxy.ts` y cambia APIs con frecuencia; el código ya asume esta versión (`src/proxy.ts`, comentario explícito). |

Ver `04-ADR.md`, ADR-003.

### 8.2 Tailwind CSS 4 + shadcn/ui

| Criterio | Evaluación |
|---|---|
| Costo | Gratuito y de código abierto. |
| Consistencia visual | Utilidades atómicas más componentes copiados (no una dependencia de paquete de componentes) permiten adaptar cada primitivo a los tokens de `docs/design-system/`. |
| Mantenibilidad | Los primitivos (`button.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, etc.) y unos 60 átomos de dominio viven en `src/shared/ui/`, versionados junto al resto del código; las pantallas componen esos átomos en vez de copiar estilos (`docs/design-system/ATOMS.md`). |
| Riesgo | Tailwind 4 cambia su modelo de configuración (basado en CSS, no en `tailwind.config.js`); requiere seguir su documentación específica de versión. |

Sin ADR dedicado en la suite; la decisión queda documentada aquí y en `docs/design-system/`.

### 8.3 Supabase Postgres + Drizzle ORM

| Criterio | Evaluación |
|---|---|
| Costo | Plan Free de Supabase; se pausa tras ~7 días de inactividad, mitigado con el cron de `keep-alive` (RNF-F-01). |
| Tipado | Drizzle infiere tipos TypeScript directamente del esquema (`ProfileRow`, `PageRow`, etc., en `src/shared/db/schema.ts`). |
| Migraciones | Migraciones incrementales versionadas en `drizzle/*.sql`, con reversión manual documentada en `.down.sql` para 12 de 14 migraciones (RNF-M-03). |
| Restricción operativa | El *pooler* de transacciones de Supabase no admite sentencias preparadas; el cliente se crea con `{ prepare: false, max: 1 }` (RNF-P-05). |
| Riesgo | Sin `down` automático en `drizzle-kit`; toda reversión es manual contra `cogni-dev`/`cogni-prod`. |

Ver `04-ADR.md`, ADR-004.

### 8.4 Supabase Auth

| Criterio | Evaluación |
|---|---|
| Costo | Incluido en el plan Free de Supabase. |
| Cobertura funcional | Correo/contraseña con verificación y Google OAuth (RF-ID-01, RF-ID-02) sin construir un servicio de identidad propio. |
| Integración con Next.js | `@supabase/ssr` gestiona la sesión por cookies, refrescada en cada petición por `src/proxy.ts`. |
| Seguridad | Row Level Security en `profiles` (sin políticas propias: solo la conexión de servidor, que evita RLS, la alcanza). |
| Riesgo | Acopla la identidad del producto a un proveedor externo; migrar de proveedor implicaría reescribir `identity/infrastructure`. |

Ver `04-ADR.md`, ADR-005.

### 8.5 Tiptap 3

| Criterio | Evaluación |
|---|---|
| Costo | Extensiones oficiales usadas son de código abierto; no se usa el paquete de plantilla de pago. |
| Cobertura funcional | Encabezados, listas, tablas, código con resaltado, callouts, imágenes, menú `/`, barra contextual, manejador de arrastre — todo con extensiones oficiales o construidas sobre ProseMirror. |
| Aislamiento arquitectónico | Confinado a `editor/ui` por la regla `editor-tiptap-only-in-ui`; el dominio y la aplicación del editor no conocen Tiptap. |
| Riesgo | Tiptap 3 fija varias extensiones a una versión exacta (`3.31.3`, sin `^`) en `package.json`, señal de incompatibilidades conocidas entre versiones menores. |

Ver `04-ADR.md`, ADR-006.

### 8.6 mammoth y officeparser

| Criterio | Evaluación |
|---|---|
| Costo | Gratuitos, de código abierto y sin dependencias nativas ni servicios externos: toda la extracción corre dentro de la función de Vercel (`docs/adr/0009`). |
| Cobertura funcional | mammoth 1.13 lee la estructura de un Word (títulos, listas anidadas, tablas con celdas combinadas, código, citas, casillas, saltos de página e imágenes) y officeparser 8.2 aporta colores, sombreado, número inicial de las listas y ecuaciones OMML como LaTeX. officeparser lee también PowerPoint (T7): títulos, cuerpo con formato, listas por nivel, tablas, imágenes, ecuaciones y notas del orador; las celdas combinadas, las diapositivas ocultas y las viñetas heredadas del patrón se leen del XML de la diapositiva porque officeparser no las informa. Desde T8 officeparser lee también el PDF con la geometría activada: el árbol de estructura de un PDF etiquetado o la geometría de una página sin etiquetas (títulos, negrita, cursiva, código, enlaces, listas, tablas con fila de encabezado, bloques de código e imágenes); un documento de solo párrafos pasa por `textToBlocks` (RF-IN-06). `unpdf` se retiró. |
| Aislamiento arquitectónico | Confinados a `ingestion/infrastructure` por las reglas `mammoth-only-in-ingestion-infra` y `officeparser-only-in-ingestion-infra`; `no-in-process-pdfjs` impide cargar otro pdf.js. El pdf.js de officeparser corre en un proceso de Node aparte (1 GiB de memoria, tiempo de CPU acotado) que la cancelación termina; `next build` traza su trabajador (`pdfjs-dist/legacy/build/pdf.worker.mjs`). officeparser va en `serverExternalPackages` de `next.config.ts` porque Turbopack rompe su envoltorio ESM al empaquetarlo. Ningún motor descomprime el ZIP por su cuenta: `OoxmlPackage` infla cada parte con tope de salida. |
| Riesgo | Ninguno hace OCR; un PDF sin capa de texto se rechaza explícitamente (`no_text_layer`), una limitación de producto aceptada (decisión sobre OCR pendiente, T12). El análisis XML de Word y PowerPoint es síncrono: una parte dentro de los límites puede pasar del presupuesto interno, con `maxDuration = 120` como techo. En PDF se pierden subrayado, tachado, colores, subíndices y superíndices, celdas combinadas, citas, líneas horizontales y texto alternativo; un PDF de más de 300 páginas se rechaza después de leer las primeras 300. Si la plataforma no deja iniciar el proceso de pdf.js, el análisis en el proceso del servidor queda limitado a 50 páginas y se informa a Sentry en cada caso. Los formatos antiguos `.doc`/`.ppt` no se leen. |

Decisión registrada en `docs/adr/0009-importacion-multiformato-y-catalogo-de-contenido.md`; dentro del alcance de `04-ADR.md`, ADR-002.

### 8.7 Zod

| Criterio | Evaluación |
|---|---|
| Costo | Gratuito. |
| Cobertura funcional | Valida entradas en cada límite: esquemas de credenciales (`credentials-schema.ts`), variables de entorno (`env.schema.ts`), contenido de página (`content-schema.ts`). |
| Excepción arquitectónica deliberada | Es la única dependencia npm permitida dentro de `domain/` (regla `domain-no-npm`), porque describe formas de datos, no infraestructura. |
| Riesgo | Ninguno relevante identificado en el código inspeccionado. |

Sin ADR dedicado en la suite.

### 8.8 Vitest + Playwright + dependency-cruiser + Biome

| Criterio | Evaluación |
|---|---|
| Costo | Las cuatro herramientas son gratuitas y de código abierto. |
| Cobertura | Más de 400 archivos de prueba de Vitest (a 2026-10-15: 456 archivos `*.test.ts(x)`: 411 bajo `src`, 5 bajo `tests/proxy` y `tests/identity`, 40 de integración con base de datos bajo `tests/db`), 31 especificaciones de Playwright bajo `tests/e2e`, y `pnpm depcruise` como prueba de arquitectura (RNF-M-05). |
| Disciplina de equipo de una persona | Biome unifica *linting*, formateo y organización de imports en una sola herramienta y configuración (RNF-M-04). |
| Riesgo | Ninguna cobertura mínima está configurada (`vitest.config.ts` no define `thresholds`); la disciplina de prueba depende del criterio del desarrollador, no de una puerta automática. |

Ver `04-ADR.md`, ADR-010.

### 8.9 Vercel Hobby + Cloudflare DNS

| Criterio | Evaluación |
|---|---|
| Costo | Ambos planes son gratuitos; el riesgo aceptado es que Vercel Hobby asume uso no comercial (SRS §2.3). |
| Simplicidad operativa | Integración Git nativa: cada `push` a `main` despliega a producción; cada rama abre un *preview*. |
| Rendimiento | Fluid Compute permite invocaciones más largas (`maxDuration = 120` en la importación de documentos; `maxDuration = 300` en la evaluación de recordación activa, programada con `after()`, y en el cron de dominio) sin migrar a un servicio de colas separado (`docs/adr/0003`). |
| Riesgo | El plan gratuito de Vercel puede reclasificar el uso como comercial si el tráfico crece; migrar de plan no requiere cambios de código, solo de facturación. |

Ver `04-ADR.md`, ADR-009.

### 8.10 Vercel AI SDK 7 + proveedores gratuitos + Upstash Redis

| Criterio | Evaluación |
|---|---|
| Costo | Cuatro proveedores con nivel gratuito, rotados para no depender de uno solo: Google AI Studio (`@ai-sdk/google`, Gemini), Groq (`@ai-sdk/groq`), Cloudflare Workers AI (`@ai-sdk/openai-compatible`) y OpenRouter (`@openrouter/ai-sdk-provider`, modelos `:free`), registrados en `src/modules/ai/infrastructure/provider-registry.ts`. Upstash Redis (plan gratuito) guarda límites, cuota y *circuit breaker* (`docs/adr/0004`). |
| Cobertura funcional | Salida estructurada validada con Zod para los seis propósitos de `src/modules/ai/domain/purpose.ts` (`generate_flashcards`, `generate_exam_questions`, `generate_exam_variants`, `generate_recall_questions`, `evaluate_recall_answer`, `session_feedback`), cada uno con prompts versionados en `src/modules/ai/application/prompts/`. |
| Aislamiento arquitectónico | El SDK y sus paquetes de proveedor solo se importan desde `ai/infrastructure` (regla `ai-sdk-only-in-ai-infra`), igual que Upstash (`upstash-only-in-ai-infra`, que admite también el limitador compartido `src/shared/rate-limit` que usa `ingestion`); los demás módulos usan `generateStructured` a través del `index.ts` de `ai`. Con `AI_PROVIDER_MODE=fake`, CI y las pruebas de extremo a extremo usan un proveedor y almacenes falsos, sin claves. |
| Riesgo | La llamada usada, `generateObject` de `ai@7`, está marcada como obsoleta en favor de `generateText` con `output` (comentario en `src/modules/ai/infrastructure/ai-sdk-provider.ts`); sigue disponible y se revisará cuando se elimine. El riesgo de negocio (niveles gratuitos que cambian o desaparecen) está documentado en `docs/documento-maestro.md` §14. |

Ver `04-ADR.md`, ADR-008, y `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md`.

### 8.11 Recharts

| Criterio | Evaluación |
|---|---|
| Costo | Gratuito y de código abierto (`recharts` 3.x). |
| Cobertura funcional | Gráficos del dashboard y miniaturas de tendencia, a través de los átomos `src/shared/ui/chart.tsx` y `src/shared/ui/sparkline.tsx`. |
| Aislamiento arquitectónico | Recharts solo se importa en esos dos átomos y en dos componentes del dashboard (`src/app/(app)/dashboard/_components/activity-chart.tsx`, `technique-activity.tsx`); ningún módulo lo importa: `analytics` entrega datos ya calculados (§10.5). No hay una regla de `dependency-cruiser` que lo restrinja. |
| Riesgo | Renderiza en el cliente; los gráficos dependen de JavaScript del navegador. |

Sin ADR dedicado en la suite.

---

## 9. Patrones arquitectónicos

### 9.1 Monolito modular

Una única aplicación Next.js desplegable, dividida en 11 módulos independientes bajo `src/modules/`, cada uno con una responsabilidad única (`docs/documento-maestro.md` §5.1–§5.2; ver sección 7).

### 9.2 Arquitectura hexagonal (puertos y adaptadores)

Cada módulo separa `domain/` (entidades y puertos), `application/` (casos de uso) e `infrastructure/` (adaptadores; `editor` no la tiene porque no aísla ningún sistema externo), verificado por las reglas 1 a 4 de la sección 7.3. Ejemplo: `src/modules/ingestion/domain/pdf-storage-gateway.ts` declara el puerto `PdfStorageGateway`; `src/modules/ingestion/infrastructure/supabase-pdf-storage-gateway.ts` lo implementa contra Supabase Storage.

### 9.3 Server Components + Server Actions

La interfaz se construye con React Server Components por defecto; las mutaciones se exponen como Server Actions (`"use server"`) en el `actions.ts` de cada módulo, evitando una capa de API REST intermedia. Ejemplo: `src/modules/notebooks/actions.ts` expone `createNotebook`, `saveContent`, `getSidebarTree`, entre otras.

### 9.4 Repositorio vía puertos

El acceso a datos se declara como una interfaz en `domain/` y se implementa en `infrastructure/`, nunca al revés. Ejemplo: `PageRepository` (`src/modules/notebooks/domain/page-repository.ts`) declarado en el dominio; `DrizzlePageRepository` (`src/modules/notebooks/infrastructure/drizzle-page-repository.ts`) lo implementa con Drizzle ORM.

### 9.5 Tipo `Result`

Toda operación que puede fallar de forma esperada devuelve `Result<T, E>` en vez de lanzar una excepción, en `src/shared/kernel/result.ts` (`Ok<T> | Err<E>`, con `ok`, `err`, `isOk`, `isErr`, `map`, `mapErr`, `unwrapOr`). Se usa de forma consistente en los puertos y casos de uso de los módulos de escritura (`identity`, `notebooks`, `editor`, `ingestion`, `ai`, `study-engine`, `flashcards`, `exams`, `active-recall`); `scheduling` y `analytics`, de solo lectura, lo usan en sus lecturas de servidor y Server Actions (`calendar-days.ts`, `dashboard-reads.ts`, `actions.ts`).

### 9.6 Máquina de estados

`ImportJob` modela su ciclo de vida como una máquina de estados explícita (`queued → processing → done/failed`), con funciones puras de transición (`start`, `complete`, `fail`) que devuelven un error de dominio ante una transición inválida, en `src/modules/ingestion/domain/import-job.ts`.

### 9.7 Unidad de trabajo

Las escrituras que deben quedar juntas se agrupan en una unidad de trabajo sobre una transacción de Drizzle: el módulo declara el puerto en `application/` y lo implementa en `infrastructure/`. Ejemplos: `DrizzleStudyUnitOfWork` (`study-engine`, calificar una flashcard), `DrizzleDeckUnitOfWork` (`flashcards`, guardar tarjetas y sus `StudyItem`), `DrizzleExamSessionUnitOfWork` (`exams`, cerrar un examen con sus repasos) y `DrizzleRecallUnitOfWork` (`active-recall`, guardar preguntas, ítems y huellas de párrafos).

---

## 10. Flujos arquitectónicos clave

### 10.1 Flujo de uso: crear un cuaderno, una página y escribir con autoguardado

> Diagrama a construir con archify a partir de esta descripción.

**Implementado.**

1. El estudiante sin sesión llega a `/login`; `src/proxy.ts` lo deja pasar por ser una ruta de autenticación.
2. El estudiante inicia sesión; el formulario invoca la Server Action `signInAction` (`src/modules/identity/actions.ts`), que llama a `AuthGateway.signInWithPassword` y, si tiene éxito, registra `user_signed_in` en PostHog.
3. Supabase Auth valida las credenciales y `@supabase/ssr` fija la cookie de sesión; en la siguiente petición, `src/proxy.ts` detecta la sesión y redirige a `/`.
   - Con Google, `signInWithGoogleAction` obtiene la URL de OAuth (con `redirectTo` hacia `/auth/callback`, igual a la entrada de la lista de redirecciones de Supabase) y marca el flujo con la cookie `cogni_auth_flow` (httpOnly, `path=/auth/callback`, 600 s; contrato en `src/modules/identity/domain/auth-flow.ts`). Las acciones de correo (registro, recuperación de contraseña) borran esa marca.
   - `/auth/callback` (`src/app/auth/callback/route.ts`) intercambia el código PKCE. Si el intercambio tiene éxito, registra `user_signed_in` (cada intercambio exitoso, sea Google, verificación de correo o recuperación) y redirige a `next`. Si falla o no hay código, redirige a `/login?error=google` cuando la cookie marca el flujo de Google, o a `/login?error=link` (enlace inválido o vencido) en cualquier otro caso. Toda respuesta borra la cookie.
4. En el shell autenticado (`src/app/(app)/layout.tsx`), `ensureProfileForUser` asegura la fila `profiles` del estudiante; si su cuenta no aceptó la versión vigente de los términos de uso, `termsRedirectFor` la envía a `/terminos?next=…` antes de mostrar el shell.
5. El estudiante crea un cuaderno desde el inicio (`/`) o desde `/notebooks` con `CreateNotebookTrigger`; el componente invoca la Server Action `createNotebook` (`src/modules/notebooks/actions.ts`), que ejecuta el caso de uso `createNotebook` (`application/create-notebook.ts`) y lo persiste con `DrizzleNotebookRepository`.
6. El estudiante crea una página desde la vista de detalle del cuaderno (`/notebooks/[notebookId]`); la Server Action `createPage` ejecuta el caso de uso homónimo, que rechaza la operación si el cuaderno está archivado (`NOTEBOOK_ARCHIVED`).
7. El estudiante escribe en el editor Tiptap; `useAutosave` (`src/modules/editor/application/use-autosave.ts`) detecta el cambio y, tras un *debounce* de 800 a 1500 ms, invoca `port.save`, que la página conecta a la Server Action `saveContent`.
8. `saveContent` ejecuta el caso de uso `savePage` (`src/modules/notebooks/application/save-page.ts`), que aplica una comparación-e-intercambio atómica sobre `content_version` (`DrizzlePageRepository.updateIfVersion`) y recalcula `plain_text` con `extractPlainText`.
9. Si otro cliente ya guardó una versión más nueva, `savePage` devuelve `PAGE_VERSION_CONFLICT`; `useAutosave` llama a `port.getCurrent`, guarda el borrador descartado en `conflictDraft` y pasa a estado `conflict`.

### 10.2 Generación y repaso de flashcards

> Diagrama a construir con archify a partir de esta descripción.

**Implementado (Fases 3 y 4; generación incremental desde la Fase 6)** — `src/modules/flashcards`, con `ai`, `notebooks` y `study-engine` como dependencias a través de sus `index.ts`; decisiones en `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md` y `docs/adr/0005-motor-de-repeticion-y-flashcards.md`; trazabilidad con CU-06 y CU-07.

Generación:

1. En el panel de técnicas de la página, "Generar" de flashcards llama a `generateFlashcardsAction`. `requestGeneration` (`flashcards/application/request-generation.ts`) lee y comprueba la página (`notebooks`) antes de tocar el límite, y selecciona los párrafos que flashcards aún no usó (huellas en `generation_fingerprints`); sin párrafos nuevos responde `FLASHCARDS_NO_NEW_CONTENT` sin llamar a la IA ni consumir el límite.
2. Consume una unidad del límite diario de generaciones (`check`, Upstash) y llama a `ai.generateStructured` con `generate_flashcards/v1`, recortado a `AI_PAGE_TOKEN_CAP`. `generateStructured` elige un proveedor sano y con cuota, valida la salida contra `{cards:[{front,back}]}` y, si falla, reintenta una vez con otro proveedor; cada intento queda auditado en `ai_generations`.
3. En una sola transacción (`DrizzleDeckUnitOfWork`) guarda las tarjetas válidas al final del mazo de la página, un `StudyItem(kind = "flashcard")` por tarjeta (`createStudyItemRepository` de `study-engine`) y las huellas de los párrafos enviados. Si ninguna tarjeta es válida no se guarda nada: un mazo nunca queda vacío. La acción registra el evento `generation_requested` en PostHog.

Repaso:

4. `startFlashcardSessionAction` abre una sesión con `createFlashcardSessionsServerApi` de `study-engine`; sin ítems vencidos responde `STUDY_ENGINE_NOTHING_DUE` y no crea fila.
5. Cada calificación (Otra vez q=1, Difícil q=3, Bien q=4, Fácil q=5) llama a `gradeFlashcardAction` → `gradeFlashcard`: en una transacción aplica `applySm2`, escribe el `ReviewLog(session_kind = flashcards)`, actualiza los contadores de la `FlashcardSession` y recalcula el `PageMastery` de la página.
6. `finishFlashcardSessionAction` cierra la sesión. `requestSessionFeedbackAction` → `requestSessionFeedback` (`flashcards`) consulta el límite sin consumirlo (`peek`), lee la sesión y las tarjetas difíciles con `createSessionFeedbackSources` y pide `session_feedback` a la IA; la fila única de `session_feedback` pasa a `done` o `failed`, y un fallo nunca impide cerrar la sesión.

### 10.3 Exámenes y repetición con variantes

> Diagrama a construir con archify a partir de esta descripción.

**Implementado (Fase 5)** — `src/modules/exams`, con `ai`, `notebooks`, `study-engine` y `scheduling` como dependencias a través de sus `index.ts`; decisiones en `docs/adr/0006-examenes-y-repeticion-con-variantes.md`; trazabilidad con CU-08.

1. "Generar" de exámenes llama a `generateExamQuestionsAction` → `requestExamGeneration`: lee las preguntas activas de la página (el prompt las lista para evitar duplicados) y los párrafos aún no usados, y llama a `ai.generateStructured` con `generate_exam_questions` en tandas de hasta 15 preguntas; una petición de 30 preguntas son dos llamadas pero una sola unidad del límite diario. Cada pregunta raíz guardada recibe su `StudyItem(kind = "exam_question")` en la misma transacción. El estudiante también puede crear, editar y retirar preguntas a mano.
2. `startExamSessionAction` compone el examen con N entre 10 y 30 preguntas (`composeExam`: raíces falladas en el último examen, raíces vencidas y luego las vistas hace más tiempo); con menos de 10 raíces activas responde `EXAMS_NOT_ENOUGH_QUESTIONS`.
3. Cada respuesta se corrige en el servidor al elegirla (`answerExamQuestionAction`), de forma determinista y sin IA.
4. "Ver resultados" (`finishExamSessionAction` → `completeExamSession`) cierra la sesión en una transacción (`DrizzleExamSessionUnitOfWork`): calcula la puntuación, registra los repasos con `createExamReviewRecorder` de `study-engine` (q=1 para cada incorrecta; q=4 para cada correcta solo si el ítem de la raíz estaba vencido, `examQualityFor`) y actualiza `exam_page_state`: limpia la repetición con 70 % o más, o la marca con sus raíces falladas por debajo de 70 %.
5. `startExamRetakeAction` → `startExamRetake` rechaza antes de cualquier llamada a la IA una repetición imposible (sin repetición pendiente, N fuera de rango o menor que los conceptos fallados); retoma una repetición abierta sin llamar a la IA; reutiliza una variante guardada antes; y para el resto llama a `generate_exam_variants`, una variante reformulada por raíz fallada con una redacción nunca usada por su linaje, retirando la redacción mostrada en el examen fallado. Si falta alguna variante responde `EXAMS_RETAKE_VARIANT_MISSING` sin guardar nada ni consumir el límite. La repetición presenta primero las raíces reformuladas y completa hasta N (`composeRetake`).
6. `requestExamFeedbackAction` → `requestExamFeedback` pide la retroalimentación del examen terminado con `createSessionFeedbackSources`, sobre la misma tabla `session_feedback` (`session_kind = exam`). El centro de exámenes (`listExamHubAction`) cuenta las preguntas vencidas por página con `createSchedulingServerApi` de `scheduling`.

### 10.4 Recordación activa con evaluación combinada

> Diagrama a construir con archify a partir de esta descripción.

**Implementado (Fase 6, 2026-10-10)** — `src/modules/active-recall`, con `ai`, `notebooks` y `study-engine` (más `identity` para la sesión) como dependencias a través de sus `index.ts`; decisiones en `docs/adr/0007-recordacion-activa-y-generacion-incremental.md`; trazabilidad con CU-09, RF-AR-01 a RF-AR-06 y RF-AI-03.

Generación (previa a la sesión):

1. En el panel de técnicas de la página, "Generar" de Recordación activa llama a `generateRecallQuestionsAction`. `requestRecallGeneration` lee el texto de la página (`notebooks`), selecciona los párrafos que la técnica aún no usó (`selectNewParagraphs` sobre `generation_fingerprints`; sin nada nuevo responde `RECALL_NO_NEW_CONTENT` sin llamar a la IA), consulta el límite diario de generaciones (`peek`) y llama a `ai.generateStructured` con `generate_recall_questions/v1` (10 preguntas con rúbrica).
2. En una sola transacción (`DrizzleRecallUnitOfWork`) guarda las preguntas, un `StudyItem(kind = "recall_question")` por pregunta y las huellas de los párrafos enviados; después consume la unidad (`check`).

Sesión y evaluación:

3. La ruta `/active-recall/{cuaderno}/{página}` lee un plan (`planRecallSession`: hasta 10 preguntas, vencidas primero, luego nuevas y luego las repasadas hace más tiempo) sin escribir. Con la primera respuesta, el reproductor abre la sesión (`startRecallSessionAction`).
4. Cada respuesta y su autoevaluación 0–5 se guardan al darlas (`saveRecallAnswerAction`, `recall_answers.evaluation_status = pending`); guardar y cerrar se serializan con el bloqueo de la fila de la sesión.
5. "Terminar" (`finishRecallSessionAction`) cierra la sesión con las respuestas dadas y responde de inmediato; `evaluation-runner.ts` programa `evaluateRecallSession` con `after()`, dentro de `maxDuration = 300` de la ruta (`docs/adr/0003`).
6. `evaluateRecallSession` reclama las respuestas pendientes (`evaluation_claimed_at`; un reclamo de más de 6 minutos se retoma). Por cada una: una respuesta saltada recibe el registro `skipped` (puntaje 0, sin modelo); una escrita consulta el límite de evaluaciones (`peek` sobre `{prefijo}:ai:eval`), elige el fragmento de la página más parecido a la pregunta (`selectRelevantFragment`, recortado a `AI_PAGE_TOKEN_CAP`) y llama a `ai.generateStructured` con `evaluate_recall_answer/v1`, que reintenta una vez con otro proveedor.
7. `ai.application` devuelve `{score, presentConcepts, missingConcepts, misconceptions, justification}` validado con Zod. `active-recall` consume una unidad (`check`) y guarda la salida cruda, el puntaje y `combined = round(0.6·score_ia + 0.4·autoevaluación)` (`done`). Si fallan los proveedores o el límite está agotado, guarda el intento crudo `{ source: "failed", code, generationId }` (`failed`), sin calidad combinada.
8. Para las respuestas `done`, `active-recall` llama a `recordRecallReviews` de `study-engine` (`createRecallReviewRecorder`) con la calidad combinada: SM-2, `ReviewLog(session_kind = recall)` y recálculo de `PageMastery`, con guarda por (sesión, ítem). Las `failed` no registran repaso.
9. El estado final de la sesión (`done` o `partial`, `sessionEvaluationStatus`) se escribe con la fila de la sesión bloqueada.

Resultados:

10. La vista de resultados sondea `getRecallSessionResultsAction` con espera creciente (2,5 s × 1,5, tope de 20 s, 32 lecturas). Cuando todas las evaluaciones terminaron muestra la calidad combinada media, la calibración derivada (exceso o falta de confianza) y, por pregunta, el puntaje de la IA y su justificación. Si la sesión terminada sigue `pending` sin una corrida viva, el sondeo programa otra evaluación.
11. "Reintentar" (`retryRecallEvaluationAction`) devuelve las respuestas `failed` a `pending` y vuelve a programar la evaluación; "No estoy de acuerdo" (`disagreeRecallAnswerAction`) guarda `disagreed = true` sin cambiar el puntaje.
12. `/active-recall` y la vista por cuaderno leen `listRecallHubAction` (`DrizzleRecallHubReader`, dominio de página de `study-engine` con `createPageMasteryReader` y preguntas vencidas con `listDue`); la ruta `/resultados?sesion={id}` reabre una sesión terminada con `getRecallSessionReviewAction`.

### 10.5 Calendario, "Hoy" y dashboard (lectura)

> Diagrama a construir con archify a partir de esta descripción.

**Implementado (Fase 7, 2026-10-14)** — `src/modules/scheduling` y `src/modules/analytics`, rutas `src/app/(app)/calendario`, `src/app/(app)/dashboard` y `src/app/(app)/configuracion`; decisiones en `docs/adr/0008-calendario-y-dashboard.md`; trazabilidad con CU-10, CU-11, RF-SC-01 a RF-SC-04, RF-AN-01 a RF-AN-05 y RF-ID-08.

Zona horaria:

1. El layout de `(app)` monta `TimeZoneDetection`, que muestra `TimeZoneAutoDetect` de `identity` solo mientras el perfil no tiene zona elegida (`profiles.timezone = 'UTC'`); envía la zona del navegador una vez con `adoptBrowserTimeZoneAction`, que solo escribe si el valor sigue en `UTC`. `/configuracion` guarda una elección explícita con `updateTimeZoneAction` (UTC se guarda como `Etc/UTC`).
2. Cada página lee la zona con `getCurrentTimeZoneSetting()` de `identity` (ante un fallo de lectura, UTC) y toma un único instante `now` para todas sus lecturas, así "hoy" coincide en toda la página.

Calendario:

3. La pestaña "Hoy" llama a `listDueTodayAction`: `DrizzleDueTodayReader` agrupa `study_items` no suspendidos con `due_at <= now` por página (unida a `pages` y `notebooks`, sin archivados), con conteos por técnica y el vencimiento más antiguo; la ruta arma un chip por técnica con el enlace a su sesión. El inicio usa la misma lectura para la tarjeta "Repasos pendientes hoy" (`totalDueCount`).
4. "Semana" y "Mes" (`?view=`, `?date=`) llaman a `getCalendarDays({ fromDay, toDay, timeZone, now })`: valida el rango (≤ 42 días) y `listCalendarDays` lee con `DrizzleDueInRangeReader` los ítems de una ventana UTC ampliada ±14 h (`listDueInRange`) y, si el rango contiene hoy, los vencidos anteriores contados por página y técnica en SQL (`listOverdueCounts`). `groupCalendarDays` los agrupa por día local y página en el dominio; lo vencido va a hoy y los días pasados quedan vacíos.

Dashboard:

5. `/dashboard?range=7|15|30` calcula `[fromDay, toDay)` en la zona del perfil y lanza en paralelo `getDashboardProgress`, `getDashboardTechniqueMetrics` y `getDashboardCalibration` (`dashboard-reads.ts`): sesión primero, entrada validada y errores como `ActionError` con códigos `ANALYTICS_*`, nunca excepciones.
6. `getProgress` combina `DrizzlePageProgressReader` (páginas vivas con su fila de `page_mastery` y los conteos vivos de `study_items`, total y vencidos con `due_at <= now`) con la calidad semanal de `review_logs` (`DrizzleReviewHistoryReader`); `buildProgress` arma el progreso por página y cuaderno.
7. `getTechniqueMetrics` lee `review_logs` del período y del anterior, los pares distintos (técnica, tramo UTC de 15 minutos) de todo el historial para la racha, y las respuestas de exámenes terminados y de recordación evaluadas (`DrizzleAnswerOutcomeReader`); el dominio calcula repasos por día, tasa de acierto, racha actual y la de hace 7 días.
8. `getCalibration` clasifica cada respuesta de recordación evaluada del período con `calibrationOf` de `active-recall` y la agrega por página (`rollupCalibration`).
9. La ruta mapea los tres resultados con la función pura `buildDashboardView` (zona de calibración por la señal más frecuente, variación respecto del periodo anterior en repasos completados, precisión y repasos por técnica, y en la racha; sin variación para el dominio global, los ítems pendientes ni las páginas dominadas) y pinta los componentes con los gráficos de `src/shared/ui/chart.tsx` (Recharts). Si alguna lectura falla muestra un aviso de error; sin datos, un estado vacío.

---

## 11. Decisiones de infraestructura

### 11.1 `vercel.json` (completo)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/keep-alive", "schedule": "0 6 * * *" },
    { "path": "/api/recompute-mastery", "schedule": "30 6 * * *" }
  ]
}
```

### 11.2 `next.config.ts` (extracto relevante)

```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ["officeparser"],
  images: {
    remotePatterns: supabaseImageRemotePatterns(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
```

### 11.3 `.github/workflows/pr.yml` (completo)

```yaml
name: PR

on:
  pull_request:
    branches: [main]

# Secrets are never needed here, so forks and Dependabot get the same gate.
permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec biome ci
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm depcruise
      - run: pnpm audit --audit-level=high
```

`.github/workflows/main.yml` ejecuta los mismos 5 pasos y agrega un job `e2e` (con `pnpm test:db` y `pnpm test:e2e`, es decir, Playwright contra un `next build && next start` local, node 22), con `AI_PROVIDER_MODE=fake` para no necesitar claves de proveedores de IA ni Upstash.

### 11.4 Variables de entorno requeridas

Solo nombres; ningún valor real fue leído ni se reproduce aquí.

| Variable | Descripción | Servicio |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Dominio canónico usado por el redireccionamiento de apex y por los enlaces de autenticación. | Aplicación |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. | Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública del cliente Supabase (navegador). | Supabase |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN de Sentry para el cliente (opcional). | Sentry |
| `NEXT_PUBLIC_POSTHOG_KEY` | Clave de proyecto PostHog para el cliente (opcional). | PostHog |
| `NEXT_PUBLIC_POSTHOG_HOST` | Host de la API de PostHog (opcional). | PostHog |
| `NEXT_PUBLIC_VERCEL_ENV` | Entorno de Vercel, inyectado en tiempo de compilación para Sentry. | Vercel |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | SHA del commit, usado como `release` de Sentry. | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio para operaciones de servidor que evitan RLS. | Supabase |
| `DATABASE_URL` | Cadena de conexión Postgres (pooler de transacciones). | Supabase |
| `CRON_SECRET` | Secreto de al menos 32 caracteres para autenticar `/api/keep-alive` y `/api/recompute-mastery`. | Vercel Cron |
| `SENTRY_DSN` | DSN de Sentry para el servidor (opcional). | Sentry |
| `SUPABASE_STORAGE_BUCKET` | Nombre del bucket privado de imágenes de página. | Supabase Storage |
| `SUPABASE_PDF_BUCKET` | Nombre del bucket privado de documentos importados (PDF, DOCX y PPTX; conserva el nombre de la era PDF). | Supabase Storage |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Clave de Google AI Studio (Gemini) (opcional; sin ella el proveedor queda fuera de la rotación). | Proveedores de IA |
| `GROQ_API_KEY` | Clave de Groq (opcional). | Proveedores de IA |
| `CLOUDFLARE_ACCOUNT_ID` | Cuenta de Cloudflare para Workers AI (opcional). | Proveedores de IA |
| `CLOUDFLARE_API_TOKEN` | Token de Cloudflare Workers AI (opcional). | Proveedores de IA |
| `OPENROUTER_API_KEY` | Clave de OpenRouter (opcional). | Proveedores de IA |
| `UPSTASH_REDIS_REST_URL` | URL REST de la base Upstash Redis (opcional en el esquema; necesaria en modo `live`). | Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST de Upstash Redis (opcional en el esquema; necesario en modo `live`). | Upstash |
| `REDIS_KEY_PREFIX` | Prefijo de las claves de Redis por entorno (por defecto `cogni:dev`). | Upstash |
| `AI_PROVIDER_MODE` | `live` (proveedores reales, por defecto) o `fake` (proveedor y almacenes falsos para CI y e2e). | Aplicación |
| `AI_DAILY_GENERATIONS` | Generaciones diarias por estudiante (por defecto 6). | Aplicación |
| `AI_DAILY_EVALUATIONS` | Evaluaciones de recordación activa diarias por estudiante (por defecto 60). | Aplicación |
| `AI_PAGE_TOKEN_CAP` | Tope de tokens del texto de página enviado a la IA (por defecto 12000). | Aplicación |
| `SENTRY_AUTH_TOKEN` | Habilita la subida de *source maps* en el build de producción. | Sentry (CI/Vercel) |
| `VERCEL_ENV` | Entorno de Vercel, leído por `sentry.*.config.ts` y `scripts/migrate-in-build.mjs`. | Vercel |
| `VERCEL_GIT_COMMIT_SHA` | SHA del commit, leído por `sentry.*.config.ts`. | Vercel |
| `COGNI_DESIGN_PREVIEWS` | Con `1` reactiva las vistas previas de diseño en un build de producción (`designPreviewsEnabled()`, `src/shared/config/design-previews.ts`). | Aplicación |
| `RUN_DB_MIGRATIONS` | Escape hatch para migrar localmente contra `cogni-dev` sin desplegar. | Aplicación |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Referenciadas solo en un comentario de `next.config.ts`; Vercel las inyecta en el build a través de su integración con Sentry. | Sentry (Vercel) |

Secretos de GitHub Actions (solo nombres, usados en `main.yml` para el job `e2e`): `DEV_SUPABASE_URL`, `DEV_SUPABASE_PUBLISHABLE_KEY`, `DEV_SUPABASE_SERVICE_ROLE_KEY`, `DEV_DATABASE_URL`, `DEV_CRON_SECRET`.

---

## 12. Seguridad

### 12.1 Row Level Security (RLS)

Las 20 tablas del esquema (`profiles`, `notebooks`, `pages`, `page_assets`, `import_jobs`, `ai_generations`, `flashcards`, `study_items`, `review_logs`, `page_mastery`, `flashcard_sessions`, `session_feedback`, `exam_questions`, `exam_sessions`, `exam_answers`, `exam_page_state`, `recall_questions`, `recall_sessions`, `recall_answers`, `generation_fingerprints`) tienen RLS activo con `.enableRLS()` en `src/shared/db/schema.ts`, replicado en las migraciones (`drizzle/0001_profiles_rls.sql` y el `ENABLE ROW LEVEL SECURITY` embebido en `0003`, `0005`, `0007`, `0009`, `0010`, `0012` y `0013`). Ninguna de las 20 tiene políticas propias: solo la conexión de servidor (que evita RLS por diseño de Supabase) las alcanza; la autorización real ocurre por filtrado explícito de `ownerId` en `application/` y en los repositorios (RNF-S-01, RNF-S-02).

Los buckets de Storage sí tienen políticas RLS reales por `owner_id`, sobre `storage.objects` (`drizzle/0004_page_assets_storage.sql`, `drizzle/0006_page_pdfs_storage.sql`), porque el navegador sube directamente a Storage con una URL firmada, sin pasar por el servidor (RNF-S-03).

### 12.2 Guardia de sesión y redirección del dominio apex

`src/proxy.ts` corre en cada petición e importa `identity` solo por su entrada liviana `src/modules/identity/proxy.ts` (regla `proxy-via-public-entry`): refresca la sesión de Supabase y redirige a `/login` cualquier ruta sin sesión activa, salvo las de autenticación (`AUTH_PATHS`: `/login`, `/register`, `/forgot-password`), el callback (`/auth/…`), la ruta abierta `/terminos` (`OPEN_PATHS`, para leer los términos de uso sin sesión) y lo que el `matcher` excluye (`/api`, `/monitoring`, `_next` y archivos estáticos). `/reset-password` no está en `AUTH_PATHS`: requiere la sesión que abre el enlace de recuperación al pasar por el callback. También redirige de forma permanente (308) el dominio apex/`www` hacia el host canónico (`NEXT_PUBLIC_SITE_URL`) cuando ambos son variantes del mismo dominio (RNF-S-04).

### 12.3 Content Security Policy con nonce por petición

`src/shared/config/security-headers.ts` construye la CSP; `src/proxy.ts` genera un nonce único por petición (`crypto.randomUUID()` codificado en base64) y lo propaga vía la cabecera `x-nonce` (RNF-S-05).

- `script-src` usa `'self' 'nonce-{value}' 'strict-dynamic'` una vez que existe un nonce, y `'self' 'unsafe-inline'` sin él (el `headers()` estático de `next.config.ts`, red de seguridad solo para rutas fuera del `matcher` del proxy). Además permite `https://*.posthog.com`, porque `posthog-js` carga su configuración remota y módulos diferidos como scripts, y agrega `'unsafe-eval'` solo en desarrollo.
- `style-src` es `'self' 'unsafe-inline'` y nunca lleva nonce: un nonce no cubre los atributos `style=""`, y una `style-src` con nonce bloqueaba los estilos en línea generados en servidor en cargas completas del navegador (decisión del 2026-09-24, `04-ADR.md`, ADR-011).
- El resto de directivas: `default-src 'self'`, `img-src` (Supabase y `googleusercontent.com`), `font-src 'self'`, `connect-src` (Supabase, Sentry, PostHog), `worker-src 'self' blob: data:`, `frame-src 'self' https://www.youtube-nocookie.com` (el bloque de YouTube del editor, `docs/adr/0009`), `form-action 'self' https://*.supabase.co https://accounts.google.com`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` y `upgrade-insecure-requests`, junto con `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Permissions-Policy`.

### 12.4 Validación de variables de entorno

`src/shared/config/env.schema.ts` valida con Zod cada variable al arrancar, separando `clientSchema` (variables `NEXT_PUBLIC_*`) de `serverSchema` (que extiende la de cliente y agrega los secretos de servidor). `env.server.ts` importa `"server-only"`, por lo que la construcción falla si un componente cliente intenta importar el esquema de servidor (RNF-S-07).

### 12.5 Restricciones de subida

`src/modules/notebooks/domain/page-asset.ts` limita las imágenes de página a `image/jpeg`, `image/png`, `image/webp`, `image/gif`, hasta 10 MiB (RF-NB-07, RNF-P-03). `src/modules/ingestion/domain/document-file.ts` limita los documentos importados a los tipos de PDF, DOCX y PPTX, hasta 20 MiB, y exige una ruta de almacenamiento canónica por propietario cuya extensión registra el formato declarado (RF-IN-01, RNF-P-02); `detectDocumentFormat` comprueba los bytes reales y rechaza los que no son el formato declarado. Antes de analizar un Word, `inspectOoxmlPackage` revisa el directorio del ZIP y `OoxmlPackage` infla cada parte con tope (RNF-S-09); el PDF admite hasta 300 páginas (`PDF_LIMITS`), las imágenes extraídas tienen sus propios topes (`IMAGE_LIMITS`), y cada estudiante tiene 20 permisos de subida y 10 inicios por hora y hasta 3 importaciones activas (RF-IN-11). Las imágenes importadas pasan por la misma validación de tipo y tamaño que las de página (`storeImportedAsset`).

### 12.6 Patrones de imágenes remotas

`src/shared/config/image-remote-patterns.ts` restringe `next/image` a un único patrón, `/storage/v1/object/sign/**` sobre el host de Supabase configurado, tolerante a una URL ausente o malformada para que `next.config.ts` siga siendo cargable sin variables de entorno de aplicación (por ejemplo, durante `postinstall`).

### 12.7 Autenticación de los endpoints de cron

`src/app/api/keep-alive/route.ts` y `src/app/api/recompute-mastery/route.ts` comparan el encabezado `Authorization` contra `Bearer <CRON_SECRET>` con `timingSafeEqual` de Node, tras verificar primero que las longitudes coincidan, para que ninguna comparación de prefijo filtre información de temporización sobre el secreto (RNF-S-06).

### 12.8 Auditoría de dependencias en CI

Ambos flujos de trabajo (`.github/workflows/pr.yml`, `.github/workflows/main.yml`) ejecutan `pnpm audit --audit-level=high` en cada `pull request` y en cada `push` a `main`, bloqueando la integración ante una vulnerabilidad de severidad alta o mayor (RNF-S-08).

### 12.9 Alineación con ISO/IEC 27001:2022 Anexo A

Esta tabla documenta alineación, no cumplimiento ni certificación: describe qué controles del Anexo A tienen un mecanismo real y verificable en el código de Cogni.

| Control (Anexo A) | Mecanismo en Cogni | Evidencia |
|---|---|---|
| A.5.15 Control de acceso | Filtrado obligatorio por `ownerId` en cada caso de uso, más RLS en Storage. | `src/modules/notebooks/application/save-page.ts`, `drizzle/0004_page_assets_storage.sql` |
| A.5.16 Gestión de identidad | Registro, verificación de correo, inicio de sesión y recuperación de contraseña vía Supabase Auth. | `src/modules/identity/infrastructure/supabase-auth-gateway.ts` |
| A.5.23 Seguridad de la información para el uso de servicios en la nube | Validación de variables de entorno al arranque, separación cliente/servidor, redirección al dominio canónico. | `src/shared/config/env.schema.ts`, `src/proxy.ts` |
| A.8.15 Registro de eventos | Captura de excepciones no controladas y eventos de producto explícitos. | `src/instrumentation.ts`, `src/shared/observability/analytics.ts` |
| A.8.24 Uso de criptografía | Comparación de tiempo constante para el secreto de cron; URLs de subida y lectura firmadas con vigencia corta. | `src/app/api/keep-alive/route.ts`, `src/app/api/recompute-mastery/route.ts`, `src/modules/notebooks/application/get-asset-read-url.ts` |
| A.8.25 Ciclo de vida de desarrollo seguro | Compuertas obligatorias de tipos, *linting*, pruebas y arquitectura antes de fusionar a `main`. | `.github/workflows/pr.yml`, `.github/workflows/main.yml` |
| A.8.28 Codificación segura | TypeScript estricto, validación de entrada con Zod en cada límite, tipo `Result` en vez de excepciones no tipadas. | `tsconfig.json`, `src/modules/identity/application/credentials-schema.ts`, `src/shared/kernel/result.ts` |
| A.8.29 Pruebas de seguridad en desarrollo y aceptación | Auditoría de dependencias en cada integración; prueba de extremo a extremo que verifica el nonce de la CSP. | `.github/workflows/pr.yml`, `tests/e2e/csp-nonce.spec.ts` |
| A.8.32 Gestión de cambios | Reglas de dependencia entre capas y módulos verificadas automáticamente antes de cada fusión. | `.dependency-cruiser.cjs`, `.github/workflows/pr.yml` |

---

## 13. Observabilidad

**Lo que existe:**

- `src/instrumentation.ts` registra Sentry por *runtime* (`nodejs`/`edge`) y expone `onRequestError = Sentry.captureRequestError`, que captura cualquier excepción no controlada de un Server Component, Server Action o Route Handler.
- `src/instrumentation-client.ts` inicializa Sentry en el navegador (antes de la hidratación) y PostHog (`autocapture: false`, `capture_pageview: false`, `capture_pageleave: false`) — sin captura automática, solo eventos explícitos.
- `sentry.server.config.ts` y `sentry.edge.config.ts` inicializan Sentry con las mismas opciones (`src/shared/observability/sentry-options.ts`): `tracesSampleRate: 0` (solo errores, sin trazas de rendimiento, decisión de cuota) y `sendDefaultPii: false`.
- `next.config.ts` envuelve la configuración con `withSentryConfig`, usando `/monitoring` como ruta de túnel para que el tráfico de Sentry sea del mismo origen (compatible con la CSP).
- `src/shared/observability/analytics.ts` define el puerto `Analytics`; `createServerAnalytics` construye un cliente PostHog por llamada y descarta cualquier fallo sin propagarlo (RNF-F-03). Existen cinco eventos en código: `user_signed_up` (registro), `user_signed_in` (cada intercambio exitoso en `/auth/callback` y cada inicio de sesión con correo y contraseña), `document_imported` (importación terminada, antes `pdf_imported`; con `format` y `skipped_images`), `generation_requested` (generaciones de flashcards, exámenes y recordación activa) y `terms_accepted` (aceptación de términos, con su versión).

**Lo que no existe:**

- La lista de eventos de `docs/documento-maestro.md` §10.3 (`page_created`, `document_imported`, `generation_requested`, `session_started`, `session_finished`, `item_rated`) es aspiracional en lo que no coincide con la lista anterior: `document_imported` y `generation_requested` están implementados; `page_created`, `session_started`, `session_finished` e `item_rated` no.
- No hay trazas de rendimiento (`tracesSampleRate: 0`), ni *dashboards* de métricas de infraestructura propios.
- No hay un `error.tsx` por ruta bajo `src/app` (solo `global-error.tsx` en la raíz) ni `loading.tsx` en ninguna ruta.
- Better Stack (registro de logs externo, entregable de la Fase 9) no está integrado.
- No existe auditoría de accesibilidad ni pruebas de carga (entregables de la Fase 9), más allá de `tests/e2e/editor-a11y.spec.ts`, que cubre solo el editor.
