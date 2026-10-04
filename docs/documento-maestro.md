# Cogni — Documento Maestro de Producto, Arquitectura y Stack

| Campo | Valor |
|---|---|
| Versión del documento | 1.2.0 |
| Fecha | 2026-09-14 (actualizado 2026-10-04) |
| Cambios de la versión 1.2.0 | ADR 0004: capa de IA con cuatro proveedores gratuitos (Mistral y Cerebras descartados), límite de 6 generaciones por usuario por día y tope de página con truncado. Actualizadas §4.2, §4.3, §8.1, §8.2, §8.3, §8.4, §8.5 y §13 (Fase 3 implementada). |
| Cambios de la versión 1.1.0 | ADR 0003: Vercel Fluid Compute y Vercel Cron reemplazan a Trigger.dev. Fase 2 (importación de PDF) implementada y fuera de "Próximamente". La métrica por técnica "tiempo de estudio" se reemplaza por "repasos completados". |
| Estado | Aprobado. Fuente de verdad para todas las fases. |
| Autor | Javier Sarez |
| Metodología de construcción | Fases 0 y 1: Spec-Driven Development (SDD) con gentle-ai. Desde 2026-09-22: Organic Driven Development (ODD); SDD sigue disponible si se elige explícitamente. Ver §15. |

Este documento fija **qué** se construye, **con qué** se construye, **cómo** se organiza y **en qué orden**. Toda decisión aquí registrada se considera cerrada. Cambiarla requiere un ADR nuevo en `docs/adr/` que la reemplace explícitamente.

---

## 1. Visión y alcance

### 1.1 Qué es Cogni

Cogni es una plataforma web para estudiar a partir de apuntes propios. El estudiante escribe o importa su contenido en un editor de bloques tipo Notion, y la plataforma genera y programa, a partir de ese contenido, tres técnicas de estudio con respaldo científico:

1. **Flashcards** con repetición espaciada (algoritmo SM-2).
2. **Exámenes** de opción múltiple.
3. **Recordación activa** (Active Recall) con preguntas abiertas evaluadas por IA.

La **repetición espaciada** es transversal: un único motor decide cuándo debe repasarse cada ítem de cada técnica, calcula el nivel de dominio de cada página y alimenta el calendario y el dashboard.

### 1.2 Qué NO es Cogni (fuera de alcance)

- No es una herramienta colaborativa. Cada cuaderno pertenece a un solo usuario.
- No es una aplicación móvil nativa ni una PWA. Es web responsiva.
- No sincroniza con Google Calendar ni con calendarios externos.
- No tiene búsqueda global de contenido.
- No tiene logros, insignias ni gamificación.
- No hace OCR. Los PDF escaneados sin capa de texto no se importan.
- No expone una API pública.
- No cobra a los usuarios en esta etapa.

Estos puntos pueden reabrirse después de la Fase 8 mediante ADR.

### 1.3 Definición de "producto rápido por fases"

No se construye un MVP recortado. Se construye el producto completo en **fases pequeñas, cada una desplegada en producción y usable**. Cada fase deja la plataforma en un estado mejor que el anterior y nunca deja funcionalidad a medias visible al usuario.

### 1.4 Usuario objetivo

Estudiantes (universitarios, de secundaria, autodidactas) que toman apuntes digitales y quieren un método de estudio que les diga qué repasar y cuándo. Idioma de la interfaz: español, tratamiento de "tú".

---

## 2. Fundamentos de ciencia cognitiva

El diseño del producto no es arbitrario. Cada técnica y cada regla del motor se apoya en evidencia. Esta sección es la justificación; la Fase 3 y la Fase 4 deben ejecutar `sdd-research` para dejar las fuentes verificadas en el repositorio.

| Principio | Evidencia | Cómo lo aplica Cogni |
|---|---|---|
| Práctica de recuperación (testing effect) | Roediger y Karpicke (2006); Dunlosky et al. (2013) la califican de "alta utilidad" | Las tres técnicas obligan a recuperar información en vez de releer. |
| Práctica distribuida (spacing effect) | Ebbinghaus (1885); Cepeda et al. (2006); Dunlosky et al. (2013), "alta utilidad" | Motor SM-2 transversal que espacia los repasos según el desempeño. |
| Jerarquía de exigencia: reconocer < recordar con pista < producir | Literatura de recuperación libre vs. reconocimiento | Exámenes (reconocer), flashcards (recordar con pista), recordación activa (producir). |
| Dificultades deseables | Bjork y Bjork (2011) | La retroalimentación se entrega **después** del intento, nunca antes. |
| Carga cognitiva | Sweller (1988) | La unidad de estudio es la página, no el cuaderno. Sesiones cortas. |
| Metacognición y calibración | Dunning y Kruger (1999); Koriat | Autoevaluación por ítem comparada con el resultado real; el dashboard muestra la brecha. |
| SM-2 | Wozniak (1987), implementado por SuperMemo y Anki | Algoritmo del motor. FSRS se evalúa como evolución en un ADR posterior. |

---

## 3. Modelo de producto

### 3.1 Jerarquía de contenido

```
Usuario
└── Cuaderno (agrupación, sin semántica de estudio)
    └── Página (UNIDAD DE ESTUDIO)
        ├── Contenido (documento Tiptap en JSON)
        ├── Flashcards
        ├── Preguntas de examen
        └── Preguntas de recordación activa
```

Decisión cerrada: **las técnicas se generan por página**. Un cuaderno de 100 páginas no genera un examen de 100 páginas. Cada página tiene su propio conjunto de ítems y su propio nivel de dominio.

### 3.2 El editor

- Motor: **Tiptap** (headless, sobre ProseMirror). Cogni construye su propia UI, su sistema de bloques y sus extensiones encima.
- Funcionalidades mínimas: títulos (H1–H3), párrafos, listas con viñetas, listas numeradas, listas de tareas, citas, bloques de código con resaltado de sintaxis, imágenes (subidas a Supabase Storage), divisores, tablas, callouts (idea, nota, advertencia), resaltado de texto con la paleta propia de Cogni, negrita, cursiva, subrayado, tachado, código en línea, enlaces.
- Menú de comandos con `/` para insertar cualquier bloque.
- Autoguardado con debounce y actualización optimista.
- El contenido se persiste como JSON de Tiptap; además se materializa un campo `plain_text` por página para la capa de IA.
- Importación de PDF: extrae texto y lo convierte en bloques editables dentro de la página. Sin OCR.

