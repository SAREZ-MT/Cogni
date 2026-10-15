# Documento de Arquitectura de Software (SAD) — Cogni

**Proyecto:** Cogni — plataforma web de estudio a partir de apuntes propios
**Versión:** 1.0
**Fecha:** 2026-09-25
**Estado:** Borrador
**Autor:** Javier Sarez
**Documentos relacionados:** ./01-SRS.md, ./03-DATA-API.md, ./04-ADR.md

---

## 0. Nota de estado actual (2026-09-25, actualizada el 2026-10-10 para la Fase 6 y el 2026-10-14 para la Fase 7)

- Fase 0 (Cimientos) y Fase 1 (Cuadernos y editor) están desplegadas en producción; sus módulos (`identity`, `notebooks`, `editor`) son los únicos, junto con `ingestion`, con capas hexagonales reales.
- Fase 2 (Importación de PDF) se implementó bajo Organic Driven Development (ODD) el 2026-09-23; `src/modules/ingestion` es el módulo más completo del código base y respalda la única vista de código C4 Nivel 4 con implementación real de este documento.
- Fase 3 (Capa de IA) está implementada (registro de proveedores, rotación por cuota, circuit breaker, límite por usuario y generación de flashcards; ADR 0004 en `docs/adr/`). Esta nota de estado y el resto del documento aún no se han revisado completo contra ese código: hasta entonces, el contenido de este documento sobre proveedores de IA, rotación por cuota y rate limiting es especificación de `docs/documento-maestro.md`, marcada explícitamente Roadmap.
- Las Fases 4 a 7 (`study-engine`, `flashcards`, `exams`, `active-recall`, `scheduling`, `analytics`) son esqueletos vacíos (`index.ts` con `export {};` y un `README.md`) en este código base. Cuatro de ellas tienen una versión de diseño visual con datos de muestra en la rama `design/shell-look`, no integrada a `main`; este documento describe la arquitectura de `main`, no la de esa rama.
- Fase 6 (Recordación activa) está implementada (2026-10-08; decisiones en `docs/adr/0007-recordacion-activa-y-generacion-incremental.md`): `src/modules/active-recall` tiene dominio, aplicación, infraestructura y Server Actions, y el flujo 4 de la sección 10 (§10.4) describe la secuencia implementada. Las Fases 3 a 5 también están implementadas (ADR 0004, 0005 y 0006), pero las secciones 2 a 7 y los flujos 2 y 3 de la sección 10 todavía no se han revisado contra ese código; esa actualización queda pendiente.
- Fase 7 (Calendario y dashboard) está implementada (2026-10-14; decisiones en `docs/adr/0008-calendario-y-dashboard.md`): `src/modules/scheduling` y `src/modules/analytics` tienen dominio, aplicación, infraestructura (lectores Drizzle de solo lectura), API de servidor y Server Actions, sin tablas nuevas; el flujo 5 de la sección 10 (§10.5) describe la secuencia implementada y la sección 7 registra sus dependencias reales.
- Fase 9 (Endurecimiento) está parcialmente cubierta: la Content Security Policy con nonce por petición, la redirección del dominio apex y la protección de sesión en `src/proxy.ts` existen; el resto (registro de logs externo, pruebas de carga, auditoría de accesibilidad) no se ha iniciado.
- En este documento: las secciones 2 a 4 (vistas de contexto, contenedores y componentes), 5.1 y 5.3 (código de `ingestion`), 7, 9, el flujo 1 de la sección 10, 11, 12 y 13 describen arquitectura implementada y verificable contra el código. La parte de IA en las secciones 2 a 4, la sección 5.2 (código de `study-engine`), la subsección 8.10 y los flujos 2 a 4 de la sección 10 son especificación (Roadmap), tomada de `docs/documento-maestro.md`.

### Documento vivo

Este documento se actualiza a medida que avanza la construcción de Cogni; la nota de estado de esta sección es el punto de anclaje de esas actualizaciones. Por ejemplo, cuando la Fase 3 (capa de IA) se implemente, la vista de componentes (sección 4) dejará de mostrar `ai` como esqueleto, la vista de código de la sección 5.2 dejará de marcarse Roadmap, y los flujos 2 a 4 de la sección 10 pasarán de especificación a secuencias respaldadas por código real.

### Correspondencia con las fases RAD

| Sección de este documento | Fase RAD | Uso en la tesis |
|---|---|---|
| 1. Introducción; 2, 3 y 4. Vistas de contexto, contenedores y componentes | Diseño de usuario | Muestra cómo el sistema se descompuso en piezas antes de programar, evidencia de diseño previo a la construcción. |
| 5. Vista de código; 7. Vista de módulos; 9. Patrones arquitectónicos | Construcción | Documenta la arquitectura tal como quedó construida (módulos reales, reglas de dependencia verificadas en CI, patrones aplicados), evidencia directa del trabajo de Construcción. |
| 8. Justificación del stack tecnológico | Planificación de requisitos / Diseño de usuario | Argumenta por qué se eligió cada tecnología frente a alternativas reales, insumo para sustentar decisiones de diseño ante el jurado. |
| 10. Flujos arquitectónicos clave | Construcción | Muestra el comportamiento real (o especificado) del sistema como evidencia de la lógica construida. |
| 6. Despliegue; 11. Infraestructura; 12. Seguridad; 13. Observabilidad | Implementación | Evidencia de cómo el sistema construido se despliega, opera y se protege, propia de la fase de Implementación. |

---

## 1. Introducción

### 1.1 Propósito

Este documento describe la arquitectura de software de Cogni usando el modelo C4 (Contexto, Contenedores, Componentes y Código de Simon Brown), complementado con una vista de despliegue, una vista de módulos propia del monolito modular y cinco flujos arquitectónicos clave. No se incluyen diagramas en formato Mermaid ni ningún otro código de diagrama: cada vista se describe como una tabla de elementos y una tabla o secuencia numerada de conexiones, con precisión suficiente para que un diagrama pueda construirse a partir de esa descripción con la herramienta `archify`. El documento cubre tanto la arquitectura implementada (identidad, cuadernos, editor, importación de PDF) como la especificada y pendiente de construir (capa de IA, motor de repetición espaciada, flashcards, exámenes, recordación activa, calendario y dashboard), marcando explícitamente el estado de cada elemento.

### 1.2 Atributos de calidad priorizados

| Prioridad | Atributo | Justificación |
|---|---|---|
| 1 | Costo cero de operación | El proyecto corre sobre planes gratuitos (Vercel Hobby, Supabase Free, Cloudflare DNS gratuito) sin fecha de monetización (`docs/documento-maestro.md` §4.2, §14; SRS §2.4). Toda decisión de infraestructura se evalúa primero contra este límite. |
| 2 | Simplicidad para un equipo de una persona | Cogni lo construye y mantiene una sola persona (`docs/documento-maestro.md` §14, riesgo "Una sola persona desarrollando"). Se prioriza un stack con curva de aprendizaje conocida y una arquitectura que un solo desarrollador pueda razonar por completo. |
| 3 | Mantenibilidad por arquitectura verificable | Los límites entre capas y módulos se verifican automáticamente en cada `pull request`, no solo por convención (RNF-M-01 a RNF-M-06; `.dependency-cruiser.cjs`, `tsconfig.json`, `.github/workflows/pr.yml`). |
| 4 | Seguridad de los datos del estudiante | Cada estudiante solo puede ver y modificar sus propios cuadernos, páginas y archivos (RNF-S-01 a RNF-S-08; Row Level Security, `src/proxy.ts`, `security-headers.ts`). |
| 5 | Rendimiento percibido del editor | El autoguardado y la importación de PDF tienen presupuestos de tiempo explícitos y verificados por prueba (RNF-P-01 a RNF-P-05; `debounceMs`, `maxDuration`). |

