# Especificación de Requisitos de Software (SRS) — Cogni

**Proyecto:** Cogni — plataforma web de estudio a partir de apuntes propios
**Versión:** 1.0
**Fecha:** 2026-09-25
**Estado:** Borrador
**Autor:** Javier Sarez
**Documentos relacionados:** ./02-SAD.md, ./03-DATA-API.md, ./04-ADR.md

---

## 0. Nota de estado actual (2026-10-01)

- Fase 0 (Cimientos) y Fase 1 (Cuadernos y editor) están desplegadas en producción.
- Fase 2 (Importación de PDF) fue implementada bajo Organic Driven Development (ODD) el 2026-09-23; el módulo `src/modules/ingestion` es real, no un esqueleto.
- Fase 3 (Capa de IA) no ha iniciado: el módulo `src/modules/ai` es un esqueleto vacío (`export {};`).
- Las Fases 4 a 7 (flashcards, exámenes, recordación activa, calendario y dashboard) existen únicamente como vistas previas visuales con datos de muestra, integradas en `main` pero ocultas en producción tras `requireDesignPreviews()` (las rutas responden 404 y la barra lateral muestra "pronto"); los módulos `flashcards`, `study-engine`, `exams`, `active-recall`, `scheduling` y `analytics` siguen siendo esqueletos vacíos en el código base de este documento.
- Fase 8 (Endurecimiento) está parcialmente cubierta: la Content Security Policy con nonce por petición, la redirección del dominio apex y la protección de sesión ya existen en `src/proxy.ts` y `src/shared/config/security-headers.ts`; el resto de los entregables (registro de logs externo, pruebas de carga, auditoría de accesibilidad, manual de usuario) no se han iniciado.
- En este documento: las secciones 1, 2, 4 y 5 describen tanto lo implementado como lo planeado, marcado explícitamente por su columna Estado; la sección 3 (casos de uso) sigue el mismo criterio caso por caso.

### Documento vivo

Este documento se actualiza a medida que avanza la construcción de Cogni; la Nota de estado de esta sección es el punto de anclaje de esas actualizaciones. Por ejemplo, cuando la Fase 3 (capa de IA) se implemente, los requisitos `RF-AI-*` y el caso de uso CU-06 dejarán de marcarse Roadmap y pasarán a Implementado, y esta nota reflejará ese cambio en su próxima revisión.

### Correspondencia con las fases RAD

| Sección de este documento | Fase RAD | Uso en la tesis |
|---|---|---|
| 1. Introducción, 2. Descripción general | Planificación de requisitos | Define el alcance y la audiencia del sistema para justificar el problema en la sección 4 de la tesis. |
| 3. Casos de uso | Planificación de requisitos / Diseño de usuario | Sustenta los flujos de interacción del estudiante como evidencia de diseño centrado en el usuario. |
| 4. Requisitos funcionales | Planificación de requisitos | Lista verificable de comportamientos exigidos, insumo directo de la fase de Construcción. |
| 5. Requisitos no funcionales | Planificación de requisitos | Métricas y controles medibles que la Construcción debe cumplir y que Implementación debe verificar. |
| 6. Matriz de trazabilidad | Planificación de requisitos | Cierra el ciclo requisito–caso de uso como evidencia de rigor metodológico ante el jurado. |

---

## 1. Introducción

### 1.1 Propósito

Este documento especifica los requisitos funcionales y no funcionales de Cogni, una plataforma web para estudiar a partir de apuntes propios. Sirve como referencia base para los otros tres documentos de la suite técnica del proyecto (diseño en `./02-SAD.md`, modelo de datos y contrato de API en `./03-DATA-API.md`, decisiones arquitectónicas en `./04-ADR.md`) y está dirigido a un jurado académico y a cualquier lector que necesite verificar, contra el código fuente del repositorio, qué comportamiento ofrece Cogni hoy y cuál está planeado.

### 1.2 Alcance del sistema

Cogni organiza su dominio en 11 módulos bajo `src/modules/`, cada uno con una única responsabilidad (`docs/documento-maestro.md` §5.1–§5.2). La tabla siguiente indica la descripción y el estado real de cada módulo en este código base.

| Módulo | Descripción | Estado |
|---|---|---|
| `identity` | Registro, inicio de sesión (correo y Google), recuperación de contraseña y perfil del estudiante. | Implementado |
| `notebooks` | Cuadernos, páginas, contenido de página, `plain_text` materializado y adjuntos de imagen. | Implementado |
| `editor` | Editor de bloques Tiptap: menú `/`, barra de herramientas contextual, resaltado, autoguardado y subida de imágenes. | Implementado |
| `ingestion` | Importación de un PDF a una página editable, con seguimiento de estado (`ImportJob`). | Implementado |
| `ai` | Registro de proveedores de IA, rotación por cuota, salida estructurada y prompts versionados. | Roadmap |
| `study-engine` | Estado SM-2 por ítem, nivel de dominio por página y cálculo de vencimientos. | Roadmap |
| `flashcards` | Tarjetas de estudio, sesiones de repaso con SM-2 y retroalimentación. | Vista previa integrada (oculta en producción) |
| `exams` | Preguntas de opción múltiple, sesiones de examen, corrección y repetición. | Vista previa integrada (oculta en producción) |
| `active-recall` | Preguntas abiertas, sesiones de respuesta y evaluación combinada IA + autoevaluación. | Vista previa integrada (oculta en producción) |
| `scheduling` | Calendario y vista "Hoy" de repasos vencidos. | Roadmap |
| `analytics` | Dashboard de progreso, métricas por técnica y calibración metacognitiva. | Vista previa integrada (oculta en producción) |

Las cuatro filas marcadas "Vista previa integrada (oculta en producción)" tienen una versión visual con datos de muestra locales a cada ruta, ya integrada en `main` y protegida por `requireDesignPreviews()` (`src/shared/config/design-previews.ts`): en producción las rutas responden 404 y la barra lateral muestra "pronto"; se ven en desarrollo o con `COGNI_DESIGN_PREVIEWS=1`. Su dominio y aplicación siguen siendo esqueletos vacíos en este código base.

### 1.3 Definiciones y acrónimos