### 3.3 Las tres técnicas

#### Flashcards

- Anverso y reverso, generadas por IA desde la página o creadas manualmente.
- Sesión de repaso: se muestran los ítems vencidos de la página (o de todas las páginas, en la vista "Repasos de hoy").
- Calificación por el estudiante en escala SM-2 simplificada de 4 botones: Otra vez (q=1), Difícil (q=3), Bien (q=4), Fácil (q=5).
- Retroalimentación con IA al final de la sesión: resumen de qué se recordó bien y qué conviene reforzar.

#### Exámenes

- Preguntas de opción múltiple con 4 opciones y una correcta, generadas por IA desde la página o creadas manualmente.
- Sesión: N preguntas (configurable, por defecto 10). Corrección determinista.
- Cada pregunta es un ítem del motor. Correcta → q=4. Incorrecta → q=1.
- Si la nota del examen es menor a 70 %, la página queda marcada para repetir examen; el motor reprograma las preguntas falladas y el calendario lo muestra.
- Cuando el usuario repita el examen fallido no le van a salir las mismas preguntas demanera identica a las que fallo, se deben genera preguntas diferentes o descritas de otra manera, pero que ataquen las falencias que el estudiante presento anteriormente.
- Retroalimentación con IA al final: explicación de las preguntas falladas usando el contenido de la página.

#### Recordación activa

- Preguntas abiertas generadas por IA desde la página. Sesión de N preguntas (por defecto 10).
- El estudiante escribe su respuesta. Después de cada respuesta, se autoevalúa: "¿Qué tan difícil te resultó?" en escala 0–5.
- La IA evalúa cada respuesta contra el contenido de la página con una rúbrica y devuelve JSON validado (ver 8.5).
- La retroalimentación se muestra **al final de la sesión**, nunca entre preguntas.
- La calificación SM-2 del ítem combina evaluación de IA y autoevaluación (ver 7.4).

### 3.4 El motor de repetición espaciada (transversal)

Decisión cerrada (opción C):

- **Cada ítem** (flashcard, pregunta de examen, pregunta abierta) tiene su propio estado SM-2.
- **Cada página** tiene un **nivel de dominio** derivado de sus ítems.
- El calendario y el dashboard leen el nivel de página. El detalle por ítem existe para el motor, no para el usuario.
- Ningún módulo calcula fechas de repaso fuera del motor.

### 3.5 Calendario

- Vista mensual y semanal con los repasos programados por el motor, agrupados por página.
- Vista "Hoy": lista de páginas con ítems vencidos, con acceso directo a la sesión de cada técnica.
- El usuario no crea eventos manualmente. El sistema los genera.

### 3.6 Dashboard

- Progreso por cuaderno y por página: nivel de dominio, tendencia, ítems totales y vencidos.
- Métricas por técnica: tasa de acierto, racha de días con repasos, repasos completados.
- Calibración metacognitiva: comparación entre autoevaluación y resultado real. Detecta exceso y falta de confianza.
- Gráficos con los componentes de gráficos de shadcn/ui (Recharts).

### 3.7 Capa de IA como guía

La IA no es un chat. Cumple funciones acotadas y estructuradas:

1. Generar flashcards, preguntas de examen y preguntas abiertas desde una página.
2. Evaluar respuestas abiertas con rúbrica.
3. Producir retroalimentación al final de cada sesión según el puntaje.

Toda salida es JSON validado con Zod. Nunca texto libre sin esquema.

---

## 4. Stack tecnológico

Regla de versiones: en la Fase 0 se instala **la última versión estable** de cada dependencia, se fija en `package.json` y se verifica con documentación oficial actualizada (Context7). Este documento no fija números de versión para no quedar obsoleto; el `package.json` es la referencia.

### 4.1 Núcleo

| Capa | Tecnología | Uso | Costo | Condición de salida |
|---|---|---|---|---|
| Gestor de paquetes | pnpm (único) | Fijado con `packageManager` y `engines` | 0 | Ninguna |
| Framework | Next.js (App Router) + TypeScript estricto | Frontend y backend en una sola app | 0 | Ninguna |
| UI | Tailwind CSS + shadcn/ui | Sistema de diseño Cogni encima | 0 | Ninguna |
| Editor | Tiptap + extensiones oficiales | Editor de bloques | 0 | Extensiones Pro solo si un ADR lo justifica |
| Estado servidor en cliente | TanStack Query | Mutaciones optimistas, autoguardado, dashboard | 0 | Ninguna |
| Estado de UI | Zustand (mínimo) | Estado de sesión de estudio y UI | 0 | Ninguna |
| Validación | Zod | Entradas, formularios y esquemas de salida de IA | 0 | Ninguna |
| ORM | Drizzle ORM + drizzle-kit | Acceso a Postgres y migraciones versionadas | 0 | Ninguna |
| Lint y formato | Biome | Una sola herramienta | 0 | Ninguna |
| Gráficos | shadcn/ui charts (Recharts) | Dashboard | 0 | Ninguna |
| Extracción PDF | unpdf | Texto de PDF en serverless y en jobs | 0 | Ninguna |

### 4.2 Infraestructura y servicios

| Servicio | Uso | Plan | Límite relevante | Mitigación / condición de salida |
|---|---|---|---|---|
| Vercel | Hosting y deploy de Next.js, previews por rama | Hobby | Solo uso no comercial | Sin anuncios, donaciones ni cobros. Al monetizar: Pro. |
| Supabase | Postgres, Auth (correo + Google), Storage (PDF e imágenes) | Free | Pausa tras 7 días sin actividad; 500 MB DB; 1 GB Storage | Cron diario de keep-alive. Con usuarios recurrentes: Pro. |
| Cloudflare | Registrador de dominio y DNS | Registrar a costo | — | Solo DNS. Sin proxy delante de Vercel. |
| Upstash Redis | Una única base `cogni` con prefijo `REDIS_KEY_PREFIX`: límites por usuario, cuotas por proveedor de IA y estado del circuit breaker | Free | 500.000 comandos/mes | No se usa como caché genérica. (actualizado en la Fase 3, ADR 0004) |
| Vercel Functions (Fluid Compute) + Vercel Cron | Trabajo síncrono acotado (procesar PDF, generación con IA, evaluación) y tareas programadas diarias (keep-alive, cálculo de repasos) | Hobby | 300 s por función con `maxDuration` explícito; crons diarios | ADR 0003. Si un trabajo supera los 300 s, se reintroduce un servicio de jobs con un ADR nuevo. |
| Sentry | Errores en cliente y servidor | Free | Eventos/mes del plan free | Muestreo si se acerca al límite. |
| PostHog | Analítica de producto | Free | Eventos/mes del plan free | Eventos definidos explícitamente, sin autocaptura masiva. |
| Better Stack | Logs centralizados | Free | — | **Diferido a Fase 8.** Se conecta con log drain de Vercel. |
| GitHub | Código, PRs, Actions (CI) | Free | Minutos de Actions del plan free | Ninguna |