---

## 2. Vista de contexto — C4 Nivel 1

> Diagrama a construir con archify a partir de esta descripción.

### 2.1 Elementos

| Elemento | Tipo | Responsabilidad | Estado |
|---|---|---|---|
| Estudiante | Actor humano | Escribe o importa apuntes, y (cuando la Fase 3+ exista) genera y repasa material de estudio (SRS §2.2). | Implementado |
| Cogni | Sistema de software | La plataforma web en sí: organiza apuntes en cuadernos y páginas, y coordinará flashcards, exámenes y recordación activa con un motor de repetición espaciada. | Implementado (núcleo) / Roadmap (estudio) |
| Supabase — Auth, Postgres, Storage | Sistema externo (BaaS) | Autentica al estudiante, persiste todos los datos relacionales y almacena imágenes y PDF importados en buckets privados. | Implementado |
| Google (OAuth) | Sistema externo | Proveedor de identidad federada; el navegador del estudiante navega directamente a su pantalla de consentimiento antes de volver a Cogni (`form-action` de la CSP incluye `https://accounts.google.com`). | Implementado |
| Vercel (Cron) | Sistema externo | Dispara diariamente una petición HTTP autenticada contra `/api/keep-alive` para evitar que el proyecto gratuito de Supabase se pause. | Implementado |
| Cloudflare (DNS) | Sistema externo | Registrador y proveedor de DNS del dominio canónico; resuelve el dominio antes de que cualquier petición llegue a Vercel. No recibe llamadas de la aplicación en tiempo de ejecución. | Implementado |
| Sentry | Sistema externo | Recibe errores no controlados de Server Components, Server Actions y Route Handlers. | Implementado |
| PostHog | Sistema externo | Recibe eventos de producto explícitos (`user_signed_up`, `user_signed_in`, `pdf_imported`). | Implementado |
| Proveedores de IA (Google AI Studio, Groq, Mistral, OpenRouter, Cerebras) | Sistema externo | Generarían flashcards, preguntas de examen, preguntas de recordación activa y evaluarían respuestas abiertas, a través del Vercel AI SDK. | Roadmap — ningún paquete `ai`/`@ai-sdk/*` existe en `package.json` |

### 2.2 Conexiones

| Origen | Destino | Protocolo / mecanismo | Dirección | Descripción |
|---|---|---|---|---|
| Estudiante | Cogni | HTTPS (navegador) | Estudiante → Cogni | Navega la aplicación, escribe apuntes, importa PDF. |
| Cogni | Supabase Auth | HTTPS, `@supabase/ssr` (cookies de sesión) | Cogni → Supabase | Registro, inicio de sesión, verificación de correo, recuperación de contraseña. |
| Estudiante (navegador) | Google | Redirección HTTP + consentimiento OAuth | Estudiante → Google → Cogni (`/auth/callback`) | Inicio de sesión con Google (RF-ID-02). |
| Cogni | Supabase Postgres | Drizzle ORM sobre `postgres.js` (TCP, *transaction pooler*, `max: 1`) | Cogni → Supabase | Lectura/escritura de cuadernos, páginas, adjuntos y trabajos de importación. |
| Cogni / Estudiante (navegador) | Supabase Storage | HTTPS, URL firmada (subida directa) y API con `service role` (servidor) | Bidireccional | Subida de imágenes y PDF, lectura de adjuntos. |
| Vercel Cron | Cogni (`/api/keep-alive`) | HTTPS GET, `Authorization: Bearer <CRON_SECRET>` | Vercel → Cogni | Mantiene activo el proyecto gratuito de Supabase (RNF-F-01). |
| Cogni | Sentry | HTTPS (túnel `/monitoring` en el navegador; SDK directo en servidor) | Cogni → Sentry | Reporta excepciones no controladas. |
| Cogni | PostHog | HTTPS (`posthog-js` en navegador, `posthog-node` en servidor) | Cogni → PostHog | Envía eventos de producto explícitos. |
| Cogni | Proveedores de IA | HTTPS, Vercel AI SDK, salida estructurada validada con Zod | Cogni → Proveedor | Generación y evaluación de material de estudio (Roadmap). |

---

## 3. Vista de contenedores — C4 Nivel 2

> Diagrama a construir con archify a partir de esta descripción.

### 3.1 Elementos

| Contenedor | Tecnología | Responsabilidad | Estado |
|---|---|---|---|
| Aplicación web Cogni | Next.js 16 (App Router) sobre Vercel, TypeScript | Sirve la interfaz (Server/Client Components), ejecuta Server Actions y Route Handlers, y aplica el proxy de sesión y las cabeceras de seguridad. | Implementado |
| Proxy de sesión | `src/proxy.ts` (Next.js `proxy`, ejecutado en cada petición) | Refresca la sesión de Supabase, genera el nonce de CSP por petición, redirige al apex canónico y protege rutas sin sesión. | Implementado |
| Base de datos Postgres | Supabase Postgres, Drizzle ORM | Persiste `profiles`, `notebooks`, `pages`, `page_assets`, `import_jobs`, con Row Level Security activa. | Implementado |
| Almacenamiento de objetos | Supabase Storage (buckets `page-assets`, `page-pdfs`) | Guarda imágenes de página y PDF subidos, con políticas RLS por `owner_id`. | Implementado |
| Servicio de identidad | Supabase Auth | Emite y valida sesiones (correo/contraseña y Google OAuth). | Implementado |
| Programador de tareas | Vercel Cron (`vercel.json`) | Dispara `/api/keep-alive` una vez al día (`0 6 * * *`). | Implementado |
| Registro de proveedores de IA | Vercel AI SDK (lógico, dentro de la aplicación) | Selecciona y rota entre proveedores de IA por cuota y salud (`src/modules/ai/infrastructure/provider-registry.ts`). | Implementado |
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
| Aplicación web Cogni | Registro de proveedores de IA | Llamada de función interna (Vercel AI SDK) | Aplicación → Registro (Roadmap) |
| Registro de proveedores de IA | Proveedores de IA externos | HTTPS, *streaming* de respuestas estructuradas | Registro → Proveedor (Roadmap) |
| Aplicación web Cogni | Monitoreo de errores | HTTPS (SDK de Sentry, túnel `/monitoring`) | Aplicación → Sentry |
| Aplicación web Cogni | Analítica de producto | HTTPS (SDK de PostHog) | Aplicación → PostHog |

---

## 4. Vista de componentes — C4 Nivel 3

> Diagrama a construir con archify a partir de esta descripción.

La aplicación web Cogni (el contenedor Next.js) se descompone en el proxy, el árbol de rutas de `src/app`, los 11 módulos de `src/modules/*` y la capa compartida `src/shared/*`. Cada módulo real sigue la forma hexagonal `domain → application → infrastructure/ui` descrita en la sección 7; cada componente de la tabla es, para los módulos reales, el conjunto de esas capas, y para los módulos esqueleto, solo su `index.ts` vacío.

### 4.1 Tabla de componentes