| Término | Definición |
|---|---|
| SM-2 | Algoritmo de repetición espaciada (Wozniak, 1987): a partir de una calificación de calidad entera 0–5, calcula el nuevo intervalo y factor de facilidad de un ítem (`docs/documento-maestro.md` §7.1). Roadmap: el módulo `study-engine` es un esqueleto vacío. |
| Recordación activa (Active Recall) | Técnica de estudio con preguntas abiertas evaluadas por IA contra una rúbrica (`docs/documento-maestro.md` §3.3, §7.4). Roadmap. |
| Calibración metacognitiva | Comparación entre la autoevaluación del estudiante y el resultado real de una evaluación, usada para detectar exceso o falta de confianza (`docs/documento-maestro.md` §7.4, §3.6). Roadmap. |
| Nivel de dominio | Estado derivado de una página (`Nuevo`, `Aprendiendo`, `Consolidando`, `Dominado`) calculado a partir del estado SM-2 de sus ítems (`docs/documento-maestro.md` §7.3). Roadmap. |
| Página | Unidad de estudio de Cogni; contiene el documento Tiptap (`content`) y, en el futuro, sus ítems de estudio. Tabla `pages` (`src/shared/db/schema.ts`). |
| Cuaderno | Agrupación de páginas de un estudiante, sin semántica de estudio propia. Tabla `notebooks` (`src/shared/db/schema.ts`). |
| ImportJob | Máquina de estados que rastrea una importación de PDF (`queued → processing → done/failed`). Tabla `import_jobs`; lógica en `src/modules/ingestion/domain/import-job.ts`. |
| `plain_text` | Texto plano materializado a partir del documento Tiptap de una página en cada guardado. Columna `pages.plain_text`; función `extractPlainText` en `src/modules/notebooks/domain/plain-text.ts`. |
| Retake 70 % | Regla de repetición de examen: una puntuación menor al 70 % marca la sesión para repetirse con preguntas nuevas sobre los conceptos fallados (`docs/documento-maestro.md` §7.5). Roadmap. |
| Bloque Tiptap | Unidad de contenido del documento JSON producido por el editor Tiptap (párrafo, encabezado, lista, tabla, imagen, callout, etc.), almacenada en `pages.content`. |

## 2. Descripción general

### 2.1 Perspectiva del producto

Cogni es una plataforma web para estudiar a partir de apuntes propios: el estudiante escribe o importa su contenido en un editor de bloques tipo Notion, y la plataforma genera y programa, a partir de ese contenido, tres técnicas de estudio con respaldo científico (flashcards con SM-2, exámenes de opción múltiple y recordación activa evaluada por IA), coordinadas por un único motor de repetición espaciada transversal (`docs/documento-maestro.md` §1.1, §3.4). No es una herramienta colaborativa (un cuaderno pertenece a un único estudiante), no es una aplicación móvil nativa ni una PWA, no sincroniza con calendarios externos, no ofrece búsqueda global ni gamificación, y no realiza reconocimiento óptico de caracteres — un PDF sin capa de texto seleccionable no se importa (`docs/documento-maestro.md` §1.2). Se integra con Supabase (Postgres, Auth y Storage) para persistencia, autenticación y archivos; con Vercel para el despliegue, las funciones serverless y las tareas programadas (Vercel Cron); y, cuando la Fase 3 se implemente, con proveedores de IA a través del Vercel AI SDK.

### 2.2 Actores del sistema

El único actor humano de Cogni es el **Estudiante**: una persona universitaria, de secundaria o autodidacta que toma apuntes digitales y quiere un método de estudio que le diga qué repasar y cuándo (`docs/documento-maestro.md` §1.4). No existe un rol de docente, administrador ni ningún otro actor humano, ni en el código ni en la especificación del producto.

Además del Estudiante, Cogni se apoya en los siguientes servicios para funcionar:

| Apoyo del sistema | Descripción en lenguaje simple | Estado |
|---|---|---|
| Asistente de IA que genera material | Redacta flashcards, preguntas de examen y preguntas de recordación activa a partir del contenido de una página, y evalúa las respuestas abiertas del estudiante. | Roadmap |
| Planificador de repasos | Calcula, con el algoritmo SM-2, cuándo debe repasarse cada ítem y qué tan bien dominado está el contenido de cada página. | Roadmap |
| Servicio de identidad y almacenamiento | Autentica al estudiante (correo y Google) y guarda de forma segura sus cuadernos, páginas, imágenes y PDF importados. | Implementado |

### 2.4 Suposiciones y dependencias

- El proyecto gratuito de Supabase se pausa tras aproximadamente 7 días de inactividad; el cron diario de `vercel.json` contra `/api/keep-alive` asume que esa comprobación diaria basta para evitarlo.
- El plan Vercel Hobby asume un uso no comercial de la plataforma (`docs/documento-maestro.md` §4.2, §14).
- La importación de PDF asume que el archivo tiene una capa de texto seleccionable; Cogni no hace OCR, por lo que un PDF escaneado sin texto no puede importarse (`src/modules/ingestion/domain/import-failure.ts`, motivo `no_text_layer`).
- Cloudflare actúa como registrador y proveedor de DNS del dominio canónico; `src/proxy.ts` asume que `NEXT_PUBLIC_SITE_URL` refleja ese dominio para decidir la redirección del apex/`www`.
- La capa de IA (roadmap) asume que al menos un proveedor con nivel gratuito (Google AI Studio, Groq, Mistral, OpenRouter o Cerebras) está disponible en cada momento; la rotación multiproveedor existe para mitigar el riesgo de que uno de ellos cambie o retire su nivel gratuito (`docs/documento-maestro.md` §4.3, §14).
- El límite de una sola conexión de base de datos por instancia serverless (`postgres(..., { max: 1 })` en `src/shared/db/client.ts`) asume que Supabase sigue exponiendo el *transaction pooler* sin sentencias preparadas.

---

## 3. Casos de uso

### CU-01 — Registro e inicio de sesión (correo y Google)

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante (visitante sin sesión) |
| Precondición | El visitante no tiene una sesión activa y está en `/register` o `/login`. |
| Flujo principal | 1) El estudiante completa correo y contraseña de al menos 8 caracteres en `/register`.<br>2) El formulario invoca `signUpAction`, que valida con `credentialsSchema` y llama a `AuthGateway.signUp`.<br>3) Supabase Auth crea la cuenta y envía un correo de verificación con un enlace hacia `/auth/callback`.<br>3a) Alternativamente, el estudiante elige "Continuar con Google" (`signInWithGoogleAction`), que abre el consentimiento OAuth de Google y también resuelve en `/auth/callback` con un código PKCE.<br>4) El estudiante confirma el correo o completa el consentimiento de Google; el navegador llega a `/auth/callback?code=...`.<br>5) `src/app/auth/callback/route.ts` intercambia el código por una sesión (`exchangeCodeForSession`); si es exitoso y proviene de Google, registra el evento `user_signed_in` de forma diferida con `after()`.<br>6) `ensureProfileForUser` crea o reutiliza la fila `profiles` del estudiante mediante un upsert que nunca sobrescribe datos existentes.<br>7) `src/proxy.ts` detecta la sesión y redirige a `/` si el estudiante estaba en una ruta de autenticación. |
| Postcondición | Existe una sesión de Supabase Auth válida y una fila `profiles` para el estudiante. |
| Flujo alternativo | Código ausente o rechazado en el callback → redirección a `/login?error=google` con un mensaje neutral. Credenciales inválidas en inicio de sesión por correo → `signInAction` devuelve `AUTH_INVALID_CREDENTIALS` y el formulario muestra el mensaje correspondiente de `src/modules/identity/ui/auth-copy.ts`. |
| Estado | Implementado |