### 4.3 Proveedores de IA (todos vía Vercel AI SDK)

| Proveedor | Paquete AI SDK | Modelo | Rol en la rotación |
|---|---|---|---|
| Google AI Studio | `@ai-sdk/google` | `gemini-2.5-flash-lite` | Generación, prioridad 1 |
| Cloudflare Workers AI | `@ai-sdk/openai-compatible` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Generación, prioridad 2 |
| OpenRouter | `@openrouter/ai-sdk-provider` | `qwen/qwen3.8-27b:free` | Generación, prioridad 3 |
| OpenRouter | `@openrouter/ai-sdk-provider` | `nvidia/nemotron-3-super-120b-a12b:free` | Generación, prioridad 4 |
| Groq | `@ai-sdk/groq` | `openai/gpt-oss-120b` | Solo evaluación (no se usa en la generación de la Fase 3) |

(actualizado en la Fase 3, ADR 0004) Mistral y Cerebras se descartaron porque exigen método de pago o tarjeta. Nunca se usan varios proyectos de Google por incumplimiento de sus términos de servicio. El detalle y las alternativas descartadas están en `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md`.

Restricción conocida: los modelos Pro de Gemini no están en el tier gratuito. Los límites de los tiers gratuitos cambian sin aviso; la capa de IA se diseña asumiendo que cualquier proveedor puede fallar o agotar cuota en cualquier momento. Herramientas descartadas: OmniRoute (proxy local, no desplegable en Vercel; se usa solo como referencia de estrategias de enrutamiento), itsfree.ai (directorio informativo, no un servicio), rosenCharts (sin mantenimiento).

### 4.4 Calidad y documentación

| Aspecto | Decisión |
|---|---|
| Tests unitarios y de dominio | Vitest |
| Tests de componentes | Testing Library |
| Tests de extremo a extremo | Playwright, 3 a 5 flujos críticos |
| TDD | Estricto en dominio. Motor SM-2 y cálculo de dominio: cobertura 100 %. |
| CI | GitHub Actions en cada PR: instalación, Biome, `tsc --noEmit`, Vitest. Playwright en main. |
| Deploy | Integración Git de Vercel. Preview por rama, producción desde `main`. |
| Documentación de código | TSDoc en puertos, entidades y servicios de aplicación. |
| Documentación de proyecto | Este documento, ADRs en `docs/adr/`, artefactos SDD de gentle-ai en `openspec/` (Fases 0 y 1) y documentos de feature ODD en `odd/tasks/`. |
| Diagramas | archify, generados desde el agente hacia `docs/diagramas/`. |
| Manual de usuario | Fase 8. |
| Swagger / Scalar / Mintlify | No aplica en esta etapa. No hay API pública. |
| Docker | No para la app. Solo lo usa la Supabase CLI para Postgres local. |

---

## 5. Arquitectura

### 5.1 Estilo

**Monolito modular** con **arquitectura hexagonal por módulo**. Una sola aplicación Next.js desplegable. Cada módulo tiene dominio puro, casos de uso, adaptadores de infraestructura y UI.

### 5.2 Mapa de módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `identity` | Perfil de usuario, sesión, preferencias | Supabase Auth |
| `notebooks` | Cuadernos, páginas, contenido, `plain_text` | `identity` |
| `editor` | Extensiones Tiptap, bloques, menú `/`, resaltados, autoguardado | `notebooks` (por puerto de guardado) |
| `ingestion` | Subida de PDF, extracción, conversión a bloques | `notebooks`, Storage |
| `ai` | Registro de proveedores, rotación por cuota, salida estructurada, prompts versionados, rate limiting | Upstash, proveedores |
| `study-engine` | Estado SM-2 por ítem, nivel de dominio por página, cálculo de vencimientos | Nadie del dominio de estudio |
| `flashcards` | Tarjetas, sesiones, retroalimentación | `study-engine`, `ai`, `notebooks` |
| `exams` | Preguntas, sesiones, corrección, retroalimentación | `study-engine`, `ai`, `notebooks` |
| `active-recall` | Preguntas abiertas, sesiones, evaluación combinada | `study-engine`, `ai`, `notebooks` |
| `scheduling` | Calendario y vista "Hoy" | `study-engine`, `notebooks` |
| `analytics` | Dashboard, métricas, calibración | `study-engine`, técnicas (solo lectura) |

### 5.3 Reglas de dependencia (obligatorias)

1. `domain` no importa nada externo: ni Next.js, ni Drizzle, ni AI SDK, ni React.
2. `application` depende solo de `domain` y de puertos (interfaces) definidos en `domain` o `application`.
3. `infrastructure` implementa puertos. Es el único lugar con Drizzle, Supabase, AI SDK, Upstash.
4. `ui` consume `application` a través de Server Actions o route handlers. Nunca toca `infrastructure` directamente.
5. Un módulo solo importa de otro módulo a través de su `index.ts` público. Nunca de rutas internas.
6. `study-engine` no conoce las técnicas. Las técnicas le envían resultados por el puerto `RecordReview` y le consultan vencimientos por `GetDueItems`.
7. Se verifica con reglas de Biome o con un test de arquitectura (dependency-cruiser) en CI.

### 5.4 Estructura de carpetas