| Componente | Responsabilidad | Tecnología | Estado |
|---|---|---|---|
| `src/proxy.ts` | Refresca sesión, genera nonce de CSP, redirige apex/`www`, protege rutas sin sesión. | Next.js `proxy` | Implementado |
| `src/app` (App Router) | Páginas, layouts y Route Handlers (`/api/keep-alive`, `/auth/callback`); shell autenticado y shell público. | Next.js App Router, React Server Components | Implementado |
| `identity` | Registro, inicio de sesión (correo y Google), recuperación de contraseña, perfil del estudiante. | Supabase Auth, `@supabase/ssr` | Implementado |
| `notebooks` | Cuadernos, páginas, `plain_text` materializado, adjuntos de imagen; único puerto de persistencia hacia el editor. | Drizzle ORM, Supabase Storage | Implementado |
| `editor` | Autoguardado, estado de conflicto de versión y el editor de bloques Tiptap (menú `/`, barra contextual, resaltado). | Tiptap 3, TanStack Query | Implementado |
| `ingestion` | Importación de un PDF a una página editable, con `ImportJob` como máquina de estados. | `unpdf`, Supabase Storage | Implementado |
| `ai` | Registro de proveedores de IA, rotación por cuota, salida estructurada, prompts versionados. | Vercel AI SDK | Roadmap (esqueleto) |
| `study-engine` | Estado SM-2 por ítem, nivel de dominio por página, cálculo de vencimientos. | — | Roadmap (esqueleto) |
| `flashcards` | Tarjetas de estudio, sesiones de repaso con SM-2, retroalimentación. | — | Roadmap (esqueleto; diseño visual en rama no integrada) |
| `exams` | Preguntas de opción múltiple, sesiones de examen, corrección, repetición con variantes. | — | Roadmap (esqueleto; diseño visual en rama no integrada) |
| `active-recall` | Preguntas abiertas, sesiones de respuesta, evaluación combinada IA + autoevaluación. | — | Implementado (Fase 6; ver §10.4) |
| `scheduling` | Calendario y vista "Hoy" de repasos vencidos. | Drizzle (lectura) | Implementado (Fase 7; ver §10.5) |
| `analytics` | Dashboard de progreso, métricas por técnica, calibración metacognitiva. | Drizzle (lectura), Recharts en la ruta | Implementado (Fase 7; ver §10.5) |
| `shared/config` | Validación de variables de entorno (Zod), cabeceras de seguridad, patrones de imágenes remotas. | Zod | Implementado |
| `shared/db` | Cliente único de Postgres (Drizzle + `postgres.js`) y el esquema de las 5 tablas reales. | Drizzle ORM | Implementado |
| `shared/kernel` | Primitivas transversales: `Clock`, `DomainError`/`ActionError`, `createId` (UUID v7), tipo `Result`. | TypeScript puro | Implementado |
| `shared/observability` | Puerto `Analytics` (PostHog) y opciones de Sentry compartidas. | `@sentry/nextjs`, `posthog-node` | Implementado |
| `shared/ui` | Primitivos de interfaz de estilo shadcn/ui (`Button`, `Dialog`, `DropdownMenu`, etc.). | Radix UI, `class-variance-authority` | Implementado |

---

## 5. Vista de código — C4 Nivel 4

Esta vista se limita a dos módulos, ambos con especificación de código suficientemente cargada de decisiones: `ingestion` (el módulo real más complejo del código base) y `study-engine` (el algoritmo central del producto, todavía no implementado).

### 5.1 `ingestion` — implementado

> Diagrama a construir con archify a partir de esta descripción.

#### 5.1.1 Elementos

| Elemento | Tipo | Responsabilidad |
|---|---|---|
| `ImportJob` | Entidad + máquina de estados (`domain/import-job.ts`) | Representa una importación; expone `createImportJob`, `start`, `complete`, `fail`, `isTerminal`, `isAbandoned`. |
| `ImportJobStatus` | Tipo (`domain/import-job.ts`) | Unión de cadenas: `"queued"`, `"processing"`, `"done"`, `"failed"`. |
| `ImportFailureKind` | Tipo (`domain/import-failure.ts`) | `download`, `invalid_pdf`, `no_text_layer`, `persistence`, `timeout`, cada uno con su mensaje en español. |
| `textToBlocks` | Función de dominio pura (`domain/text-to-blocks.ts`) | Convierte el texto extraído de un PDF en bloques Tiptap mediante heurísticas deterministas. |
| `PdfStorageGateway` | Puerto (`domain/pdf-storage-gateway.ts`) | Subida firmada, metadatos y descarga de un objeto PDF. |
| `PdfTextExtractor` | Puerto (`domain/pdf-text-extractor.ts`) | Extrae texto de los bytes de un PDF, página por página. |
| `NotebookPagesPort` | Puerto (`domain/notebook-pages-port.ts`) | Busca cuadernos/páginas y escribe el contenido importado, sin depender de `notebooks` directamente. |
| `ImportJobRepository` | Puerto (`domain/import-job-repository.ts`) | Persistencia de `ImportJob` mediante transiciones atómicas. |
| `SupabasePdfStorageGateway` | Adaptador (`infrastructure/`) | Implementa `PdfStorageGateway` contra el bucket `page-pdfs`. |
| `UnpdfTextExtractor` | Adaptador (`infrastructure/`) | Implementa `PdfTextExtractor` con la librería `unpdf`. |
| `NotebooksPagesAdapter` | Adaptador (`infrastructure/`) | Implementa `NotebookPagesPort` envolviendo `createNotebooksServerApi` de `notebooks`. |
| `DrizzleImportJobRepository` | Adaptador (`infrastructure/`) | Implementa `ImportJobRepository` sobre la tabla `import_jobs`. |
| `ImportTelemetryAdapter` | Adaptador (`infrastructure/`) | Reporta a Sentry y registra el evento `pdf_imported` en PostHog. |
| `requestPdfUpload`, `startPdfImport`, `processImportJob`, `getImportJobStatus`, `getActiveImports` | Casos de uso (`application/`) | Orquestan el ciclo completo de importación. |

#### 5.1.2 Relaciones

1. `requestPdfUpload` invoca `PdfStorageGateway.createSignedUploadUrl`.
2. `startPdfImport` invoca `ImportJobRepository.create` (idempotente por `storagePath`) y construye un `ImportJob` con `createImportJob`.
3. `processImportJob` invoca `ImportJobRepository.claim` (aplica `start` sobre el `ImportJob`), luego `PdfStorageGateway.download`, luego `PdfTextExtractor.extract`, luego `textToBlocks` (función pura, sin puerto), luego `NotebookPagesPort.writeImportedContent`, y finalmente `ImportJobRepository.markDone` (aplica `complete`) o `ImportJobRepository.markFailed` (aplica `fail`) según el resultado.
4. `processImportJob` invoca `ImportTelemetryAdapter.finished` exactamente una vez por transición terminal.
5. `getImportJobStatus` usa `ImportJob.isAbandoned` (función de solo lectura) para reportar como fallido por tiempo agotado un job que el runtime ya interrumpió, sin escribir ese estado.
6. `SupabasePdfStorageGateway` implementa `PdfStorageGateway`; `UnpdfTextExtractor` implementa `PdfTextExtractor`; `NotebooksPagesAdapter` implementa `NotebookPagesPort`; `DrizzleImportJobRepository` implementa `ImportJobRepository`.
7. `DrizzleImportJobRepository` persiste sobre la tabla `import_jobs` (Postgres) mediante una sentencia `UPDATE ... RETURNING` atómica por cada transición.
8. `UnpdfTextExtractor` es el único archivo del repositorio que puede importar `unpdf` (regla `unpdf-only-in-ingestion-infra` de `.dependency-cruiser.cjs`).

### 5.2 `study-engine` — Roadmap

> Diagrama a construir con archify a partir de esta descripción.

**Roadmap.** `src/modules/study-engine` es un esqueleto (`export {};`); lo siguiente es la especificación de `docs/documento-maestro.md` §7, no código existente.

#### 5.2.1 Elementos