### CU-02 — Recuperar contraseña

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante |
| Precondición | El estudiante olvidó su contraseña y está en `/forgot-password`. |
| Flujo principal | 1) El estudiante ingresa su correo.<br>2) `requestPasswordResetAction` valida el correo y llama a `AuthGateway.requestPasswordReset` con `redirectTo` apuntando a `RESET_PASSWORD_PATH` (`/reset-password`).<br>3) Supabase Auth envía un correo con un enlace de recuperación.<br>4) El estudiante abre el enlace; el código PKCE se intercambia en `/auth/callback` como en CU-01.<br>5) El estudiante llega a `/reset-password` y define una nueva contraseña de al menos 8 caracteres.<br>6) `updatePasswordAction` llama a `AuthGateway.updatePassword`. |
| Postcondición | La contraseña del estudiante queda actualizada y puede iniciar sesión con ella. |
| Flujo alternativo | El proveedor de correo no está disponible → se devuelve `AUTH_PROVIDER_UNAVAILABLE` con un mensaje genérico, sin revelar si el correo existe. |
| Estado | Implementado |

### CU-03 — Crear y organizar cuadernos y páginas

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante |
| Precondición | El estudiante tiene una sesión activa. |
| Flujo principal | 1) Desde el panel lateral (`src/modules/notebooks/ui/sidebar-tree.tsx`), el estudiante crea un cuaderno con `createNotebook`, con título de hasta 120 caracteres (`TITLE_MAX_LENGTH`) y, opcionalmente, un color de la paleta fija (`COLOR_PALETTE`).<br>2) Dentro de un cuaderno, el estudiante crea una página con `createPage`; el sistema asigna el título por defecto "Sin título" (`DEFAULT_PAGE_TITLE`) y un documento vacío (`EMPTY_DOC`).<br>2a) El estudiante puede renombrar el cuaderno (`renameNotebook`) o la página (`renamePage`) en cualquier momento.<br>2b) El estudiante puede cambiar el color o ícono del cuaderno (`setNotebookAppearance`).<br>3) El estudiante archiva un cuaderno o página cuando ya no lo necesita; el sistema pide confirmación explícita antes de archivar (`src/modules/notebooks/ui/archive-confirm-dialog.tsx`), porque la acción no es reversible desde la interfaz.<br>4) Archivar un cuaderno propaga `archived_at` a sus páginas activas. |
| Postcondición | El cuaderno o página queda creado, renombrado o archivado; el panel lateral se revalida. |
| Flujo alternativo | Crear una página bajo un cuaderno ya archivado se rechaza con `NOTEBOOK_ARCHIVED`. |
| Estado | Implementado |

### CU-04 — Escribir apuntes en el editor (autoguardado, imágenes)

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante |
| Precondición | El estudiante tiene una página abierta en `/notebooks/[notebookId]/pages/[pageId]`. |
| Flujo principal | 1) El estudiante escribe con el editor Tiptap (encabezados, listas, tablas, código, callouts, imágenes, etc.).<br>2) `useAutosave` detecta el cambio y, tras un debounce de 800–1500 ms (1000 ms por defecto), llama a `saveContent` con el `contentVersion` esperado.<br>3) `savePage` ejecuta una comparación-e-intercambio atómica (`updateIfVersion`) sobre la fila `pages` y recalcula `plain_text` con `extractPlainText`.<br>3a) Si `contentVersion` coincide, la página se guarda y el estado pasa a `saved`.<br>3b) Si otro cliente ya guardó una versión más nueva (`PAGE_VERSION_CONFLICT`), el sistema recupera el contenido actual (`getCurrentContent`), conserva el borrador local descartado en `conflictDraft` y muestra el `conflict-banner` con la opción de restaurar o descartar.<br>4) El estudiante inserta una imagen desde el menú `/`; `requestImageUpload` genera una URL firmada de subida, el navegador sube el archivo directamente a Supabase Storage y `registerPageAsset` registra el objeto de forma idempotente por `storage_path` (máximo 10 MiB; solo `image/jpeg`, `image/png`, `image/webp`, `image/gif`). |
| Postcondición | El contenido de la página y su `plain_text` quedan persistidos; el número de versión avanza. |
| Flujo alternativo | Conflicto de versión (3b). Tipo de archivo o tamaño de imagen no permitido → `ASSET_MIME_NOT_ALLOWED` / `ASSET_TOO_LARGE`. |
| Estado | Implementado |

### CU-05 — Importar PDF

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante |
| Precondición | El estudiante tiene una página destino y un PDF con capa de texto de hasta 20 MiB. |
| Flujo principal | 1) El estudiante elige "Importar PDF" desde el menú del cuaderno (`src/modules/ingestion/ui/import-pdf-menu-item.tsx`).<br>2) `requestPdfUpload` genera una URL firmada de subida (bucket `page-pdfs`, vigencia 10 minutos) y el navegador sube el PDF directamente.<br>3) `startPdfImport` crea un `ImportJob` en estado `queued`.<br>4) `processPdfImport` (acción de servidor con `maxDuration = 120`) reclama el job (`queued → processing`), descarga el archivo, valida el número mágico `%PDF-` y el tamaño, extrae el texto página por página (`unpdf`) y lo convierte a bloques Tiptap (`textToBlocks`).<br>4a) Si alguna validación falla (descarga, PDF inválido, sin capa de texto, tiempo agotado), el job pasa a `failed` con un mensaje específico en español.<br>4b) Si la conversión es exitosa, `writeImportedContent` escribe el contenido en la página destino (comparación-e-intercambio con `expectedVersion=1`) y el job pasa a `done`.<br>5) El panel lateral muestra una insignia de importación en curso (`src/modules/ingestion/ui/importing-page-badge.tsx`) mientras el job está activo. |
| Postcondición | La página destino contiene el texto del PDF convertido a bloques, o el `ImportJob` queda en `failed` con un mensaje accionable. |
| Flujo alternativo | La página destino cambió o fue archivada durante la importación → falla con el mensaje de `persistence` o `PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE`. |
| Estado | Implementado |