```
cogni/
├── src/
│   ├── app/                      # Rutas Next.js (App Router). Capa delgada.
│   │   ├── (public)/             # landing, login, registro
│   │   ├── (app)/                # shell autenticado
│   │   └── api/                  # route handlers (webhooks, keep-alive)
│   ├── modules/
│   │   ├── identity/
│   │   ├── notebooks/
│   │   ├── editor/
│   │   ├── ingestion/
│   │   ├── ai/
│   │   ├── study-engine/
│   │   ├── flashcards/
│   │   ├── exams/
│   │   ├── active-recall/
│   │   ├── scheduling/
│   │   └── analytics/
│   │       ├── domain/           # entidades, value objects, reglas, puertos
│   │       ├── application/      # casos de uso, DTOs, servicios
│   │       ├── infrastructure/   # repositorios Drizzle, adaptadores externos
│   │       ├── ui/               # componentes React del módulo
│   │       └── index.ts          # API pública del módulo
│   ├── shared/
│   │   ├── kernel/               # Result, errores de dominio, ids, fechas
│   │   ├── db/                   # cliente Drizzle, esquema compartido
│   │   ├── ui/                   # shadcn/ui y primitivas del design system
│   │   └── config/               # env validado con Zod
├── drizzle/                      # migraciones generadas
├── tests/
│   └── e2e/                      # Playwright
├── docs/
│   ├── documento-maestro.md
│   ├── adr/
│   ├── design-system/
│   └── diagramas/
├── openspec/                     # artefactos SDD de gentle-ai
└── .github/workflows/
```

### 5.5 Flujo de datos de referencia

```
Usuario edita página
  → editor.ui (Tiptap) → autoguardado (TanStack Query)
  → Server Action → notebooks.application.SavePage
  → notebooks.infrastructure.PageRepository (Drizzle)
  → Postgres (content JSON + plain_text)

Usuario pide "Generar flashcards" (planificado, Fase 3; aún no hay código de generación)
  → flashcards.ui → Server Action (maxDuration acotado) → flashcards.application.RequestGeneration
  → ai.application.GenerateStructured (rotación de proveedor)
  → flashcards.infrastructure guarda tarjetas
  → study-engine.RegisterItems crea estado SM-2 por tarjeta
  → la Server Action responde con el resultado y la UI lo muestra (sin cola ni polling: el trabajo cabe en `maxDuration`)

Usuario califica una tarjeta
  → flashcards.application.RateCard
  → study-engine.RecordReview(itemId, quality)
  → recalcula SM-2 del ítem y nivel de dominio de la página
  → scheduling y analytics leen el nuevo estado
```

---

## 6. Modelo de dominio y datos

### 6.1 Entidades principales

Convenciones comunes a todas las entidades de usuario: `id` (UUID v7), `owner_id`, `created_at`, `updated_at`. Se omiten de la tabla para no repetirlos. El borrado es lógico (`archived_at`) en todo lo que el usuario crea a mano.

| Entidad | Módulo | Campos clave |
|---|---|---|
| `Profile` | identity | `id` (= auth.users.id), `display_name`, `locale`, `timezone` (IANA, para presentar fechas), `onboarding_completed_at` |
| `Notebook` | notebooks | `title`, `icon` (emoji elegido por el usuario), `color`, `position`, `archived_at` |
| `Page` | notebooks | `notebook_id`, `title`, `content` (jsonb Tiptap), `plain_text`, `content_version`, `position`, `archived_at` |
| `PageAsset` | notebooks | `page_id`, `storage_path`, `mime`, `size_bytes` |
| `ImportJob` | ingestion | `page_id`, `storage_path`, `file_name`, `status` (queued/processing/done/failed), `page_count`, `error` |
| `StudyItem` | study-engine | `page_id`, `kind` (flashcard/exam_question/recall_question), `source_id` (id de la Flashcard, de la `ExamQuestion` raíz o de la `RecallQuestion`), `easiness` (≥1.3, inicial 2.5), `interval_days`, `repetitions`, `due_at`, `last_quality`, `last_reviewed_at`, `lapses`, `suspended_at` |
| `ReviewLog` | study-engine | `item_id`, `quality`, `reviewed_at`, `interval_before`, `interval_after`, `easiness_after`, `session_kind`, `session_id` |
| `PageMastery` | study-engine | `page_id`, `level` (Nuevo/Aprendiendo/Consolidando/Dominado), `score` (0–1), `items_total`, `items_due`, `computed_at` |
| `Flashcard` | flashcards | `page_id`, `front`, `back`, `origin` (ai/manual), `generation_id`, `archived_at` |
| `FlashcardSession` | flashcards | `page_id` (nulo en la vista "Hoy" multipágina), `started_at`, `finished_at`, `reviewed_count`, `again_count` |
| `ExamQuestion` | exams | `page_id`, `stem`, `options` (jsonb, 4), `correct_index`, `explanation`, `concept` (texto corto: el concepto que evalúa), `root_id` (id de la pregunta original de su linaje; igual a su propio `id` si es original), `variant_of` (id de la pregunta a la que reemplaza, nulo si es original), `origin` (ai/manual/ai_variant), `generation_id`, `retired_at` |
| `ExamPageState` | exams | `page_id`, `retake_pending` (bool), `failed_root_ids` (jsonb, ids raíz falladas en el último examen), `last_passed_session_id` |
| `ExamSession` | exams | `page_id`, `is_retake`, `retake_of_session_id`, `started_at`, `finished_at`, `total`, `correct`, `score` (0–1), `passed` |
| `ExamAnswer` | exams | `session_id`, `question_id` (la variante realmente mostrada), `root_id`, `selected_index`, `is_correct`, `answered_at` |
| `RecallQuestion` | active-recall | `page_id`, `prompt`, `rubric` (jsonb: `keyConcepts[]`, `acceptableAnswerSummary`), `origin`, `generation_id`, `archived_at` |
| `RecallSession` | active-recall | `page_id`, `started_at`, `finished_at`, `evaluation_status` (pending/done/partial) |
| `RecallAnswer` | active-recall | `session_id`, `question_id`, `answer_text`, `self_rating` (0–5), `evaluation_status` (pending/done/failed), `ai_evaluation` (jsonb crudo), `ai_score` (0–5), `combined_quality` (0–5), `generation_id`, `disagreed` (bool) |
| `SessionFeedback` | técnicas | `session_kind`, `session_id`, `content` (jsonb), `generation_id`, `status` (pending/done/failed) |
| `AiGeneration` | ai | `page_id` (nulo si no aplica), `purpose`, `provider`, `model`, `prompt_version`, `input_tokens`, `output_tokens`, `latency_ms`, `status` (queued/running/done/failed), `error` |

Relaciones que importan:

- Un `StudyItem` de tipo `exam_question` apunta a la pregunta **raíz** (`root_id`). Todas las variantes de esa raíz alimentan el mismo ítem. Así el motor sigue el concepto, no la redacción.
- `ReviewLog.session_id` apunta a `FlashcardSession`, `ExamSession` o `RecallSession` según `session_kind`.
- `SessionFeedback` existe una vez por sesión terminada.
- `owner_id` se filtra en la capa de aplicación en toda consulta, sin excepción.

### 6.2 Reglas de persistencia

- Postgres en Supabase. Esquema y migraciones con Drizzle. Nunca cambios manuales en producción.
- El servidor se conecta con la cadena de conexión de Supabase (pooler) y omite RLS; la autorización es explícita en `application`.
- RLS permanece activo en Storage y en cualquier acceso desde el cliente con `supabase-js`.
- `content` de página es JSON de Tiptap. `plain_text` se recalcula en cada guardado y es lo que consume la IA.
- Borrado lógico (`archived_at`) para cuadernos y páginas. Borrado físico solo por job de limpieza.

---

## 7. Especificación del motor de repetición espaciada

### 7.1 SM-2 por ítem

Entrada: calidad `q` entre 0 y 5. Estado: `easiness` (EF), `interval_days` (I), `repetitions` (n).

```
si q < 3:
    n = 0
    I = 1
si q >= 3:
    si n = 0: I = 1
    si n = 1: I = 6
    si n >= 2: I = redondear(I_anterior * EF)
    n = n + 1

EF = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
EF = max(EF, 1.3)

due_at = ahora + I días
lapses += 1 si q < 3
```

Implementación como función pura `applySm2(state, quality, now) → newState`. Sin efectos secundarios. Cobertura 100 % con casos: primera revisión, segunda, tercera, fallo tras éxito, EF mínimo, q = 0 y q = 5 extremos.

### 7.2 Mapeo de calidad por técnica

| Técnica | Señal | `q` |
|---|---|---|
| Flashcards | Botón del estudiante | Otra vez 1, Difícil 3, Bien 4, Fácil 5 |
| Exámenes | Corrección determinista | Incorrecta 1, Correcta 4 |
| Recordación activa | Combinación IA + autoevaluación | Ver 7.4 |

### 7.3 Nivel de dominio por página (v1)

```
para cada ítem activo de la página:
    estabilidad_i = min(1, interval_days_i / 21)
    acierto_i     = 1 si last_quality >= 3, si no 0
    aporte_i      = 0.6 * estabilidad_i + 0.4 * acierto_i

score = promedio(aporte_i)        # 0 si la página no tiene ítems

nivel:
    sin ítems        → "Nuevo"
    score < 0.35     → "Aprendiendo"
    score < 0.70     → "Consolidando"
    score >= 0.70    → "Dominado"
```

Es una fórmula v1. Se implementa como función pura, se prueba al 100 % y se ajusta por ADR con datos reales. El calendario ordena por `due_at` mínimo de los ítems de la página; el dashboard muestra `level` y `score`.

### 7.4 Calidad combinada en recordación activa (v1)

```
ai_score      ∈ [0, 5]   (de la evaluación con rúbrica)
self_rating   ∈ [0, 5]   (0 = imposible, 5 = trivial)

combined = redondear(0.6 * ai_score + 0.4 * self_rating)

señal metacognitiva:
    self_rating >= 4 y ai_score <= 2  → exceso de confianza
    self_rating <= 1 y ai_score >= 4  → falta de confianza
```

Ninguna de las dos señales manda sola. Se registran las tres (cruda, autoevaluación, combinada).

### 7.5 Reprogramación y repetición de exámenes

```
al terminar un ExamSession:
    score = correct / total
    para cada respuesta: RecordReview(item de root_id, q = 4 si correcta, q = 1 si incorrecta)
    si score < 0.70:
        ExamPageState.retake_pending = true
        ExamPageState.failed_root_ids = raíces de las preguntas falladas
    si score >= 0.70:
        ExamPageState.retake_pending = false
        ExamPageState.failed_root_ids = []
        ExamPageState.last_passed_session_id = sesión actual
```

Repetición (decisión cerrada): el estudiante **nunca vuelve a ver la misma pregunta con la misma redacción**. Al iniciar un examen de repetición:

1. Para cada `root_id` en `failed_root_ids` se genera una **variante** con la IA (propósito `generate_exam_variants`): misma página, mismo `concept`, redacción, enfoque u opciones distintas. La variante se guarda con `variant_of` = pregunta anterior y `root_id` = raíz.
2. La pregunta anterior se marca `retired_at` para no volver a mostrarse.
3. La sesión de repetición contiene una variante por raíz fallada. Si son menos de 5, se completan con preguntas nuevas de la página hasta 5, para no hacer un examen trivial.
4. Las respuestas alimentan el `StudyItem` de la raíz, por lo que el historial SM-2 del concepto se conserva.
5. Si la generación de variantes falla en todos los proveedores, la repetición se bloquea con mensaje claro; no se reutiliza la pregunta original.

Las preguntas falladas vencen al día siguiente (q = 1), así la página aparece en "Hoy" con la acción "Repetir examen".

---

## 8. Capa de servicio de IA

### 8.1 Principios

1. Toda llamada pasa por `ai.application`. Ningún módulo importa el AI SDK directamente.
2. Toda salida es estructurada: `generateObject` con esquema Zod (AI SDK v7; `generateObject` figura como obsoleto a favor de `generateText` con `Output.object`, migración pendiente, ver ADR 0004). Si el proveedor no cumple el esquema, se reintenta una vez con otro proveedor; si falla, la operación se marca `failed` y el usuario ve un mensaje claro. Nunca se inventa un resultado.
3. Los prompts son versionados en código (`prompts/<purpose>/v1.ts`). Cada `AiGeneration` registra la versión usada.
4. Temperatura baja (≤ 0.3) para evaluación; moderada (≤ 0.7) para generación.
5. Todo se ejecuta dentro del presupuesto de una función de Vercel (máximo 300 segundos, con `maxDuration` explícito). Las tareas programadas usan Vercel Cron. (ADR 0003) Si una función se interrumpe a mitad de un trabajo, el estado persistido queda como estaba: en la importación de PDF (Fase 2), una consulta de estado reporta como `failed` (tiempo agotado) un trabajo no terminal sin escrituras desde hace `maxDuration` + 30 s, sin reescribir la fila ni reintentarlo; no existe un mecanismo de recuperación automática.