| Elemento | Tipo | Responsabilidad (especificada) |
|---|---|---|
| `StudyItem` | Entidad | Estado SM-2 de un ítem individual (flashcard, pregunta de examen o pregunta de recordación activa): intervalo, factor de facilidad, repeticiones, fecha de vencimiento (`due_at`), racha de fallos (`lapses`). |
| `ReviewLog` | Entidad | Registro histórico de cada calificación aplicada a un `StudyItem`. |
| `PageMastery` | Entidad | Nivel de dominio derivado por página (`Nuevo`, `Aprendiendo`, `Consolidando`, `Dominado`) y su `score` numérico. |
| `applySm2` | Función de dominio pura (especificada) | `applySm2(state, quality, now) → newState`, implementa el algoritmo SM-2 (§7.1 del documento maestro). |
| `computeMastery` | Función de dominio pura (especificada) | Calcula el `score` y el nivel de dominio de una página a partir del estado SM-2 de sus ítems (§7.3). |
| `RecordReview` | Puerto de entrada (especificado, `docs/documento-maestro.md` §5.3 regla 6) | Único punto por el que `flashcards`, `exams` y `active-recall` reportan una calificación; `study-engine` nunca los conoce por su nombre. |
| `GetDueItems` | Puerto de salida (especificado) | Expone a `scheduling` y `analytics` los ítems vencidos y el nivel de dominio, sin revelar la técnica de origen. |

#### 5.2.2 Relaciones (especificadas)

1. `flashcards`, `exams` y `active-recall` invocan `RecordReview` tras cada calificación (nunca al revés — regla `study-engine-knows-no-technique` de `.dependency-cruiser.cjs`, ya activa en CI aunque el módulo esté vacío).
2. `RecordReview` invoca `applySm2` sobre el `StudyItem` correspondiente y escribe un `ReviewLog`.
3. `RecordReview` invoca `computeMastery` para recalcular el `PageMastery` de la página del ítem.
4. `scheduling` y `analytics` invocan `GetDueItems` para leer vencimientos y niveles de dominio, sin calcular fechas por sí mismos (RF-SE-03, RF-SE-04, RF-AN-05).

Nota de la Fase 7 (ADR 0008): `scheduling` y `analytics` no leen por un puerto de `study-engine`, que no ofrece lecturas por dueño y rango; cada uno tiene lectores Drizzle propios de solo lectura sobre `study_items`, `review_logs`, `page_mastery` y las tablas de respuestas de las técnicas (§10.5). La regla se mantiene: ninguno calcula vencimientos ni dominio ni escribe en esas tablas.

### 5.3 Detalle de interfaces y tipos clave