### CU-06 — Generar flashcards (roadmap)

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante |
| Precondición | El estudiante tiene una página con contenido y solicita generar tarjetas. |
| Flujo principal | 1) El estudiante solicita "Generar flashcards" para una página.<br>2) La capa de IA invoca al proveedor activo con el propósito `generate_flashcards` y valida la salida contra el esquema `{cards:[{front,back}]}`.<br>2a) Si el proveedor falla el esquema, se reintenta una vez con otro proveedor de la rotación.<br>2b) Si todos los proveedores fallan, la generación se marca `failed` con un mensaje claro; no se inventa contenido.<br>3) El módulo `flashcards` guarda las tarjetas generadas, asociadas a la página.<br>4) `study-engine` registra un ítem SM-2 por cada tarjeta nueva. |
| Postcondición | La página tiene un mazo de flashcards, asociado uno a uno con esa página, listo para repasar. |
| Flujo alternativo | El estudiante edita o agrega tarjetas manualmente en lugar de generarlas por IA. |
| Estado | Roadmap — vista previa visual con datos de muestra integrada en `main` (oculta en producción); en este código base los módulos `ai`, `flashcards` y `study-engine` son esqueletos vacíos (`docs/documento-maestro.md` §3.1, §3.3, §3.7, §8.4). |

### CU-07 — Repasar flashcards con SM-2 (roadmap)

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante |
| Precondición | La página tiene un mazo de flashcards con al menos un ítem vencido. |
| Flujo principal | 1) El estudiante abre la sesión de repaso de la página.<br>2) Por cada tarjeta, ve el anverso, intenta recordar la respuesta y revela el reverso.<br>3) El estudiante califica su recuerdo con uno de cuatro botones: Otra vez (q=1), Difícil (q=3), Bien (q=4), Fácil (q=5).<br>4) `study-engine` aplica SM-2 al estado del ítem (intervalo, factor de facilidad, próxima fecha de vencimiento) y recalcula el nivel de dominio de la página.<br>5) Al terminar la sesión, la capa de IA produce una retroalimentación conjunta. |
| Postcondición | Cada ítem repasado tiene un nuevo estado SM-2 y fecha de vencimiento; el nivel de dominio de la página se actualiza. |
| Flujo alternativo | No hay tarjetas vencidas → el sistema informa y no abre la sesión. |
| Estado | Roadmap — especificación en `docs/documento-maestro.md` §7.1–§7.2; `study-engine` y `flashcards` son esqueletos vacíos en este código base. |

### CU-08 — Presentar examen y repetirlo (roadmap)

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante |
| Precondición | La página tiene preguntas de examen generadas o creadas manualmente. |
| Flujo principal | 1) El estudiante inicia una sesión de examen de opción múltiple (4 alternativas, 10 preguntas por defecto).<br>2) Responde cada pregunta; la corrección es determinista (correcta → q=4, incorrecta → q=1).<br>3) Al finalizar, se calcula la puntuación = correctas / total.<br>3a) Si la puntuación es igual o mayor al 70 %, el estado de repetición se limpia.<br>3b) Si es menor al 70 %, la sesión queda marcada para repetirse junto con las preguntas falladas, y el sistema pide confirmación antes de aceptar el resultado.<br>4) Para repetir, la IA genera una variante distinta de cada pregunta fallada sobre el mismo concepto raíz; la pregunta original queda retirada.<br>5) El estudiante repite el examen solo sobre las preguntas falladas (hasta 5 si hay menos). |
| Postcondición | El ítem de estudio de cada pregunta raíz recibe una nueva revisión SM-2; el estado de repetición de la página refleja el resultado más reciente. |
| Flujo alternativo | La generación de variantes falla en todos los proveedores de IA → el sistema bloquea la repetición con un mensaje claro. |
| Estado | Roadmap — vista previa visual integrada en `main` (oculta en producción); `exams` y `study-engine` son esqueletos vacíos en este código base (`docs/documento-maestro.md` §3.3, §7.5). |

### CU-09 — Sesión de recordación activa (roadmap)

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante |
| Precondición | La página tiene preguntas abiertas generadas. |
| Flujo principal | 1) El estudiante responde una pregunta abierta en texto libre.<br>2) Se autoevalúa en una escala 0–5 inmediatamente después de responder.<br>3) La IA evalúa la respuesta de forma asíncrona contra una rúbrica, devolviendo un puntaje, conceptos presentes/ausentes y una justificación.<br>4) La calidad combinada se calcula como `combined = round(0.6·puntaje_IA + 0.4·autoevaluación)`; se registran las tres señales (cruda, autoevaluación, combinada).<br>4a) Si la autoevaluación es ≥4 y el puntaje de IA es ≤2, se marca exceso de confianza.<br>4b) Si la autoevaluación es ≤1 y el puntaje de IA es ≥4, se marca falta de confianza.<br>5) La retroalimentación individual solo se muestra al final de la sesión, no pregunta por pregunta. |
| Postcondición | Cada pregunta tiene un ítem de estudio con su calidad combinada registrada, que alimenta SM-2. |
| Flujo alternativo | Un proveedor de IA falla a mitad de sesión → las respuestas ya guardadas se evalúan de forma asíncrona con reintento en otro proveedor, sin perder el progreso del estudiante. |
| Estado | Roadmap — especificación en `docs/documento-maestro.md` §7.4–§8.5; `active-recall`, `ai` y `study-engine` son esqueletos vacíos en este código base. |

### CU-10 — Consultar "Hoy" / calendario (roadmap)

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante |
| Precondición | El estudiante tiene al menos un ítem de estudio con fecha de vencimiento asignada. |
| Flujo principal | 1) El estudiante abre la vista "Hoy".<br>2) El sistema lista las páginas con ítems vencidos, ordenadas por la fecha de vencimiento más próxima.<br>3) El estudiante accede directamente a la sesión de repaso de una página desde esa vista.<br>3a) Alternativamente, el estudiante abre la vista de calendario mensual o semanal y ve los repasos agrupados por página. |
| Postcondición | Ninguna (vista de solo lectura). |
| Flujo alternativo | No hay ítems vencidos hoy → el sistema lo indica sin listar páginas. |
| Estado | Roadmap — `scheduling` y `study-engine` son esqueletos vacíos en este código base (`docs/documento-maestro.md` §3.5). |

### CU-11 — Consultar dashboard (roadmap)

| Campo | Detalle |
|---|---|
| Actor principal | Estudiante |
| Precondición | El estudiante tiene al menos un cuaderno con contenido. |
| Flujo principal | 1) El estudiante abre el dashboard.<br>2) El sistema muestra el progreso por cuaderno y por página (nivel de dominio, tendencia, ítems totales y vencidos).<br>3) El sistema muestra métricas por técnica (tasa de acierto, racha, repasos completados) y una tabla de calibración metacognitiva (autoevaluación frente a resultado real). |
| Postcondición | Ninguna (vista de solo lectura). |
| Flujo alternativo | Sin datos suficientes, el sistema muestra un estado vacío orientador en lugar de gráficos sin datos. |
| Estado | Roadmap — existe una vista previa visual (v2) con datos de muestra integrada en `main` y oculta en producción; `analytics` y `study-engine` son esqueletos vacíos en este código base (`docs/documento-maestro.md` §3.6). |

---

## 4. Requisitos funcionales