### 8.2 Registro de proveedores y rotación

```
ProviderRegistry (src/modules/ai/infrastructure/provider-registry.ts)
  ├── entradas: { id, model, capabilities, rpm, rpd, priority }
  │     solo las de proveedores con clave configurada
  ├── selectProvider(purpose) → primer proveedor sano con cuota disponible
  │     por capacidad, luego prioridad, luego cuota restante
  └── generateStructured → registra cada intento en AiGeneration;
        ante error o salida inválida reintenta una vez con el siguiente proveedor

Claves en Upstash Redis (prefijo REDIS_KEY_PREFIX: cogni:dev | cogni:prod):
  {prefijo}:ai:quota:{provider}:{yyyy-mm-dd}        contador diario, TTL 48 h
  {prefijo}:ai:quota:{provider}:{yyyy-mm-dd-hh-mm}  contador por minuto, TTL 120 s
  {prefijo}:ai:breaker:{provider}                   estado del breaker (JSON), TTL 1 h
  {prefijo}:ai:gen:*                                límite por usuario (Upstash Ratelimit)

Circuit breaker simple:
  3 fallos consecutivos → proveedor marcado no sano por 10 minutos
```

`{provider}` es el `id` de la entrada (por ejemplo `gemini-flash-lite`, `cloudflare-workers-ai`, `openrouter-qwen`, `openrouter-nemotron`). Con `AI_PROVIDER_MODE=fake` el registro contiene un único proveedor determinista y cuotas, breaker y límite viven en memoria (CI y e2e).

### 8.3 Rate limiting por usuario

Upstash Ratelimit con ventana fija de un día. Límite inicial implementado: 6 generaciones por usuario por día, configurable con `AI_DAILY_GENERATIONS` (antes 20, actualizado en la Fase 3). El límite de evaluaciones por usuario aún no está implementado; su valor se fija en la Fase 6, cuando exista `evaluate_recall_answer`. Se muestra al usuario como "Te quedan N generaciones hoy".

### 8.4 Propósitos y esquemas

En la Fase 3 solo `generate_flashcards` está cableado de extremo a extremo (prompt `generate_flashcards/v1`); los demás propósitos tienen esquema Zod y tipo, pero ningún caso de uso los invoca todavía.

| Propósito | Entrada | Salida (Zod) |
|---|---|---|
| `generate_flashcards` | `plain_text`, cantidad | `{ cards: [{ front, back }] }` |
| `generate_exam_questions` | `plain_text`, cantidad | `{ questions: [{ stem, options[4], correctIndex, explanation, concept }] }` |
| `generate_exam_variants` | `plain_text`, lista de preguntas falladas (`stem`, `concept`, `explanation`) | `{ variants: [{ forRootId, stem, options[4], correctIndex, explanation }] }` — misma idea evaluada, redacción y enfoque distintos |
| `generate_recall_questions` | `plain_text`, cantidad | `{ questions: [{ prompt, rubric: { keyConcepts[], acceptableAnswerSummary } }] }` |
| `evaluate_recall_answer` | pregunta, rúbrica, fragmento relevante, respuesta | `{ score: 0-5, presentConcepts[], missingConcepts[], misconceptions[], justification }` |
| `session_feedback` | técnica, resultados de la sesión | `{ summary, strengths[], toReinforce[], nextStepSuggestion }` |

### 8.5 Riesgos específicos de recordación activa (registro obligatorio)

- La evaluación de texto libre no es determinista. Mitigación: rúbrica explícita, esquema estricto, temperatura baja, fragmento de página como contexto, registro de la evaluación cruda para auditoría.
- Un modelo puede puntuar mal. Mitigación: la calificación final combina la autoevaluación; el estudiante ve la justificación y puede marcar "no estoy de acuerdo" (se registra, no cambia el puntaje en v1).
- Un proveedor puede caer a mitad de sesión. Mitigación: las respuestas se guardan primero; la evaluación es asíncrona y se reintenta con otro proveedor; la retroalimentación se muestra cuando todas las evaluaciones terminan.
- Contenido de página muy largo. Mitigación implementada en la Fase 3 para la generación: se conserva el inicio del texto hasta el tope `AI_PAGE_TOKEN_CAP` (12.000 por defecto, estimación por palabras) y la interfaz avisa cuántas palabras se usaron; no hay selector de sección ni división en partes. Para recordación activa (Fase 6): se recorta `plain_text` a la ventana del modelo, priorizando el fragmento más similar a la pregunta (búsqueda léxica simple en v1; embeddings quedan fuera de alcance).

---

## 9. Seguridad y autorización

- Autenticación con Supabase Auth: correo/contraseña con verificación y Google OAuth. Sesión por cookies gestionadas por `@supabase/ssr`.
- Toda Server Action y route handler valida sesión y valida entrada con Zod antes de tocar `application`.
- Autorización por propiedad: cada caso de uso recibe `ownerId` de la sesión y filtra por él. No existe acceso entre usuarios.
- Storage: buckets privados con políticas RLS por `owner_id`. URLs firmadas de corta duración.
- Variables de entorno validadas al arranque con Zod (`shared/config`). Ninguna clave de proveedor llega al cliente.
- Cabeceras de seguridad configuradas en `next.config` (CSP básica, HSTS lo maneja Vercel).
- Dependencias auditadas en CI (`pnpm audit --audit-level=high`).

---

## 10. Entornos, CI/CD y operación

### 10.1 Entornos

| Entorno | Base de datos | IA | Deploy |
|---|---|---|---|
| Local | Supabase CLI (`supabase start`) | Claves personales, proveedores reales con cuota baja | `pnpm dev` |
| Preview | Proyecto Supabase de desarrollo | Igual que local | Vercel preview por rama |
| Producción | Proyecto Supabase de producción | Claves de producción | Vercel desde `main` |

Nota: el plan free de Supabase permite 2 proyectos activos. Desarrollo y producción son los dos.

### 10.2 Pipeline

```
PR abierta
  → GitHub Actions: pnpm install --frozen-lockfile → biome ci → tsc --noEmit → vitest run → pnpm audit
  → Vercel preview
Merge a main
  → GitHub Actions: lo anterior + playwright (contra preview)
  → Vercel producción
  → drizzle migrate (paso explícito en el workflow, antes del deploy)
```