Bloques copiados verbatim de `src/modules/ingestion/domain/`.

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
  readonly status: ImportJobStatus;
  readonly pageCount: number | null; // null until known
  readonly pagesWithoutText: number; // starts at 0
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
}
```

```ts
// src/modules/ingestion/domain/pdf-text-extractor.ts
export interface PdfTextExtractor {
  extract(
    bytes: Uint8Array,
  ): Promise<Result<{ totalPages: number; pages: string[] }, DomainError>>;
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
  create(job: ImportJob): Promise<Result<void, DomainError>>;
  findById(id: string): Promise<ImportJob | null>;
  findByStoragePath(storagePath: string): Promise<ImportJob | null>;
  findLatestByPage(pageId: string): Promise<ImportJob | null>;
  listActivePageIds(ownerId: string): Promise<string[]>;
  claim(input: { id: string; now: Date }): Promise<ImportJob | null>;
  markDone(input: {
    id: string;
    pageCount: number;
    pagesWithoutText: number;
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
export const ABANDONED_AFTER_MS = (MAX_DURATION_S + 30) * 1000;
```

```ts
// src/modules/ingestion/domain/pdf-file.ts (extracto)
export const PDF_MIME = "application/pdf";
export const MAX_PDF_BYTES = 20_971_520; // 20 MiB
export const UPLOAD_GRANT_TTL_MS = 10 * 60 * 1000; // 10 minutos

export function looksLikePdf(bytes: Uint8Array): boolean {
  // comprueba el número mágico "%PDF-"
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
| Vercel (funciones y borde) | Plataforma de cómputo serverless | Ejecuta la aplicación Next.js: Server Components, Server Actions y Route Handlers, con Fluid Compute para invocaciones más largas (importación de PDF). | Vercel (funciones Node.js) |
| Vercel Cron | Programador gestionado | Invoca `/api/keep-alive` diariamente según `vercel.json`. | Vercel Cron |
| Supabase Postgres | Servicio de base de datos gestionado | Almacena `profiles`, `notebooks`, `pages`, `page_assets`, `import_jobs` con RLS activa. | Supabase (Postgres) |
| Supabase Storage | Servicio de almacenamiento de objetos gestionado | Guarda imágenes de página (`page-assets`) y PDF importados (`page-pdfs`) en buckets privados. | Supabase (Storage, compatible S3) |
| Supabase Auth | Servicio de identidad gestionado | Emite y valida sesiones. | Supabase Auth |
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
| Monitoreo de errores | Sentry | HTTPS (SDK / túnel `/monitoring`) |
| Analítica de producto | PostHog | HTTPS (SDK) |

### 6.3 Mecanismos de resiliencia (implementados)

Estos mecanismos son reales y acotados; no existe un circuito de reintento genérico en la plataforma.

1. **Reintento único con degradación** (`ensureProfileResilient`, `src/modules/identity/application/`): si crear el perfil falla, reintenta una vez tras 150 ms; si vuelve a fallar, invoca un `onTransientFailure` de degradación en vez de lanzar una excepción, para que el layout autenticado siga renderizando (RNF-F-02 lo generaliza para `getActiveImports`).
2. **Degradación a lista vacía** (`getActiveImports()`, `src/app/(app)/layout.tsx`): si la consulta de importaciones activas falla, el sidebar se renderiza sin la insignia de importación, en vez de fallar la página completa.
3. **Descarte silencioso de fallos de analítica** (`createServerAnalytics`, `src/shared/observability/analytics.ts`): un fallo al enviar un evento a PostHog se captura y se descarta; nunca propaga la excepción a la petición del estudiante (RNF-F-03).
4. **Abandono por edad, no por *lease*** (`isAbandoned`, `src/modules/ingestion/domain/import-job.ts`): un `ImportJob` no terminal sin escritura reciente se reporta como fallido por tiempo agotado sin que ningún proceso deba liberar un candado explícito.

---

## 7. Vista de módulos (monolito modular)

### 7.0 Estilo arquitectónico

**Monolito modular con arquitectura hexagonal por módulo** (`docs/documento-maestro.md` §5.1): una única aplicación Next.js desplegable, dividida en 11 módulos bajo `src/modules/`, cada uno pensado con dominio puro, casos de uso de aplicación, adaptadores de infraestructura y una capa de interfaz propia.

En este código base, esa forma completa (`domain/`, `application/`, `infrastructure/`, `ui/`) solo existe hoy en tres módulos:

- `identity` — las cuatro capas completas (sin `README.md` propio, a diferencia de los demás módulos).
- `notebooks` — las cuatro capas completas, más `server-api.ts` como segunda raíz de composición para otros módulos.
- `ingestion` — las cuatro capas completas, el módulo real más complejo del código base.

`editor` tiene una forma parcial: `domain/`, `application/` y `ui/`, sin `infrastructure/` propia (no tiene ningún adaptador externo que aislar; consume el `SavePagePort` de `notebooks` por inyección). Su `README.md` está desactualizado — describe el componente `Editor` de Tiptap como pendiente ("llega en PR3b"), pero `editor/index.ts` y `ui/tiptap/editor.tsx` ya lo exportan e implementan en este código base.

Los otros seis módulos (`ai`, `study-engine`, `flashcards`, `exams`, `active-recall`, `scheduling`, `analytics`) son esqueletos: cada uno contiene únicamente un `index.ts` con `export {};` y un `README.md` que documenta su responsabilidad futura y su fase pendiente, sin ninguna de las cuatro capas.

Actualización de la Fase 6: `active-recall` ya no es un esqueleto. Tiene `domain/`, `application/` e `infrastructure/`, y sus Server Actions viven en la raíz del módulo (`actions.ts`, `session-actions.ts`, `evaluation-actions.ts`, `hub-actions.ts`, más `evaluation-runner.ts`, que programa la evaluación con `after()`); no tiene `ui/`, porque sus pantallas viven en `src/app/(app)/active-recall`. La descripción de `ai`, `study-engine`, `flashcards`, `exams` y `scheduling`, implementados en las Fases 3 a 5, queda pendiente de actualizar.

Actualización de la Fase 7: `scheduling` y `analytics` ya no son esqueletos. Cada uno tiene `domain/` (funciones puras de días locales, agrupación del calendario, racha, tasa de acierto, tendencia y calibración), `application/` (`listDueToday`, `listCalendarDays`; `getProgress`, `getTechniqueMetrics`, `getCalibration`) e `infrastructure/` (lectores Drizzle de solo lectura), y en la raíz `actions.ts` (Server Actions), `server-api.ts` y una lectura de servidor sin `"use server"` que recibe el instante con que pinta la página (`calendar-days.ts`, `dashboard-reads.ts`). No tienen `ui/`: sus pantallas viven en `src/app/(app)/calendario` y `src/app/(app)/dashboard`.

### 7.1 Estructura de directorios

Recorte de `eza -T -L 2 src` (trimming: solo `page.tsx`/`layout.tsx`/`route.ts` significativos y los archivos de configuración de nivel raíz de `src`, sin repetir los `.test.ts` unitarios):

```
src
├── app
│   ├── (app)/                 # shell autenticado: home, /notebooks/[id], /notebooks/[id]/pages/[id]
│   ├── (public)/               # /login, /register, /forgot-password, /reset-password
│   ├── api/keep-alive/         # Route Handler para Vercel Cron
│   ├── auth/callback/          # Route Handler para el intercambio PKCE
│   ├── global-error.tsx
│   └── layout.tsx
├── instrumentation-client.ts
├── instrumentation.ts
├── proxy.ts
├── modules
│   ├── identity/                 (domain, application, infrastructure, ui)
│   ├── notebooks/                (domain, application, infrastructure, ui, server-api.ts)
│   ├── editor/                   (domain, application, ui — sin infrastructure)
│   ├── ingestion/                (domain, application, infrastructure, ui)
│   ├── ai/                       (index.ts, README.md — esqueleto)
│   ├── study-engine/             (index.ts, README.md — esqueleto)
│   ├── flashcards/                (index.ts, README.md — esqueleto)
│   ├── exams/                    (index.ts, README.md — esqueleto)
│   ├── active-recall/            (domain, application, infrastructure; Server Actions en la raíz)
│   ├── scheduling/               (domain, application, infrastructure; Server Actions en la raíz)
│   └── analytics/                (domain, application, infrastructure; Server Actions en la raíz)
└── shared
    ├── config/       # env.schema.ts, env.server.ts, env.client.ts, security-headers.ts, image-remote-patterns.ts
    ├── db/           # client.ts, schema.ts
    ├── kernel/       # clock.ts, domain-error.ts, id.ts, result.ts; desde la Fase 6: page-paragraphs.ts, words.ts, generation-fingerprints.ts
    ├── observability/ # analytics.ts, sentry-options.ts
    └── ui/           # button.tsx, dialog.tsx, dropdown-menu.tsx, ...
```

### 7.2 Dependencias entre módulos

> Diagrama a construir con archify a partir de esta descripción.

Especificado en `docs/documento-maestro.md` §5.2 (mapa de módulos completo, incluyendo los módulos aún sin código); la columna Estado indica si la dependencia ya existe en el código de este documento.

| Módulo | Depende de (especificado) | Dependencia real hoy |
|---|---|---|
| `identity` | Supabase Auth (externo) | Implementada |
| `notebooks` | `identity` (vía su `index.ts`, para `ownerId`/sesión) | Implementada |
| `editor` | `notebooks` (solo el tipo `SavePagePort`, inyectado — sin importar su implementación) | Implementada |
| `ingestion` | `notebooks` (vía `server-api.ts`, para crear páginas y escribir contenido) | Implementada |
| `ai` | Proveedores de IA (externo) | Roadmap |
| `study-engine` | Ninguna del dominio de estudio (es la base) | Roadmap |
| `flashcards` | `study-engine`, `ai`, `notebooks` | Roadmap |
| `exams` | `study-engine`, `ai`, `notebooks` | Roadmap |
| `active-recall` | `study-engine`, `ai`, `notebooks` | Implementada (Fase 6) |
| `scheduling` | `study-engine`, `notebooks` | Implementada (Fase 7): `study-engine` (solo el tipo `StudyItemKind`) e `identity` (sesión); lee `pages` y `notebooks` con sus propios lectores, sin importar `notebooks` |
| `analytics` | `study-engine`, técnicas (solo lectura) | Implementada (Fase 7): `study-engine` (tipos `MasteryLevel` y `SessionKind`), `active-recall` (`calibrationOf`) e `identity` (sesión); lee las tablas de las técnicas con sus propios lectores |

Todos los módulos, reales o futuros, dependen además de `src/shared/kernel` (dominio puro compartido) y, fuera de la capa de dominio, de `src/shared/config`, `src/shared/db` y `src/shared/observability`. Ningún módulo importa a otro fuera de su `index.ts` público; la única excepción documentada a "un módulo no depende de otro módulo de técnica" es que `flashcards`, `exams` y `active-recall` dependerán de `study-engine`, nunca al revés (regla `study-engine-knows-no-technique`).

### 7.3 Reglas de dependencia

Las 8 reglas reales de `.dependency-cruiser.cjs`, con `severity: "error"`, verificadas en `pnpm depcruise` dentro de `.github/workflows/pr.yml` y `.github/workflows/main.yml`:

1. **`domain-is-pure`** — el dominio no debe importar de otras capas ni de otros módulos; solo `shared/kernel` está permitido.
2. **`domain-no-npm`** — el dominio no debe depender de paquetes npm externos (Next.js, Drizzle, AI SDK, React, etc.); Zod es la única excepción permitida.
3. **`application-no-infra-or-ui`** — la capa de aplicación depende solo de dominio y puertos; nunca debe importar infraestructura ni interfaz de usuario.
4. **`ui-never-touches-infra`** — la interfaz (y las rutas de la aplicación) consumen la aplicación a través de Server Actions o Route Handlers; nunca deben importar infraestructura directamente.
5. **`cross-module-via-index`** — un módulo solo puede importarse a través de su `index.ts` público, nunca a través de rutas internas.
6. **`editor-tiptap-only-in-ui`** — los paquetes de Tiptap y ProseMirror solo pueden importarse desde `editor/ui`; `editor/domain` y `editor/application` deben permanecer independientes del framework.
7. **`study-engine-knows-no-technique`** — `study-engine` es agnóstico de técnica; `flashcards`, `exams` y `active-recall` deben hablarle a través de sus puertos, nunca al revés.
8. **`unpdf-only-in-ingestion-infra`** — `unpdf` solo puede importarse desde `ingestion/infrastructure` (`unpdf-text-extractor.ts`); cualquier otra capa o módulo debe permanecer desacoplado de la librería de análisis de PDF.

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

Ver ADR-003.

### 8.2 Tailwind CSS 4 + shadcn/ui

| Criterio | Evaluación |
|---|---|
| Costo | Gratuito y de código abierto. |
| Consistencia visual | Utilidades atómicas más componentes copiados (no una dependencia de paquete de componentes) permiten adaptar cada primitivo a los tokens de `docs/design-system/`. |
| Mantenibilidad | Los primitivos viven en `src/shared/ui/` (`button.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, etc.), versionados junto al resto del código. |
| Riesgo | Tailwind 4 cambia su modelo de configuración (basado en CSS, no en `tailwind.config.js`); requiere seguir su documentación específica de versión. |

Sin ADR dedicado en la suite; la decisión queda documentada aquí y en `docs/design-system/`.

### 8.3 Supabase Postgres + Drizzle ORM

| Criterio | Evaluación |
|---|---|
| Costo | Plan Free de Supabase; se pausa tras ~7 días de inactividad, mitigado con el cron de `keep-alive` (RNF-F-01). |
| Tipado | Drizzle infiere tipos TypeScript directamente del esquema (`ProfileRow`, `PageRow`, etc., en `src/shared/db/schema.ts`). |
| Migraciones | Migraciones incrementales versionadas en `drizzle/*.sql`, con reversión manual documentada en `.down.sql` para 5 de 7 migraciones (RNF-M-03). |
| Restricción operativa | El *pooler* de transacciones de Supabase no admite sentencias preparadas; el cliente se crea con `{ prepare: false, max: 1 }` (RNF-P-05). |
| Riesgo | Sin `down` automático en `drizzle-kit`; toda reversión es manual contra `cogni-dev`/`cogni-prod`. |

Ver ADR-004.

### 8.4 Supabase Auth

| Criterio | Evaluación |
|---|---|
| Costo | Incluido en el plan Free de Supabase. |
| Cobertura funcional | Correo/contraseña con verificación y Google OAuth (RF-ID-01, RF-ID-02) sin construir un servicio de identidad propio. |
| Integración con Next.js | `@supabase/ssr` gestiona la sesión por cookies, refrescada en cada petición por `src/proxy.ts`. |
| Seguridad | Row Level Security en `profiles` (sin políticas propias: solo la conexión de servidor, que evita RLS, la alcanza). |
| Riesgo | Acopla la identidad del producto a un proveedor externo; migrar de proveedor implicaría reescribir `identity/infrastructure`. |

Ver ADR-005.

### 8.5 Tiptap 3

| Criterio | Evaluación |
|---|---|
| Costo | Extensiones oficiales usadas son de código abierto; no se usa el paquete de plantilla de pago. |
| Cobertura funcional | Encabezados, listas, tablas, código con resaltado, callouts, imágenes, menú `/`, barra contextual, manejador de arrastre — todo con extensiones oficiales o construidas sobre ProseMirror. |
| Aislamiento arquitectónico | Confinado a `editor/ui` por la regla `editor-tiptap-only-in-ui`; el dominio y la aplicación del editor no conocen Tiptap. |
| Riesgo | Tiptap 3 fija varias extensiones a una versión exacta (`3.31.3`, sin `^`) en `package.json`, señal de incompatibilidades conocidas entre versiones menores. |

Ver ADR-006.

### 8.6 `unpdf`

| Criterio | Evaluación |
|---|---|
| Costo | Gratuito, sin dependencias nativas (a diferencia de otras librerías de PDF basadas en binarios). |
| Cobertura funcional | Extrae texto página por página (`extractText(pdf, { mergePages: false })`), suficiente para RF-IN-06 sin necesitar OCR. |
| Aislamiento arquitectónico | Confinado a `ingestion/infrastructure` por la regla `unpdf-only-in-ingestion-infra`. |
| Riesgo | No soporta OCR; un PDF sin capa de texto se rechaza explícitamente (`no_text_layer`), una limitación de producto aceptada, no un defecto. |

Sin ADR dedicado en la suite; decisión de bajo nivel dentro del alcance de ADR-002.

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
| Cobertura | 134 archivos de prueba (`*.test.ts(x)`) bajo `src`, 8 especificaciones Playwright bajo `tests/e2e`, y `pnpm depcruise` como prueba de arquitectura (RNF-M-05). |
| Disciplina de equipo de una persona | Biome unifica *linting*, formateo y organización de imports en una sola herramienta y configuración (RNF-M-04). |
| Riesgo | Ninguna cobertura mínima está configurada (`vitest.config.ts` no define `thresholds`); la disciplina de prueba depende del criterio del desarrollador, no de una puerta automática. |

Ver ADR-010.

### 8.9 Vercel Hobby + Cloudflare DNS

| Criterio | Evaluación |
|---|---|
| Costo | Ambos planes son gratuitos; el riesgo aceptado es que Vercel Hobby asume uso no comercial (SRS §2.4). |
| Simplicidad operativa | Integración Git nativa: cada `push` a `main` despliega a producción; cada rama abre un *preview*. |
| Rendimiento | Fluid Compute permite invocaciones más largas (`maxDuration = 120` en la importación de PDF) sin migrar a un servicio de colas separado. |
| Riesgo | El plan gratuito de Vercel puede reclasificar el uso como comercial si el tráfico crece; migrar de plan no requiere cambios de código, solo de facturación. |

Ver ADR-009.

### 8.10 Vercel AI SDK (Roadmap)

| Criterio | Evaluación |
|---|---|
| Costo | Múltiples proveedores con nivel gratuito (Google AI Studio, Groq, Mistral, OpenRouter, Cerebras), rotados para no depender de uno solo. |
| Cobertura funcional especificada | Salida estructurada (`generateObject`) validada con Zod para las seis operaciones de `docs/documento-maestro.md` §8.4 (flashcards, preguntas de examen, variantes, preguntas de recordación activa, evaluación de respuesta, retroalimentación de sesión). |
| Riesgo | Ningún paquete `ai`/`@ai-sdk/*` existe hoy en `package.json`; toda esta fila es especificación, no código. El riesgo de negocio (tiers gratuitos que cambian o desaparecen) está documentado en `docs/documento-maestro.md` §14. |

Ver ADR-008.

---

## 9. Patrones arquitectónicos

### 9.1 Monolito modular

Una única aplicación Next.js desplegable, dividida en 11 módulos independientes bajo `src/modules/`, cada uno con una responsabilidad única (`docs/documento-maestro.md` §5.1–§5.2; ver sección 7).

### 9.2 Arquitectura hexagonal (puertos y adaptadores)

Cada módulo real separa `domain/` (entidades y puertos), `application/` (casos de uso) e `infrastructure/` (adaptadores), verificado por las reglas 1 a 4 de la sección 7.3. Ejemplo: `src/modules/ingestion/domain/pdf-storage-gateway.ts` declara el puerto `PdfStorageGateway`; `src/modules/ingestion/infrastructure/supabase-pdf-storage-gateway.ts` lo implementa contra Supabase Storage.

### 9.3 Server Components + Server Actions

La interfaz se construye con React Server Components por defecto; las mutaciones se exponen como Server Actions (`"use server"`) en el `actions.ts` de cada módulo, evitando una capa de API REST intermedia. Ejemplo: `src/modules/notebooks/actions.ts` expone `createNotebook`, `saveContent`, `getSidebarTree`, entre otras.

### 9.4 Repositorio vía puertos

El acceso a datos se declara como una interfaz en `domain/` y se implementa en `infrastructure/`, nunca al revés. Ejemplo: `PageRepository` (`src/modules/notebooks/domain/page-repository.ts`) declarado en el dominio; `DrizzlePageRepository` (`src/modules/notebooks/infrastructure/drizzle-page-repository.ts`) lo implementa con Drizzle ORM.

### 9.5 Tipo `Result`

Toda operación que puede fallar de forma esperada devuelve `Result<T, E>` en vez de lanzar una excepción, en `src/shared/kernel/result.ts` (`Ok<T> | Err<E>`, con `ok`, `err`, `isOk`, `isErr`, `map`, `mapErr`, `unwrapOr`). Se usa de forma consistente en los puertos y casos de uso de `identity`, `notebooks` e `ingestion`.

### 9.6 Máquina de estados

`ImportJob` modela su ciclo de vida como una máquina de estados explícita (`queued → processing → done/failed`), con funciones puras de transición (`start`, `complete`, `fail`) que devuelven un error de dominio ante una transición inválida, en `src/modules/ingestion/domain/import-job.ts`.

---

## 10. Flujos arquitectónicos clave

### 10.1 Flujo de uso: crear un cuaderno, una página y escribir con autoguardado

> Diagrama a construir con archify a partir de esta descripción.

**Implementado.**

1. El estudiante sin sesión llega a `/login`; `src/proxy.ts` lo deja pasar por ser una ruta de autenticación.
2. El estudiante inicia sesión; el formulario invoca la Server Action `signInAction` (`src/modules/identity/actions.ts`), que llama a `AuthGateway.signInWithPassword`.
3. Supabase Auth valida las credenciales y `@supabase/ssr` fija la cookie de sesión; en la siguiente petición, `src/proxy.ts` detecta la sesión y redirige a `/`.
4. En el shell autenticado (`src/app/(app)/layout.tsx`), `ensureProfileForUser` asegura la fila `profiles` del estudiante.
5. El estudiante crea un cuaderno desde el panel lateral; el componente invoca la Server Action `createNotebook` (`src/modules/notebooks/actions.ts`), que ejecuta el caso de uso `createNotebook` (`application/create-notebook.ts`) y lo persiste con `DrizzleNotebookRepository`.
6. El estudiante crea una página dentro del cuaderno; la Server Action `createPage` ejecuta el caso de uso homónimo, que rechaza la operación si el cuaderno está archivado (`NOTEBOOK_ARCHIVED`).
7. El estudiante escribe en el editor Tiptap; `useAutosave` (`src/modules/editor/application/use-autosave.ts`) detecta el cambio y, tras un *debounce* de 800 a 1500 ms, invoca `port.save`, que la página conecta a la Server Action `saveContent`.
8. `saveContent` ejecuta el caso de uso `savePage` (`src/modules/notebooks/application/save-page.ts`), que aplica una comparación-e-intercambio atómica sobre `content_version` (`DrizzlePageRepository.updateIfVersion`) y recalcula `plain_text` con `extractPlainText`.
9. Si otro cliente ya guardó una versión más nueva, `savePage` devuelve `PAGE_VERSION_CONFLICT`; `useAutosave` llama a `port.getCurrent`, guarda el borrador descartado en `conflictDraft` y pasa a estado `conflict`.

### 10.2 Generación de flashcards con IA

> Diagrama a construir con archify a partir de esta descripción.

**Roadmap** — `ai`, `flashcards` y `study-engine` son esqueletos vacíos; secuencia especificada en `docs/documento-maestro.md` §3.3, §8.1–§8.4 y el caso de uso CU-06.

1. El estudiante solicita "Generar flashcards" para una página con contenido.
2. `flashcards.application` invocaría a `ai.application` con el propósito `generate_flashcards` y el `plain_text` de la página.
3. `ai.application` seleccionaría un proveedor sano del `ProviderRegistry`, invocaría el Vercel AI SDK con `generateObject` y el esquema `{cards:[{front,back}]}`.
4. Si la salida no cumple el esquema, reintenta una vez con otro proveedor de la rotación; si todos fallan, la generación se marca `failed` sin inventar contenido.
5. `flashcards.infrastructure` guardaría las tarjetas generadas, asociadas uno a uno con la página.
6. `flashcards` invocaría el puerto `RecordReview`/registro inicial de `study-engine` para crear un `StudyItem` por tarjeta nueva.

### 10.3 Generación de examen con IA y repetición con variantes

> Diagrama a construir con archify a partir de esta descripción.

**Roadmap** — `ai`, `exams` y `study-engine` son esqueletos vacíos; secuencia especificada en `docs/documento-maestro.md` §3.3, §7.5 y el caso de uso CU-08.

1. El estudiante inicia una sesión de examen de opción múltiple (10 preguntas por defecto).
2. `exams.application` generaría o recuperaría preguntas mediante `ai.application` con el propósito `generate_exam_questions`.
3. El estudiante responde cada pregunta; la corrección es determinista (correcta → calidad 4, incorrecta → calidad 1), sin llamar a la IA para calificar.
4. Al finalizar, `exams.application` calcularía la puntuación (`correctas/total`); si es menor al 70 %, marcaría la sesión para repetición (`retake_pending`) y registraría los conceptos raíz fallados.
5. Para la repetición, `exams.application` invocaría a `ai.application` con el propósito `generate_exam_variants`, una variante por cada `root_id` fallado, retirando la pregunta original (`retired_at`).
6. Cada respuesta, original o de repetición, invocaría `RecordReview` de `study-engine` sobre el `StudyItem` de la pregunta raíz.

### 10.4 Recordación activa con evaluación combinada

> Diagrama a construir con archify a partir de esta descripción.

**Implementado (Fase 6, 2026-10-08)** — `src/modules/active-recall`, con `ai` y `study-engine` como dependencias a través de sus `index.ts`; decisiones en `docs/adr/0007-recordacion-activa-y-generacion-incremental.md`; trazabilidad con CU-09, RF-AR-01 a RF-AR-06 y RF-AI-03.

Generación (previa a la sesión):

1. En el panel de técnicas de la página, "Generar" de Recordación activa llama a `generateRecallQuestionsAction`. `requestRecallGeneration` lee el texto de la página (`notebooks`), selecciona los párrafos que la técnica aún no usó (`selectNewParagraphs` sobre `generation_fingerprints`; sin nada nuevo responde `RECALL_NO_NEW_CONTENT` sin llamar a la IA), consulta el límite diario de generaciones (`peek`) y llama a `ai.generateStructured` con `generate_recall_questions/v1` (10 preguntas con rúbrica).
2. En una sola transacción (`DrizzleRecallUnitOfWork`) guarda las preguntas, un `StudyItem(kind = "recall_question")` por pregunta y las huellas de los párrafos enviados; después consume la unidad (`check`).

Sesión y evaluación:

3. La ruta `/active-recall/{cuaderno}/{página}` lee un plan (`planRecallSession`: hasta 10 preguntas, vencidas primero, luego nuevas y luego las repasadas hace más tiempo) sin escribir. Con la primera respuesta, el reproductor abre la sesión (`startRecallSessionAction`).
4. Cada respuesta y su autoevaluación 0–5 se guardan al darlas (`saveRecallAnswerAction`, `recall_answers.evaluation_status = pending`); guardar y cerrar se serializan con el bloqueo de la fila de la sesión.
5. "Terminar" (`finishRecallSessionAction`) cierra la sesión con las respuestas dadas y responde de inmediato; `evaluation-runner.ts` programa `evaluateRecallSession` con `after()`, dentro de `maxDuration = 300` de la ruta (ADR 0003).
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
9. La ruta mapea los tres resultados con la función pura `buildDashboardView` (zona de calibración por la señal más frecuente, variación solo en la racha) y pinta los componentes con los gráficos de `src/shared/ui/chart.tsx` (Recharts). Si alguna lectura falla muestra un aviso de error; sin datos, un estado vacío.

---

## 11. Decisiones de infraestructura

### 11.1 `vercel.json` (completo)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/keep-alive", "schedule": "0 6 * * *" }]
}
```

### 11.2 `next.config.ts` (extracto relevante)

```ts
const nextConfig: NextConfig = {
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

`.github/workflows/main.yml` ejecuta los mismos 5 pasos y agrega un job `e2e` (con `pnpm test:db` y `pnpm exec playwright test` contra un `next build && next start` local, node 22).

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
| `CRON_SECRET` | Secreto de al menos 32 caracteres para autenticar `/api/keep-alive`. | Vercel Cron |
| `SENTRY_DSN` | DSN de Sentry para el servidor (opcional). | Sentry |
| `SUPABASE_STORAGE_BUCKET` | Nombre del bucket privado de imágenes de página. | Supabase Storage |
| `SUPABASE_PDF_BUCKET` | Nombre del bucket privado de PDF importados. | Supabase Storage |
| `SENTRY_AUTH_TOKEN` | Habilita la subida de *source maps* en el build de producción. | Sentry (CI/Vercel) |
| `VERCEL_ENV` | Entorno de Vercel, leído por `sentry.*.config.ts` y `scripts/migrate-in-build.mjs`. | Vercel |
| `VERCEL_GIT_COMMIT_SHA` | SHA del commit, leído por `sentry.*.config.ts`. | Vercel |
| `RUN_DB_MIGRATIONS` | Escape hatch para migrar localmente contra `cogni-dev` sin desplegar. | Aplicación |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Referenciadas solo en un comentario de `next.config.ts`; Vercel las inyecta en el build a través de su integración con Sentry. | Sentry (Vercel) |

Secretos de GitHub Actions (solo nombres, usados en `main.yml` para el job `e2e`): `DEV_SUPABASE_URL`, `DEV_SUPABASE_PUBLISHABLE_KEY`, `DEV_SUPABASE_SERVICE_ROLE_KEY`, `DEV_DATABASE_URL`, `DEV_CRON_SECRET`.

---

## 12. Seguridad

### 12.1 Row Level Security (RLS)

Las 5 tablas del esquema (`profiles`, `notebooks`, `pages`, `page_assets`, `import_jobs`) tienen RLS activo con `.enableRLS()` en `src/shared/db/schema.ts`, replicado en las migraciones (`drizzle/0001_profiles_rls.sql` y el `ENABLE ROW LEVEL SECURITY` embebido en `0003_notebooks_pages_assets.sql` y `0005_import_jobs.sql`). Ninguna de las 5 tiene políticas propias: solo la conexión de servidor (que evita RLS por diseño de Supabase) las alcanza; la autorización real ocurre por filtrado explícito de `ownerId` en `application/` (RNF-S-01, RNF-S-02).

Los buckets de Storage sí tienen políticas RLS reales por `owner_id`, sobre `storage.objects` (`drizzle/0004_page_assets_storage.sql`, `drizzle/0006_page_pdfs_storage.sql`), porque el navegador sube directamente a Storage con una URL firmada, sin pasar por el servidor (RNF-S-03).

### 12.2 Guardia de sesión y redirección del dominio apex

`src/proxy.ts` corre en cada petición: refresca la sesión de Supabase, redirige a `/login` cualquier ruta sin sesión activa (salvo las de autenticación y `/api`, `/monitoring`), y redirige de forma permanente (308) el dominio apex/`www` hacia el host canónico (`NEXT_PUBLIC_SITE_URL`) cuando ambos son variantes del mismo dominio (RNF-S-04).

### 12.3 Content Security Policy con nonce por petición

`src/shared/config/security-headers.ts` construye la CSP; `src/proxy.ts` genera un nonce único por petición (`crypto.randomUUID()`) y lo propaga vía la cabecera `x-nonce` (RNF-S-05). En el código de este documento (`main`), tanto `script-src` como `style-src` usan `'self' 'nonce-{value}' 'strict-dynamic'` una vez que existe un nonce; `next.config.ts`'s `headers()` estático mantiene `'unsafe-inline'` como red de seguridad solo para rutas fuera del `matcher` del proxy.

**Decisión pendiente (2026-09-24):** se decidió cambiar `style-src` a `'self' 'unsafe-inline'`, manteniendo `script-src` con nonce + `'strict-dynamic'`, porque un nonce no cubre los atributos `style=""` y los estilos en línea generados por el *renderizado* en servidor quedaban bloqueados en cargas completas del navegador. Este cambio **no está implementado** en `security-headers.ts` a la fecha de este documento (Ver ADR-011).

### 12.4 Validación de variables de entorno

`src/shared/config/env.schema.ts` valida con Zod cada variable al arrancar, separando `clientSchema` (variables `NEXT_PUBLIC_*`) de `serverSchema` (que extiende la de cliente y agrega los secretos de servidor). `env.server.ts` importa `"server-only"`, por lo que la construcción falla si un componente cliente intenta importar el esquema de servidor (RNF-S-07).

### 12.5 Restricciones de subida

`src/modules/notebooks/domain/page-asset.ts` limita las imágenes de página a `image/jpeg`, `image/png`, `image/webp`, `image/gif`, hasta 10 MiB (RF-NB-07, RNF-P-03). `src/modules/ingestion/domain/pdf-file.ts` limita los PDF importados a `application/pdf`, hasta 20 MiB, valida el número mágico `%PDF-` (`looksLikePdf`) y exige una ruta de almacenamiento canónica por propietario (RF-IN-01, RNF-P-02).

### 12.6 Patrones de imágenes remotas

`src/shared/config/image-remote-patterns.ts` restringe `next/image` a un único patrón, `/storage/v1/object/sign/**` sobre el host de Supabase configurado, tolerante a una URL ausente o malformada para que `next.config.ts` siga siendo cargable sin variables de entorno de aplicación (por ejemplo, durante `postinstall`).

### 12.7 Autenticación del endpoint de cron

`src/app/api/keep-alive/route.ts` compara el encabezado `Authorization` contra `Bearer <CRON_SECRET>` con `timingSafeEqual` de Node, tras verificar primero que las longitudes coincidan, para que ninguna comparación de prefijo filtre información de temporización sobre el secreto (RNF-S-06).

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
| A.8.24 Uso de criptografía | Comparación de tiempo constante para el secreto de cron; URLs de subida y lectura firmadas con vigencia corta. | `src/app/api/keep-alive/route.ts`, `src/modules/notebooks/application/get-asset-read-url.ts` |
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
- `src/shared/observability/analytics.ts` define el puerto `Analytics`; `createServerAnalytics` construye un cliente PostHog por llamada y descarta cualquier fallo sin propagarlo (RNF-F-03). Solo tres eventos existen en código: `user_signed_up`, `user_signed_in`, `pdf_imported`.

**Lo que no existe:**

- La lista de eventos de `docs/documento-maestro.md` §10.3 (`page_created`, `generation_requested`, `session_started`, `session_finished`, `item_rated`) es aspiracional; solo los tres eventos anteriores están implementados.
- No hay trazas de rendimiento (`tracesSampleRate: 0`), ni *dashboards* de métricas de infraestructura propios.
- No hay un `error.tsx` por ruta bajo `src/app` (solo `global-error.tsx` en la raíz) ni `loading.tsx` en ninguna ruta.
- Better Stack (registro de logs externo, entregable de la Fase 9) no está integrado.
- No existe auditoría de accesibilidad ni pruebas de carga (entregables de la Fase 9), más allá de `tests/e2e/editor-a11y.spec.ts`, que cubre solo el editor.