Prioridad: **Alta** (el producto queda incompleto sin él), **Media** (mejora relevante), **Baja** (deseable).

### 4.1 `identity` (ID)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-ID-01 | El sistema debe permitir registrar una cuenta con correo y una contraseña de al menos 8 caracteres (`PASSWORD_MIN_LENGTH`, `src/modules/identity/application/credentials-schema.ts`). | Alta | Implementado |
| RF-ID-02 | El sistema debe permitir iniciar sesión con correo y contraseña, o con Google OAuth. | Alta | Implementado |
| RF-ID-03 | El sistema debe bloquear el inicio de sesión por correo mientras la cuenta no haya verificado su correo electrónico (`AUTH_ERROR.EMAIL_NOT_VERIFIED`). | Alta | Implementado |
| RF-ID-04 | El sistema debe permitir recuperar la contraseña mediante un enlace enviado al correo registrado. | Alta | Implementado |
| RF-ID-05 | El sistema debe crear automáticamente el perfil (`profiles`) de un estudiante autenticado sin sobrescribir sus datos personalizados en accesos posteriores (`ensureProfileResilient`, `onConflictDoNothing`). | Alta | Implementado |
| RF-ID-06 | El sistema debe rechazar cualquier redirección posterior al inicio de sesión que no sea una ruta relativa del propio sitio (`safeNext`, protección contra *open redirect*). | Alta | Implementado |
| RF-ID-07 | El sistema debe permitir cerrar la sesión del estudiante mediante una acción explícita (`signOutAction`). | Media | Implementado |

### 4.2 `notebooks` (NB)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-NB-01 | El sistema debe permitir crear un cuaderno con título de hasta 120 caracteres (`TITLE_MAX_LENGTH`) y, opcionalmente, un color de una paleta fija de 7 valores (`COLOR_PALETTE`). | Alta | Implementado |
| RF-NB-02 | El sistema debe rechazar la creación de una página bajo un cuaderno archivado (`NOTEBOOK_ARCHIVED`). | Alta | Implementado |
| RF-NB-03 | El sistema debe archivar cuadernos y páginas de forma lógica (`archived_at`) en vez de eliminarlos físicamente, propagando el archivado del cuaderno a sus páginas activas. | Alta | Implementado |
| RF-NB-04 | El sistema debe pedir confirmación explícita antes de archivar un cuaderno o una página, dado que la acción no es reversible desde la interfaz. | Media | Implementado |
| RF-NB-05 | El sistema debe guardar el contenido de una página mediante una comparación-e-intercambio atómica sobre `content_version`, rechazando un guardado basado en una versión desactualizada (`PAGE_VERSION_CONFLICT`). | Alta | Implementado |
| RF-NB-06 | El sistema debe materializar `plain_text` a partir del documento Tiptap en cada guardado de página, descartando cualquier `plain_text` enviado por el cliente. | Alta | Implementado |
| RF-NB-07 | El sistema debe aceptar únicamente imágenes `image/jpeg`, `image/png`, `image/webp` o `image/gif` de hasta 10 MiB en una página (`ALLOWED_MIME`, `MAX_ASSET_BYTES`). | Alta | Implementado |
| RF-NB-08 | El sistema debe registrar cada imagen subida de forma idempotente sobre su `storage_path`, validando la ruta canónica `<ownerId>/<pageId>/<assetId>.<ext>`, y debe emitir URLs de lectura firmadas con una vigencia de una hora (`READ_URL_TTL_SECONDS`). | Alta | Implementado |

### 4.3 `editor` (ED)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-ED-01 | El sistema debe autoguardar el contenido del editor con un retardo (debounce) de entre 800 y 1500 ms tras la última edición. | Alta | Implementado |
| RF-ED-02 | El sistema debe ofrecer un menú `/` para insertar bloques (encabezados, listas, tablas, código con resaltado, callouts, imágenes, citas, divisores) sin salir del teclado. | Alta | Implementado |
| RF-ED-03 | El sistema debe mostrar una barra de herramientas contextual al seleccionar texto, con negrita, cursiva, subrayado, tachado, código en línea, enlaces y resaltado con paleta propia. | Media | Implementado |
| RF-ED-04 | El sistema debe ofrecer un manejador de arrastre para reordenar los bloques del documento. | Media | Implementado |
| RF-ED-05 | El sistema debe, ante un conflicto de guardado, mostrar el contenido actual del servidor y permitir al estudiante restaurar o descartar su borrador local. | Alta | Implementado |
| RF-ED-06 | El sistema debe mostrar de forma visible el estado del autoguardado (inactivo, pendiente, guardando, guardado, error, conflicto) mientras el estudiante escribe. | Media | Implementado |
| RF-ED-07 | El sistema debe permitir insertar imágenes en el editor mediante subida directa a Supabase Storage con progreso visible. | Alta | Implementado |

### 4.4 `ingestion` (IN)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-IN-01 | El sistema debe aceptar únicamente archivos PDF de hasta 20 MiB para importación (`PDF_MIME`, `MAX_PDF_BYTES`). | Alta | Implementado |
| RF-IN-02 | El sistema debe generar una URL de subida firmada con una vigencia de 10 minutos para cada importación (`UPLOAD_GRANT_TTL_MS`). | Alta | Implementado |
| RF-IN-03 | El sistema debe rastrear cada importación como un `ImportJob` con los estados `queued`, `processing`, `done` y `failed`, sin permitir transiciones inválidas (`IMPORT_JOB_ERROR.INVALID_TRANSITION`). | Alta | Implementado |
| RF-IN-04 | El sistema debe procesar la importación dentro de un presupuesto de tiempo acotado de 120 segundos (`MAX_DURATION_S`), marcando el job como `failed` por tiempo agotado si se excede. | Alta | Implementado |
| RF-IN-05 | El sistema debe rechazar los PDF sin capa de texto seleccionable con un mensaje explícito, sin intentar reconocimiento óptico de caracteres (`no_text_layer`). | Alta | Implementado |
| RF-IN-06 | El sistema debe convertir el texto extraído en bloques Tiptap (encabezados, listas, párrafos) mediante heurísticas deterministas (`textToBlocks`). | Alta | Implementado |
| RF-IN-07 | El sistema debe mostrar en el panel lateral una insignia de importación en curso por cada página con un `ImportJob` activo. | Media | Implementado |
| RF-IN-08 | El sistema debe informar, con un mensaje específico en español, la causa de una importación fallida (descarga, PDF inválido, sin texto, conflicto de persistencia o tiempo agotado). | Alta | Implementado |