### 10.3 Operación de costo cero

- Keep-alive: Vercel Cron diario (`vercel.json` → `/api/keep-alive`, protegido con `CRON_SECRET`) que ejecuta `select 1` contra Supabase de producción.
- Job diario de vencimientos: recalcula `PageMastery` y materializa la vista "Hoy".
- Alertas: Sentry a correo. PostHog con eventos: `page_created`, `pdf_imported`, `generation_requested`, `session_started`, `session_finished`, `item_rated`.
- Presupuesto vigilado: la generación por lotes se trocea en unidades que quepan en los 300 s de una función; si el uso de funciones de Vercel se acerca al límite del plan Hobby, se reducen los lotes.

---

## 11. Sistema de diseño y UI

- Fuente de verdad visual: `docs/design-system/` (copia versionada de la guía creada por el autor, renombrada a Cogni). Se aplica como tokens en `app/globals.css` con `@theme` de Tailwind y en la configuración de shadcn/ui.
- Identidad: lienzo gris cálido `#EDEAE4`, superficies blancas, acento violeta `#7C3AED`, botón primario casi negro `#1C1917`, DM Sans para texto y JetBrains Mono para código, radios generosos (tarjetas 16 px, área de contenido 20 px), sombras muy sutiles, íconos Lucide.
- Paleta de resaltado del editor: la paleta pastel del design system (rosa, verde, amarillo, violeta, naranja, azul, menta), cada una con su variante de texto accesible.
- Copy de interfaz: español, "tú", oración en minúscula inicial salvo nombres propios, sin emoji salvo íconos de cuaderno elegidos por el usuario.
- Accesibilidad objetivo: WCAG 2.1 AA, objetivos táctiles de 44 px, `prefers-reduced-motion` respetado.
- Las pantallas de referencia en `docs/design-system/ui_kits/` son guía estética, no contrato. Cualquier contradicción con este documento se resuelve a favor de este documento.
- La iteración visual de las pantallas de flashcards, exámenes, recordación activa y dashboard está integrada en `main` como vistas previas ocultas en producción, con datos de muestra locales a cada ruta (`requireDesignPreviews()` en `src/shared/config/design-previews.ts`; visibles en desarrollo o con `COGNI_DESIGN_PREVIEWS=1`). Sus capas de dominio y aplicación siguen vacías: las Fases 4 a 7 reemplazan los datos de muestra por puertos de aplicación reales. Si una pantalla y este documento se contradicen, prevalece este documento.
- Se creará una skill de diseño para el agente (`cogni-design`) que apunte a esta carpeta, registrada en el registro de skills de gentle-ai.

---

## 12. Convenciones