### 4.5 `ai` (AI)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-AI-01 | El sistema debe generar todo resultado de IA como una salida estructurada validada contra un esquema, nunca como texto libre (`docs/documento-maestro.md` §3.7, §8.1). | Alta | Roadmap |
| RF-AI-02 | El sistema debe reintentar con un proveedor distinto de la rotación cuando la salida de un proveedor de IA no cumple el esquema esperado, y marcar la generación como fallida si todos los proveedores fallan (`docs/documento-maestro.md` §8.1). | Alta | Roadmap |
| RF-AI-03 | El sistema debe limitar el número de generaciones y evaluaciones de IA por estudiante por día (20 generaciones, 60 evaluaciones, `docs/documento-maestro.md` §8.3). | Media | Roadmap |
| RF-AI-04 | El sistema debe versionar los prompts de cada propósito de IA en el código fuente (`docs/documento-maestro.md` §8.1). | Media | Roadmap |
| RF-AI-05 | El sistema debe marcar un proveedor de IA como no saludable durante 10 minutos tras 3 fallos consecutivos (`docs/documento-maestro.md` §8.2). | Media | Roadmap |

### 4.6 `study-engine` (SE)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-SE-01 | El sistema debe aplicar el algoritmo SM-2 a cada ítem de estudio calificado, actualizando su intervalo, factor de facilidad y fecha de vencimiento (`docs/documento-maestro.md` §7.1). | Alta | Roadmap |
| RF-SE-02 | El sistema debe derivar un nivel de dominio por página (Nuevo, Aprendiendo, Consolidando, Dominado) a partir del estado SM-2 de sus ítems (`docs/documento-maestro.md` §7.3). | Alta | Roadmap |
| RF-SE-03 | El sistema debe ser el único módulo que calcula fechas de repaso; ningún otro módulo debe calcular vencimientos fuera del motor (`docs/documento-maestro.md` §3.4). | Alta | Roadmap |
| RF-SE-04 | El sistema debe exponer sus resultados a `scheduling` y `analytics` solo a través de sus puertos públicos, sin que estos conozcan la técnica de origen del ítem (`docs/documento-maestro.md` §5.2; regla `study-engine-knows-no-technique` de `.dependency-cruiser.cjs`). | Alta | Roadmap |

### 4.7 `flashcards` (FC)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-FC-01 | El sistema debe asociar cada mazo de flashcards a exactamente una página, generado a partir de su contenido (`docs/documento-maestro.md` §3.1, §3.3). | Alta | Vista previa integrada (oculta en producción) |
| RF-FC-02 | El sistema debe permitir generar tarjetas anverso/reverso con IA o crearlas manualmente (`docs/documento-maestro.md` §3.3). | Alta | Vista previa integrada (oculta en producción) |
| RF-FC-03 | El sistema debe calificar cada tarjeta repasada con una escala de 4 botones mapeada a la calidad SM-2 (Otra vez=1, Difícil=3, Bien=4, Fácil=5) (`docs/documento-maestro.md` §7.2). | Alta | Vista previa integrada (oculta en producción) |
| RF-FC-04 | El sistema debe mostrar una retroalimentación generada por IA al finalizar la sesión de repaso, no pregunta por pregunta (`docs/documento-maestro.md` §3.3). | Media | Vista previa integrada (oculta en producción) |
| RF-FC-05 | El sistema debe mantener el conteo de tarjetas de un mazo derivado de las tarjetas realmente existentes en el dominio, sin un contador independiente (`docs/documento-maestro.md` §3.1). | Media | Vista previa integrada (oculta en producción) |

### 4.8 `exams` (EX)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-EX-01 | El sistema debe generar o permitir crear manualmente preguntas de opción múltiple con 4 alternativas y un concepto asociado por pregunta (`docs/documento-maestro.md` §3.3, §7.5). | Alta | Vista previa integrada (oculta en producción) |
| RF-EX-02 | El sistema debe presentar exámenes de 10 preguntas por defecto (`docs/documento-maestro.md` §3.3). | Media | Vista previa integrada (oculta en producción) |
| RF-EX-03 | El sistema debe corregir cada examen de forma determinista, mapeando cada respuesta correcta a calidad q=4 y cada incorrecta a q=1 (`docs/documento-maestro.md` §3.3, §7.5). | Alta | Vista previa integrada (oculta en producción) |
| RF-EX-04 | El sistema debe marcar un examen para repetición cuando la puntuación sea menor al 70 %, y limpiar ese estado cuando sea igual o mayor (`docs/documento-maestro.md` §7.5). | Alta | Vista previa integrada (oculta en producción) |
| RF-EX-05 | El sistema debe generar, para la repetición, una variante distinta de cada pregunta fallada sobre el mismo concepto raíz, sin repetir la redacción original (`docs/documento-maestro.md` §7.5). | Alta | Vista previa integrada (oculta en producción) |
| RF-EX-06 | El sistema debe bloquear la repetición del examen con un mensaje claro si la generación de variantes falla en todos los proveedores de IA (`docs/documento-maestro.md` §7.5). | Media | Vista previa integrada (oculta en producción) |
| RF-EX-07 | El sistema debe pedir confirmación explícita antes de aceptar el envío final de un examen. | Media | Vista previa integrada (oculta en producción) |

### 4.9 `active-recall` (AR)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-AR-01 | El sistema debe generar preguntas abiertas de recordación activa con una rúbrica de evaluación por pregunta (`docs/documento-maestro.md` §3.3, §8.4). | Alta | Vista previa integrada (oculta en producción) |
| RF-AR-02 | El sistema debe solicitar al estudiante una autoevaluación de 0 a 5 inmediatamente después de responder cada pregunta (`docs/documento-maestro.md` §3.3, §7.4). | Alta | Vista previa integrada (oculta en producción) |
| RF-AR-03 | El sistema debe evaluar cada respuesta abierta de forma asíncrona contra la rúbrica mediante IA, devolviendo un puntaje y una justificación en un formato validado (`docs/documento-maestro.md` §3.7, §8.4). | Alta | Vista previa integrada (oculta en producción) |
| RF-AR-04 | El sistema debe calcular la calidad combinada como `combined = round(0.6·puntaje_IA + 0.4·autoevaluación)` y registrar las tres señales (cruda, autoevaluación, combinada) (`docs/documento-maestro.md` §7.4). | Alta | Vista previa integrada (oculta en producción) |
| RF-AR-05 | El sistema debe señalar exceso de confianza cuando la autoevaluación sea ≥4 y el puntaje de IA sea ≤2, y falta de confianza en el caso inverso (`docs/documento-maestro.md` §7.4). | Media | Vista previa integrada (oculta en producción) |
| RF-AR-06 | El sistema debe mostrar la retroalimentación individual únicamente al final de la sesión, no después de cada pregunta (`docs/documento-maestro.md` §3.3). | Media | Vista previa integrada (oculta en producción) |

### 4.10 `scheduling` (SC)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-SC-01 | El sistema debe mostrar una vista "Hoy" con las páginas que tienen ítems vencidos, ordenadas por la fecha de vencimiento más próxima (`docs/documento-maestro.md` §3.5, §7.3). | Alta | Roadmap |
| RF-SC-02 | El sistema debe ofrecer una vista de calendario mensual y semanal con los repasos agrupados por página (`docs/documento-maestro.md` §3.5). | Media | Roadmap |
| RF-SC-03 | El sistema no debe permitir crear eventos de calendario manuales; el calendario refleja únicamente los vencimientos calculados por `study-engine` (`docs/documento-maestro.md` §3.5). | Media | Roadmap |
| RF-SC-04 | El sistema debe permitir acceder directamente a la sesión de repaso de una página desde la vista "Hoy" (`docs/documento-maestro.md` §3.5). | Media | Roadmap |

### 4.11 `analytics` (AN)

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-AN-01 | El sistema debe mostrar el progreso por cuaderno y por página, incluyendo nivel de dominio, tendencia y conteo de ítems totales y vencidos (`docs/documento-maestro.md` §3.6). | Alta | Vista previa integrada (oculta en producción) |
| RF-AN-02 | El sistema debe mostrar métricas por técnica de estudio: tasa de acierto, racha y repasos completados (`docs/documento-maestro.md` §3.6). | Media | Vista previa integrada (oculta en producción) |
| RF-AN-03 | El sistema debe mostrar una tabla de calibración metacognitiva que compare la autoevaluación del estudiante contra el resultado real de la evaluación de IA (`docs/documento-maestro.md` §3.6, §7.4). | Media | Vista previa integrada (oculta en producción) |
| RF-AN-04 | El sistema debe presentar los gráficos del dashboard mediante componentes de gráficos de shadcn/ui (`docs/documento-maestro.md` §3.6, §4.1). | Baja | Vista previa integrada (oculta en producción) |
| RF-AN-05 | El sistema debe limitar sus lecturas a los datos ya calculados por `study-engine` y las técnicas, sin realizar cálculos propios de vencimiento o dominio (`docs/documento-maestro.md` §5.2). | Alta | Vista previa integrada (oculta en producción) |

---

## 5. Requisitos no funcionales

Agrupados por característica de calidad de ISO/IEC 25010. Solo se incluyen requisitos verificables contra el código, con la evidencia exacta que los sustenta.

### 5.1 Seguridad (RNF-S)

| ID | Requisito | Métrica o criterio | Verificación |
|---|---|---|---|
| RNF-S-01 | El sistema debe filtrar todo acceso a datos por el propietario de la sesión (`ownerId`), sin permitir acceso entre estudiantes. | Cada caso de uso de `notebooks`/`ingestion` recibe y filtra por `ownerId`. | `src/modules/notebooks/application/save-page.ts`, `src/modules/notebooks/application/get-page.ts`, `src/modules/ingestion/domain/notebook-pages-port.ts` |
| RNF-S-02 | El sistema debe mantener Row Level Security activa en las tablas de negocio. | `.enableRLS()` en las 5 tablas del esquema. | `src/shared/db/schema.ts`, `drizzle/0001_profiles_rls.sql`, `drizzle/0003_notebooks_pages_assets.sql`, `drizzle/0005_import_jobs.sql` |
| RNF-S-03 | El sistema debe restringir el acceso a los objetos de Storage mediante políticas RLS por `owner_id`. | Políticas `read own` / `write own` sobre `storage.objects` para `page-assets`; `read own` / `write own` / `delete own` para `page-pdfs`. | `drizzle/0004_page_assets_storage.sql`, `drizzle/0006_page_pdfs_storage.sql` |
| RNF-S-04 | El sistema debe redirigir a `/login` cualquier solicitud sin sesión activa, salvo las rutas de autenticación y las que se autentican por su cuenta. | Regla aplicada a todo el `matcher` salvo `/api`, `/monitoring`, `_next` y archivos estáticos. | `src/proxy.ts` |
| RNF-S-05 | El sistema debe emitir una Content-Security-Policy con un nonce único por petición cuando esté disponible, evitando `'unsafe-inline'` en `script-src`. | Nonce generado por petición (`crypto.randomUUID()`), propagado vía `x-nonce`. | `src/proxy.ts`, `src/shared/config/security-headers.ts`, `tests/proxy/nonce.test.ts` |
| RNF-S-06 | El sistema debe autenticar el endpoint de cron con una comparación de tiempo constante sobre un secreto de al menos 32 caracteres. | `timingSafeEqual` sobre `CRON_SECRET` (`z.string().min(32)`). | `src/app/api/keep-alive/route.ts`, `src/shared/config/env.schema.ts` |
| RNF-S-07 | El sistema debe validar toda variable de entorno con un esquema al arrancar, separando el esquema de cliente del de servidor, e impedir que el de servidor se importe desde un componente cliente. | `parseServerEnv`/`parseClientEnv` con `safeParse`; `env.server.ts` importa `"server-only"`. | `src/shared/config/env.schema.ts`, `src/shared/config/env.server.ts` |
| RNF-S-08 | El sistema debe auditar sus dependencias en cada integración continua y bloquear la construcción ante una vulnerabilidad de severidad alta o mayor. | `pnpm audit --audit-level=high` en cada PR y en `main`. | `.github/workflows/pr.yml`, `.github/workflows/main.yml` |

### 5.2 Mantenibilidad (RNF-M)

| ID | Requisito | Métrica o criterio | Verificación |
|---|---|---|---|
| RNF-M-01 | El sistema debe compilar con TypeScript en modo estricto en todo el código fuente. | `"strict": true`. | `tsconfig.json` |
| RNF-M-02 | El sistema debe verificar en integración continua que ningún módulo de dominio dependa de infraestructura, de frameworks externos (salvo Zod) ni de otro módulo fuera de su índice público. | 8 reglas con `severity: "error"` en `dependency-cruiser`, ejecutadas en cada PR y en `main`. | `.dependency-cruiser.cjs`, `.github/workflows/pr.yml`, `.github/workflows/main.yml` |
| RNF-M-03 | El sistema debe mantener un script de reversión manual (`.down.sql`) para las migraciones que alteran datos o políticas de forma no trivial. | 5 de 7 migraciones tienen un `.down.sql` emparejado (la creación inicial y la activación de RLS no lo requieren). | `drizzle/0002_profiles_auth_fk.down.sql`, `drizzle/0003_notebooks_pages_assets.down.sql`, `drizzle/0004_page_assets_storage.down.sql`, `drizzle/0005_import_jobs.down.sql`, `drizzle/0006_page_pdfs_storage.down.sql` |
| RNF-M-04 | El sistema debe ejecutar linter, formateo y organización de imports mediante una única herramienta configurada. | `biome ci` en integración continua. | `biome.json`, `.github/workflows/pr.yml` |
| RNF-M-05 | El sistema debe mantener una suite de pruebas unitarias y de integración (Vitest) y una suite de pruebas de extremo a extremo (Playwright) ejecutadas en integración continua. | 134 archivos `*.test.ts(x)` bajo `src`; 8 especificaciones de Playwright bajo `tests/e2e`. | `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/main.yml` |
| RNF-M-06 | El sistema debe aplicar las migraciones de base de datos exclusivamente durante la construcción de producción en Vercel, nunca en previsualizaciones. | `shouldRunMigrations` devuelve verdadero solo si `VERCEL_ENV` es `"production"` o `RUN_DB_MIGRATIONS` es `"1"`. | `scripts/migrate-in-build.mjs`, `package.json` |