| Tema | Regla |
|---|---|
| Idioma del código | Inglés: identificadores, nombres de archivos, mensajes de commit. |
| Comentarios en código | Inglés simple (nivel B1). Frases cortas, sin jerga innecesaria. |
| Interfaz de usuario | Español, "tú". |
| Documentación técnica | Español neutro profesional. |
| Commits | Conventional Commits: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`. Sin atribución a IA. |
| Ramas | `main` protegida. `feat/<change>`, `fix/<tema>`. Una rama por change o feature. |
| PRs | Máximo 400 líneas netas; si crece, se divide en PRs encadenadas. |
| Nombres de módulos | kebab-case en carpetas, PascalCase en tipos, camelCase en funciones. |
| Errores | `Result<T, DomainError>` en dominio y aplicación. Excepciones solo en infraestructura, traducidas en el borde. |
| Fechas | UTC en base de datos. Zona horaria del usuario solo en presentación. |
| IDs | UUID v7 generados en aplicación. |

---

## 13. Fases de construcción

Las Fases 0 y 1 se construyeron como changes SDD de gentle-ai (artefactos archivados en `openspec/`); desde 2026-09-22 cada fase se construye con ODD (ver §15). Una fase se considera terminada solo cuando está desplegada en producción y cumple su criterio de "hecho".

### Fase 0 — Cimientos

Entregables: repositorio con estructura de 5.4, Next.js + TypeScript estricto, Tailwind + shadcn/ui con tokens Cogni, Supabase (Auth con correo y Google, Storage), Drizzle con migración inicial (`profiles`), Biome, Vitest, Playwright, GitHub Actions, Sentry, PostHog, dominio comprado en Cloudflare y apuntado a Vercel, `sdd init` ejecutado.
Hecho cuando: un usuario se registra, verifica correo, inicia sesión con Google y ve el shell vacío en el dominio de producción. CI verde.

### Fase 1 — Cuadernos y editor

Entregables: CRUD de cuadernos y páginas, sidebar, editor Tiptap con todos los bloques de 3.2, menú `/`, resaltados con paleta Cogni, imágenes a Storage, autoguardado optimista, `plain_text` materializado.
Hecho cuando: un usuario toma apuntes completos de una clase sin salir de Cogni y los recupera al volver a entrar.

### Fase 2 — Importación de PDF

> **Implementada y fusionada en `main` el 2026-09-23**, construida con ODD. El procesamiento es síncrono dentro de una Server Action acotada por `maxDuration` (ADR 0003), sin Trigger.dev. El diferimiento del 2026-09-22 (ADR 0002) quedó revertido al reinstaurarse la fase.

Entregables: subida a Storage, `ImportJob`, procesamiento síncrono con unpdf en una Server Action acotada por `maxDuration`, conversión de texto a bloques (títulos por heurística, párrafos, listas), estado de progreso en UI, manejo de PDF sin texto.
Hecho cuando: un PDF de 30 páginas con capa de texto termina como página editable en menos de 60 segundos.

### Fase 3 — Capa de IA

> **Implementada en la rama `feat/ai-pr6-ui-docs` (2026-10-04), construida con ODD.** Decisiones en `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md`.

Entregables: `ProviderRegistry`, rotación por cuota con Upstash, circuit breaker, rate limiting por usuario, prompts versionados, `AiGeneration`, primer caso de uso real: `generate_flashcards` desde una página (sin sesiones de repaso todavía; solo generación y listado).
Hecho cuando: con la cuota de un proveedor agotada artificialmente, la generación sigue funcionando con el siguiente y el registro lo evidencia.

Estado (actualizado en la Fase 3):

- Entregado: registro de proveedores, rotación por cuota, circuit breaker, límite de 6 generaciones por usuario por día, prompts versionados (`generate_flashcards/v1`), entidad `AiGeneration` (tabla `ai_generations`), generación y listado de flashcards (tabla `flashcards`), interfaz en el panel de técnicas de la página y rutas `/flashcards`, modo `AI_PROVIDER_MODE=fake` para CI y e2e.
- Pendiente: ejecución manual de `scripts/ai-smoke.mts` con claves reales y cuota agotada artificialmente (criterio de "hecho"); migración de `generateObject` a `generateText` con `Output.object`; términos de uso en el registro (funcionalidad separada).

### Fase 4 — Motor de repetición espaciada y Flashcards

Entregables: `applySm2` y `computeMastery` con TDD al 100 %, `StudyItem`, `ReviewLog`, `PageMastery`, flashcards manuales, sesión de repaso con 4 botones, retroalimentación de sesión con IA, vista mínima "Repasos de hoy", job diario.
Hecho cuando: un usuario repasa durante 3 días simulados y los intervalos coinciden exactamente con SM-2 en los tests y en producción.

### Fase 5 — Exámenes

Entregables: generación y edición manual de preguntas con `concept`, sesión de examen, corrección, alimentación del motor, `ExamPageState`, reprogramación por nota < 70 %, repetición con variantes generadas por IA (7.5), retroalimentación con IA.
Hecho cuando: fallar un examen hace aparecer la página en "Hoy" al día siguiente, y al repetirlo el estudiante recibe preguntas distintas sobre los mismos conceptos fallados.

### Fase 6 — Recordación activa

Entregables: generación de preguntas abiertas con rúbrica, sesión con respuesta escrita y autoevaluación, evaluación asíncrona con esquema, calidad combinada, retroalimentación al final, registro de señales metacognitivas.
Hecho cuando: una sesión completa funciona aunque un proveedor falle a mitad, y cada respuesta conserva su evaluación cruda.

### Fase 7 — Calendario y Dashboard

Entregables: calendario mensual y semanal, vista "Hoy" completa, dashboard con progreso por cuaderno y página, métricas por técnica, calibración metacognitiva, gráficos shadcn.
Hecho cuando: el usuario puede responder "qué estudio hoy" y "cómo voy" sin abrir ninguna página.

### Fase 8 — Endurecimiento

Entregables: Better Stack con log drain, revisión de límites y cuotas, pruebas de carga ligeras, auditoría de accesibilidad, manual de usuario, documentación final y diagramas con archify, entregables académicos.
Hecho cuando: la plataforma se publica para uso abierto.

### Próximamente

No hay fases diferidas por ahora. Una fase diferida por ADR se listaría aquí con su fecha, su ADR y el estado de su planificación.

---

## 14. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Tiers gratuitos de IA cambian o desaparecen | Alta | Alto | Rotación multi-proveedor, registro configurable sin deploy, degradación a "sin IA" con mensaje claro |
| Supabase pausa el proyecto | Media | Alto | Keep-alive diario; upgrade a Pro como primer gasto |
| Vercel Hobby considerado uso comercial | Baja | Alto | Producto sin monetización; documentado en 4.2 |
| Evaluación de IA inconsistente en recordación activa | Alta | Medio | Sección 8.5 completa |
| Editor Tiptap: complejidad de bloques personalizados | Media | Medio | Extensiones oficiales primero; bloques propios solo para lo diferencial |
| Alcance crece a mitad de fase | Alta | Alto | Sección 1.2 y este documento; cambios solo por ADR |
| Una sola persona desarrollando | Cierta | Medio | Fases chicas, ODD con tareas rastreadas, TDD en dominio, CI estricta |

---

## 15. Flujo de trabajo con gentle-ai

1. Las Fases 0 y 1 se construyeron con SDD: `sdd init` bootstrapeó el contexto y cada entregable fue un change (`sdd new` → exploración → propuesta → spec → diseño → tareas → apply → verify → archive). Sus artefactos archivados están en `openspec/`.
2. Desde 2026-09-22 el flujo activo es Organic Driven Development (ODD): un documento de feature en `odd/tasks/` con tareas rastreadas, TDD estricto, commits por unidad de trabajo, PRs pequeñas encadenadas y revisión nativa (RDD) por porción. SDD sigue disponible cuando se elige explícitamente.
3. Este documento se pasa como contexto a cada fase de exploración. Las specs y los documentos de feature no lo contradicen; si necesitan hacerlo, primero un ADR.
4. `sdd-research` se ejecuta en Fase 3 (proveedores de IA y límites vigentes) y en Fase 4 (evidencia de SM-2 y ciencia cognitiva).
5. Las decisiones de arquitectura se registran como ADR en `docs/adr/` con el formato `NNNN-titulo.md`.
6. Solo se usan herramientas y skills provistas por gentle-ai y las skills propias del proyecto (`cogni-design`). No se usan skills externas instaladas en el cliente.
7. Modo TDD estricto habilitado.

---

## 16. Glosario

| Término | Definición |
|---|---|
| Cuaderno | Agrupación de páginas de un usuario. Sin semántica de estudio. |
| Página | Unidad de estudio. Contiene el documento y sus ítems. |
| Ítem | Cualquier flashcard, pregunta de examen o pregunta abierta con estado SM-2. |
| Motor | Módulo `study-engine`. Único responsable de fechas de repaso y dominio. |
| Nivel de dominio | Enum Nuevo / Aprendiendo / Consolidando / Dominado derivado de los ítems de una página. |
| Sesión | Una ejecución de una técnica sobre una página. |
| Calidad (q) | Entero 0–5 que alimenta SM-2. |
| Generación | Una llamada a la capa de IA con propósito y esquema definidos. |

---

## 17. Referencias

- Roediger, H. L., y Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science*, 17(3).
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., y Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest*, 14(1).
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., y Rohrer, D. (2006). Distributed practice in verbal recall tasks. *Psychological Bulletin*, 132(3).
- Bjork, E. L., y Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning.
- Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science*, 12(2).
- Wozniak, P. A. (1990). Optimization of learning. Algoritmo SM-2, SuperMemo.
- Documentación de Vercel AI SDK, Tiptap, Drizzle ORM, Supabase, Vercel Functions y Cron, Upstash (consultar versión vigente al iniciar cada fase).