### 5.3 Usabilidad (RNF-U)

| ID | Requisito | Métrica o criterio | Verificación |
|---|---|---|---|
| RNF-U-01 | El sistema debe pedir confirmación explícita antes de ejecutar una acción de archivado, dado que no es reversible desde la interfaz. | Diálogo de confirmación antes de archivar cuaderno o página. | `src/modules/notebooks/ui/archive-confirm-dialog.tsx` |
| RNF-U-02 | El sistema debe presentar toda la interfaz en español, con tratamiento de "tú". | `<html lang="es">`; copys en español en los módulos con interfaz. | `src/app/layout.tsx`, `src/modules/identity/ui/auth-copy.ts`, `src/modules/notebooks/ui/notebooks-copy.ts`, `src/modules/ingestion/ui/ingestion-copy.ts` |
| RNF-U-03 | El sistema debe informar de forma visible el progreso de una importación de PDF mientras el `ImportJob` esté activo. | Insignia de importación en curso más componente de progreso. | `src/modules/ingestion/ui/importing-page-badge.tsx`, `src/modules/ingestion/ui/import-progress.tsx` |
| RNF-U-04 | El sistema debe mantener visible el estado del autoguardado del editor mientras el estudiante escribe. | Estados `idle`/`pending`/`saving`/`saved`/`error`/`conflict`. | `src/modules/editor/domain/autosave-state.ts`, `src/modules/editor/ui/save-status.tsx` |

### 5.4 Fiabilidad (RNF-F)

| ID | Requisito | Métrica o criterio | Verificación |
|---|---|---|---|
| RNF-F-01 | El sistema debe mantener activo el proyecto gratuito de Supabase mediante una comprobación diaria programada, evitando su pausa por inactividad. | Cron diario `0 6 * * *` contra `/api/keep-alive`. | `vercel.json`, `src/app/api/keep-alive/route.ts` |
| RNF-F-02 | El sistema debe degradar sin fallar cuando una consulta secundaria no crítica falla. | `getActiveImports()` degrada a una lista vacía en caso de fallo. | `src/app/(app)/layout.tsx` |
| RNF-F-03 | El sistema no debe perder la respuesta al estudiante cuando el registro de un evento de analítica falla. | `createServerAnalytics` captura y descarta el fallo de PostHog sin propagar la excepción. | `src/shared/observability/analytics.ts` |
| RNF-F-04 | El sistema debe reportar al servicio de monitoreo cualquier excepción no controlada de un Server Component, Server Action o Route Handler. | `onRequestError = Sentry.captureRequestError`. | `src/instrumentation.ts` |

### 5.5 Eficiencia de desempeño (RNF-P)

| ID | Requisito | Métrica o criterio | Verificación |
|---|---|---|---|
| RNF-P-01 | El sistema debe procesar una importación de PDF dentro de un presupuesto máximo de 120 segundos por invocación de función serverless. | `maxDuration = 120` (`MAX_DURATION_S`). | `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`, `src/app/(app)/notebooks/[notebookId]/pages/[pageId]/max-duration.test.ts`, `src/modules/ingestion/domain/import-budget.ts` |
| RNF-P-02 | El sistema debe limitar el tamaño máximo de un PDF importado a 20 MiB. | `MAX_PDF_BYTES = 20 971 520`. | `src/modules/ingestion/domain/pdf-file.ts`, `drizzle/0006_page_pdfs_storage.sql` |
| RNF-P-03 | El sistema debe limitar el tamaño máximo de una imagen subida a una página a 10 MiB. | `MAX_ASSET_BYTES = 10 485 760`. | `src/modules/notebooks/domain/page-asset.ts`, `drizzle/0004_page_assets_storage.sql` |
| RNF-P-04 | El sistema debe autoguardar el contenido del editor con un retardo (debounce) de entre 800 y 1500 ms tras la última edición. | `debounceMs = 1000` por defecto. | `src/modules/editor/application/use-autosave.ts`, `openspec/specs/editor/spec.md` |
| RNF-P-05 | El sistema debe usar como máximo una conexión de base de datos por instancia de función serverless. | `postgres(url, { prepare: false, max: 1 })`. | `src/shared/db/client.ts` |

---

## 6. Matriz de trazabilidad

| Caso de uso | RF | RNF |
|---|---|---|
| CU-01 | RF-ID-01, RF-ID-02, RF-ID-03, RF-ID-04, RF-ID-06 | RNF-S-04, RNF-S-07, RNF-U-02 |
| CU-02 | RF-ID-04 | RNF-S-07 |
| CU-03 | RF-NB-01, RF-NB-02, RF-NB-03, RF-NB-04 | RNF-U-01, RNF-M-03, RNF-S-01 |
| CU-04 | RF-NB-05, RF-NB-06, RF-NB-07, RF-NB-08, RF-ED-01, RF-ED-02, RF-ED-03, RF-ED-04, RF-ED-05, RF-ED-06, RF-ED-07 | RNF-P-03, RNF-P-04, RNF-U-04, RNF-S-01 |
| CU-05 | RF-IN-01, RF-IN-02, RF-IN-03, RF-IN-04, RF-IN-05, RF-IN-06, RF-IN-07, RF-IN-08 | RNF-P-01, RNF-P-02, RNF-U-03, RNF-S-03 |
| CU-06 | RF-AI-01, RF-AI-02, RF-AI-04, RF-FC-01, RF-FC-02, RF-FC-05 | N/A — sin RNF verificable en el código actual |
| CU-07 | RF-SE-01, RF-SE-02, RF-SE-03, RF-FC-03 | N/A — sin RNF verificable en el código actual |
| CU-08 | RF-EX-01, RF-EX-02, RF-EX-03, RF-EX-04, RF-EX-05, RF-EX-06, RF-EX-07 | N/A — sin RNF verificable en el código actual |
| CU-09 | RF-AR-01, RF-AR-02, RF-AR-03, RF-AR-04, RF-AR-05, RF-AR-06 | N/A — sin RNF verificable en el código actual |
| CU-10 | RF-SC-01, RF-SC-02, RF-SC-03, RF-SC-04 | N/A — sin RNF verificable en el código actual |
| CU-11 | RF-AN-01, RF-AN-02, RF-AN-03, RF-AN-04, RF-AN-05 | N/A — sin RNF verificable en el código actual |
