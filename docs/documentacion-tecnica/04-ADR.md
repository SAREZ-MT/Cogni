# Registro de Decisiones de Arquitectura (ADR) — Cogni

**Proyecto:** Cogni — plataforma web de estudio a partir de apuntes propios
**Versión:** 1.2
**Fecha:** 2026-10-26
**Estado:** Borrador
**Autor:** Javier Sarez
**Documentos relacionados:** ./01-SRS.md, ./02-SAD.md, ./03-DATA-API.md

---

## 0. Nota de estado actual (revisada el 2026-10-15 contra el código)

- Las Fases 0 a 7 están implementadas y los 11 módulos de `src/modules/` son reales; ninguno es un esqueleto.
  - Fase 0 (Cimientos) y Fase 1 (Cuadernos y editor): desplegadas en producción (`identity`, `notebooks`, `editor`).
  - Fase 2 (Importación de PDF): implementada bajo Organic Driven Development (ODD) el 2026-09-23 (`src/modules/ingestion`). Desde el 2026-10-26 (rama `feat/document-import`) la importación admite PDF y Word (`.docx`); PowerPoint (`.pptx`) está planificado. Decisiones en `docs/adr/0009-importacion-multiformato-y-catalogo-de-contenido.md`.
  - Fase 3 (Capa de IA, PR #63–#69) y aceptación de términos de uso (PR #70): `src/modules/ai` e `identity`; decisiones en `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md`.
  - Fase 4 (Motor de repetición y flashcards, PR #71–#77): `src/modules/study-engine` y `src/modules/flashcards`; decisiones en `docs/adr/0005-motor-de-repeticion-y-flashcards.md`.
  - Fase 5 (Exámenes, PR #78–#86): `src/modules/exams`; decisiones en `docs/adr/0006-examenes-y-repeticion-con-variantes.md`.
  - Fase 6 (Recordación activa, PR #87–#94): `src/modules/active-recall`; decisiones en `docs/adr/0007-recordacion-activa-y-generacion-incremental.md`.
  - Fase 7 (Calendario y dashboard, PR #95–#100): `src/modules/scheduling` y `src/modules/analytics`, sin tablas nuevas; decisiones en `docs/adr/0008-calendario-y-dashboard.md`.
- Fase 9 (Endurecimiento) está parcialmente cubierta: la Content Security Policy con nonce por petición, la redirección del dominio apex y la protección de sesión ya existen en `src/proxy.ts` y `src/shared/config/security-headers.ts`; el resto (registro de logs externo, pruebas de carga, auditoría de accesibilidad) no se ha iniciado.
- Las 11 decisiones de este documento están aceptadas e implementadas y son verificables contra el código de la rama principal. Las decisiones se conservan como registro histórico: cuando el código se apartó del texto original, la entrada indica en su Estado qué parte quedó reemplazada y una nota "Actualización (2026-10-15)" o "Consecuencias actuales" describe el estado real, sin reescribir la decisión original.

### Dos series de decisiones

- Referencias a decisiones: "`04-ADR.md`, ADR-0NN" designa una entrada de este documento; "`docs/adr/00NN`" designa un ADR numerado del repositorio. Son dos numeraciones distintas e independientes (por ejemplo, `04-ADR.md`, ADR-008 trata el Vercel AI SDK, mientras que `docs/adr/0008` trata el calendario y el dashboard). Este documento no se renumera.
- Este documento consolida, con comparación retrospectiva de alternativas, las decisiones de producto, stack y arquitectura tomadas antes de programar (`docs/adr/0001-decisiones-fundacionales.md` y `docs/documento-maestro.md`).
- `docs/adr/0001` a `docs/adr/0009` son el registro cronológico de decisiones por fase, escritas al construir cada una. Relación verificable con las entradas de este documento:

| ADR numerado | Fecha / estado | Relación con este documento |
|---|---|---|
| `docs/adr/0001` | Decisiones fundacionales | Origen de ADR-001, ADR-002, ADR-003, ADR-006, ADR-007 y ADR-008. |
| `docs/adr/0002` | 2026-09-22; revertido el 2026-09-23 | Ninguna: solo afectaba el orden de las fases (Fase 2 diferida y luego reincorporada). |
| `docs/adr/0003` | 2026-09-22 | Precisa ADR-009: elimina Trigger.dev del stack y fija el tope de 300 s por función con `maxDuration` explícito. |
| `docs/adr/0004` | 2026-10-04 (Fase 3) | Reemplaza la lista de proveedores de ADR-008 (cinco proveedores) por Google AI Studio, Cloudflare Workers AI y OpenRouter para generación, con Groq solo para evaluación; añade cuotas, *circuit breaker* y límites por usuario en Upstash Redis. |
| `docs/adr/0005` | 2026-10-04 (Fase 4) | Precisa ADR-007 (motor SM-2, tablas y migración `0009`). |
| `docs/adr/0006` | 2026-10-06 (Fase 5) | Precisa ADR-007 y ADR-008 (exámenes y repetición con variantes). |
| `docs/adr/0007` | 2026-10-10 (Fase 6) | Precisa ADR-007 (calidad combinada en SM-2), ADR-008 (límite de evaluaciones) y ADR-009 (evaluación asíncrona con `after()` dentro de `maxDuration`, sin cola). |
| `docs/adr/0008` | 2026-10-14 (Fase 7) | Precisa ADR-001 (calendario y métricas por página), ADR-002 (lectores Drizzle de solo lectura propios de `scheduling` y `analytics`) y ADR-007 (el calendario muestra solo el próximo vencimiento). |
| `docs/adr/0009` | 2026-10-26 (importación de documentos) | Precisa ADR-002 (reglas `mammoth-only-in-ingestion-infra` y `officeparser-only-in-ingestion-infra`; `upstash-only-in-ai-infra` admite `src/shared/rate-limit`), ADR-006 (catálogo estricto de contenido y paridad del editor con él) y ADR-011 (`frame-src` para `youtube-nocookie.com`); reemplaza `unpdf` como único extractor por mammoth y officeparser para Word y officeparser para PowerPoint y PDF (T8 retiró `unpdf` y su regla, sustituida por `no-in-process-pdfjs`). |

### Documento vivo

Este documento se actualiza a medida que avanza la construcción de Cogni; la nota de estado de esta sección es el punto de anclaje de esas actualizaciones. Cuando una fase posterior (por ejemplo, la Fase 9) tome una decisión que cambie una entrada, su Estado se actualizará con una nota fechada y una referencia al ADR numerado correspondiente.

### Correspondencia con las fases RAD

| Sección de este documento | Fase RAD | Uso en la tesis |
|---|---|---|
| ADR-001 a ADR-010 (decisiones de producto, stack, arquitectura y pruebas) | Planificación de requisitos / Construcción | Evidencia de que cada decisión fue tomada antes de programar y quedó verificada contra el código construido, incluidas las precisiones posteriores registradas en `docs/adr/`. |
| ADR-011 (política de seguridad: RLS y CSP) | Implementación | Sustenta las medidas de seguridad desplegadas, incluido el cambio de `style-src` aplicado durante el endurecimiento. |

---

## Índice de decisiones

| ID | Título | Estado | Origen |
|---|---|---|---|
| ADR-001 | Página como unidad de estudio y cuaderno como agrupación | Aceptado — implementado | `docs/adr/0001-decisiones-fundacionales.md` (ítem 1) |
| ADR-002 | Monolito modular con arquitectura hexagonal por módulo | Aceptado — implementado (14 reglas; excepción de lectores de `docs/adr/0008`) | `docs/adr/0001-decisiones-fundacionales.md` (ítem 4) |
| ADR-003 | Next.js con TypeScript estricto como framework de aplicación | Aceptado — implementado | `docs/adr/0001-decisiones-fundacionales.md` (ítem 5) |
| ADR-004 | Supabase Postgres con Drizzle ORM como capa de datos | Aceptado — implementado | `docs/documento-maestro.md` §4.1–§4.2 |
| ADR-005 | Supabase Auth con RLS y proxy de sesión | Aceptado — implementado | `docs/documento-maestro.md` §9 |
| ADR-006 | Tiptap como base del editor de bloques | Aceptado — implementado; precisado por `docs/adr/0009` (catálogo estricto) | `docs/adr/0001-decisiones-fundacionales.md` (ítem 3) |
| ADR-007 | SM-2 por ítem con nivel de dominio derivado por página | Aceptado — implementado (Fase 4) | `docs/adr/0001-decisiones-fundacionales.md` (ítem 2); precisado por `docs/adr/0005`, `docs/adr/0006`, `docs/adr/0007` y `docs/adr/0008` |
| ADR-008 | Vercel AI SDK con rotación multiproveedor y salida estructurada | Aceptado — implementado (Fase 3); lista de proveedores reemplazada por `docs/adr/0004` | `docs/adr/0001-decisiones-fundacionales.md` (ítem 6); actualizado por `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md` |
| ADR-009 | Vercel Hobby con Cloudflare DNS, Fluid Compute y Vercel Cron | Aceptado — implementado; precisado por `docs/adr/0003` y `docs/adr/0007` | `docs/documento-maestro.md` §4.2, §10 |
| ADR-010 | Estrategia de pruebas: TDD con Vitest, Playwright y dependency-cruiser | Aceptado — implementado | `docs/documento-maestro.md` §4.4 |
| ADR-011 | Política de seguridad: RLS y Content Security Policy | Aceptado — implementado (cambio de `style-src` aplicado) | `docs/documento-maestro.md` §9; decisión registrada en sesión de trabajo del 2026-09-24 (cambio de `style-src`) |

---

## ADR-001: Página como unidad de estudio y cuaderno como agrupación

### Estado

Aceptado — implementado. Actualización (2026-10-15): los ítems de estudio, el nivel de dominio, el calendario y las métricas del dashboard se agrupan por página (`study_items.page_id`, `page_mastery`, `docs/adr/0005` y `docs/adr/0008`).

### Contexto

Cogni es un producto individual (no colaborativo: `docs/documento-maestro.md` §1.2) construido por una sola persona con presupuesto de infraestructura cercano a cero. Antes de escribir código, el documento maestro cerró la jerarquía de contenido en `Usuario → Cuaderno → Página → {contenido, ítems de estudio}` (§3.1), fijando la página como unidad de estudio y el cuaderno como agrupación sin semántica de estudio ("opción B" del ADR fundacional). Esta decisión condiciona directamente el nivel de dominio derivado (RF-SE-02, implementado en la Fase 4), la asociación de un mazo de flashcards a exactamente una página (RF-FC-01, implementado en la Fase 4) y el esquema real de `src/shared/db/schema.ts` (`notebooks` sin columnas de contenido; `pages.content`/`plain_text` como única fuente de texto). Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Granularidad | Carga cognitiva (Sweller 1988, §2 documento maestro) | Complejidad en `study-engine` | Consistencia con la jerarquía real (`schema.ts`) |
|---|---|---|---|---|
| A. Cuaderno como unidad de estudio | Gruesa: todo el cuaderno genera un solo mazo/examen | Baja por sesión, pero mezcla temas distintos en un mismo repaso | Baja: un único estado agregado por cuaderno | No: `notebooks` no tiene columnas de contenido ni `plain_text` |
| B. Página como unidad de estudio (elegida) | Media: una clase o tema por página | Ajustada a fragmentar el contenido en unidades manejables | Media: un nivel de dominio derivado por página, agregando sus ítems | Sí: `pages.content`/`plain_text` son la única fuente de texto real |
| C. Bloque individual como unidad de estudio | Fina: cada párrafo/bloque genera ítems propios | Alta: fragmenta el contexto necesario para generar preguntas coherentes | Alta: un estado por bloque, recálculo ante cada edición | No: el editor no asigna identidad estable a un bloque individual |

### Decisión

**La página (tabla `pages`) es la unidad de estudio, y el cuaderno (tabla `notebooks`) es una agrupación sin semántica de estudio**, reflejando la jerarquía `owner → notebook → page` de `src/shared/db/schema.ts`.

### Justificación

- La página coincide con la unidad natural de contenido que un estudiante produce (apuntes de una clase o tema), consistente con la fragmentación en unidades manejables citada en `docs/documento-maestro.md` §2 (Sweller, 1988).
- `plain_text` se materializa por página (`extractPlainText`, RF-NB-06), dando a cada técnica de estudio un texto de origen ya delimitado y estable.
- El nivel de dominio (RF-SE-02) se deriva agregando los ítems de una página (`computeMastery` en `src/modules/study-engine/domain/mastery.ts`, tabla `page_mastery`) sin necesitar reglas adicionales sobre qué bloque pertenece a qué tema.
- **vs. cuaderno como unidad de estudio:** un cuaderno agrupa contenido heterogéneo (varias clases, incluso varias materias); generar un único mazo o examen por cuaderno mezclaría temas y reduciría la utilidad de la calibración metacognitiva (RF-AN-03, implementada en la Fase 7).
- **vs. bloque individual como unidad de estudio:** el editor no asigna una identidad estable a un bloque (los bloques Tiptap se reordenan y se fusionan libremente); generar ítems a nivel de bloque exigiría un mecanismo de identidad y sincronización que no existe hoy y fragmentaría el contexto necesario para preguntas de calidad.

### Consecuencias

**Positivas**

- `notebooks` permanece sin columnas de contenido, evitando duplicar `plain_text`/`content` en dos niveles de la jerarquía.
- La granularidad por página encaja 1:1 con la decisión de que cada mazo/examen/sesión pertenezca a exactamente una página (RF-FC-01), sin ambigüedad sobre a qué entidad pertenece un ítem de estudio.

**Negativas**

- Si una página mezcla varios temas, el nivel de dominio y los ítems generados heredan esa mezcla; no existe hoy, ni en las fases especificadas en el documento maestro, una forma de dividir una página en subtemas de estudio independientes.
- Un estudiante no puede compartir ítems de estudio entre dos páginas relacionadas de distintos cuadernos: cada mazo/examen pertenece a exactamente una página, lo que puede llevar a duplicar contenido de estudio si un tema aparece en más de un lugar.

**Mitigación**

Sin mitigación por ahora — el documento maestro no planifica este tipo de ajuste, y cualquier cambio requeriría un ADR futuro.

---

## ADR-002: Monolito modular con arquitectura hexagonal por módulo

### Estado

Aceptado — implementado. Actualización (2026-10-15): la decisión se tomó con 8 reglas `severity: "error"`; hoy `.dependency-cruiser.cjs` aplica 12, con `tsPreCompilationDeps: true` para que también cuenten los imports solo de tipos. Las cuatro reglas añadidas son `ai-sdk-only-in-ai-infra` (los paquetes `ai`/`@ai-sdk/*`/`@openrouter/ai-sdk-provider` solo en `ai/infrastructure`), `upstash-only-in-ai-infra` (`@upstash/*` solo en `ai/infrastructure`), `proxy-via-public-entry` (`src/proxy.ts` solo importa un módulo por `index.ts` o por una entrada ligera `proxy.ts`) y `domain-entry-is-pure` (una entrada pública de solo dominio, `calibration.ts`, solo reexporta su `domain/` o `src/shared/kernel`). Ver "Consecuencias actuales" para la estructura real de capas y la excepción de `docs/adr/0008`. Actualización (2026-10-26, `docs/adr/0009`): son 14 reglas; se añadieron `mammoth-only-in-ingestion-infra` y `officeparser-only-in-ingestion-infra` (las librerías de análisis de documentos solo en `ingestion/infrastructure`), y `upstash-only-in-ai-infra` admite también `src/shared/rate-limit`, el limitador por usuario que reutiliza `ingestion`.

### Contexto

Cogni se desarrolla con presupuesto de infraestructura cercano a cero y una sola persona (`docs/documento-maestro.md` §14, riesgo "una sola persona desarrollando"). RNF-M-02 exige verificar en integración continua que ningún módulo de dominio dependa de infraestructura, de un framework externo (salvo Zod) ni de otro módulo fuera de su índice público. La decisión de dividir el código en 11 módulos con capas hexagonales está heredada de `docs/adr/0001-decisiones-fundacionales.md` (ítem 4) y `docs/documento-maestro.md` §5.1–§5.3. Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Costo operativo | Verificabilidad automática de límites | Complejidad para un equipo de una persona | Aislamiento entre módulos |
|---|---|---|---|---|
| A. Monolito sin capas internas | Mínimo: un despliegue | Ninguna: nada impide que la UI importe Drizzle directamente | Baja al inicio, alta a mediano plazo por acoplamiento no contenido | Ninguno: todo el código comparte un mismo espacio de nombres |
| B. Microservicios por módulo | Alto: 11 servicios, 11 *pipelines* de CI/CD, orquestación de red | Alta, por fronteras de proceso | Muy alta: una persona debe operar y desplegar 11 servicios | Alto, a costa de latencia de red entre módulos que hoy se comunican en el mismo proceso |
| C. Monolito modular con arquitectura hexagonal (elegida) | Mínimo: un despliegue, sin configuración multiservicio en `vercel.json` | Alta: 8 reglas `severity: "error"` al decidir (12 a 2026-10-15) en `.dependency-cruiser.cjs`, ejecutadas en cada PR (`pnpm depcruise`) | Media: una sola base de código, límites internos explícitos | Alto en el código (`domain`/`application`/`infrastructure` por módulo, regla `cross-module-via-index`), sin el costo de red de B |

### Decisión

**Cogni es un monolito modular desplegado como una sola aplicación Next.js, dividido en 11 módulos bajo `src/modules/*`, cada uno con capas `domain/`, `application/`, `infrastructure/` y `ui/`, con los límites verificados automáticamente por 8 reglas de `severity: "error"` en `.dependency-cruiser.cjs`.** (Texto original de la decisión; la estructura de capas y el número de reglas vigentes están en el Estado y en "Consecuencias actuales".)

### Justificación

- Un solo despliegue en Vercel Hobby mantiene el costo de infraestructura en cero y evita que una persona deba operar múltiples servicios.
- Las 8 reglas originales de `.dependency-cruiser.cjs` (`domain-is-pure`, `domain-no-npm`, `application-no-infra-or-ui`, `ui-never-touches-infra`, `cross-module-via-index`, `editor-tiptap-only-in-ui`, `study-engine-knows-no-technique`, `unpdf-only-in-ingestion-infra`, sustituida en T8 de `docs/adr/0009` por `no-in-process-pdfjs`; hoy acompañadas por las 6 del Estado) convierten los límites de la arquitectura en errores de integración continua (RNF-M-02), no en convenciones que dependan de la disciplina del único desarrollador.
- La regla `cross-module-via-index` obliga a que todo acceso entre módulos pase por un `index.ts` público (p. ej. `src/modules/ingestion/infrastructure/notebooks-pages-adapter.ts` consume `notebooks` solo a través de `createNotebooksServerApi`), preservando el desacoplamiento propio de un límite de proceso sin pagar su costo de red.
- **vs. monolito sin capas internas:** nada impediría, sin estas reglas, que la UI de un módulo importara Drizzle u otro módulo por una ruta interna; la regla `no-in-process-pdfjs` (antes `unpdf-only-in-ingestion-infra`) documenta un riesgo concreto de este tipo: un segundo pdf.js cargado en el proceso del servidor rompe los análisis de officeparser, y la regla debe cubrir la ruta anidada de `node_modules` que resuelve `pnpm`.
- **vs. microservicios por módulo:** una persona no puede operar 11 servicios, 11 *pipelines* y la coordinación de red entre ellos con presupuesto cero; además, módulos reales se llaman entre sí en el mismo proceso hoy (`ingestion` → `src/modules/notebooks/server-api.ts`), algo que en microservicios exigiría una llamada de red o un bus de eventos.

### Consecuencias

**Positivas**

- Mover o refactorizar un módulo no requiere coordinar despliegues independientes.
- El costo de infraestructura permanece en cero, alineado con el presupuesto de una persona (`docs/documento-maestro.md` §14).

**Negativas**

- Un error en cualquier módulo puede afectar la aplicación completa: no hay aislamiento de fallos entre procesos, a diferencia de microservicios.
- Al registrar la decisión (2026-09-25), siete de los once módulos (`ai`, `study-engine`, `flashcards`, `exams`, `active-recall`, `scheduling`, `analytics`) eran esqueletos vacíos (`export {};`) y su arquitectura hexagonal era una intención, no un hecho verificado. Superado: los 11 módulos están implementados (ver "Consecuencias actuales").

**Mitigación**

Texto original: "cuando cada módulo se implemente, las mismas 8 reglas (con alcance `^src/modules/[^/]+/...`) lo cubrirán automáticamente sin cambios de configuración". Las reglas genéricas sí cubrieron los módulos nuevos sin cambios, pero la configuración cambió: se añadieron las 6 reglas del Estado y `tsPreCompilationDeps: true`.

**Consecuencias actuales (2026-10-15)**

- Los 11 módulos tienen `domain/` y `application/`; `ui/` existe solo en `identity`, `notebooks`, `editor` e `ingestion`, y `editor` no tiene `infrastructure/` (persiste a través de su puerto `SavePagePort`, que la página de `src/app/` arma con las Server Actions de `notebooks`). La interfaz de los módulos restantes vive en `src/app/`.
- Además de `index.ts`, hay dos entradas públicas permitidas: `src/modules/identity/proxy.ts` (entrada ligera que solo reexporta `updateSession`, para que `src/proxy.ts` no cargue el grafo `server-only` del índice; regla `proxy-via-public-entry`) y `src/modules/active-recall/calibration.ts` (entrada de solo dominio que expone `calibrationOf` a `analytics/application/get-calibration.ts`; reglas `cross-module-via-index` y `domain-entry-is-pure`).
- Excepción registrada en `docs/adr/0008` (punto 11): `scheduling` y `analytics` tienen lectores Drizzle propios de solo lectura (`src/modules/scheduling/infrastructure/drizzle-due-*-reader.ts`, `src/modules/analytics/infrastructure/drizzle-*-reader.ts`) sobre tablas de otros módulos (`study_items`, `review_logs`, `page_mastery`, `exam_answers`, `recall_answers`, entre otras), porque los casos de uso de las técnicas no ofrecen lecturas por dueño y rango. No viola ninguna regla (la frontera que verifica `dependency-cruiser` es de código, no de tablas), pero acopla esos lectores al esquema compartido de `src/shared/db/schema.ts`; nunca escriben.

---

## ADR-003: Next.js con TypeScript estricto como framework de aplicación

### Estado

Aceptado — implementado. Actualización (2026-10-15): la versión fijada en `package.json` es hoy `next` 16.3.8 (16.3.x; la decisión se registró con 16.3.5); React sigue en 19.2.8.

### Contexto

Con presupuesto cercano a cero y una sola persona a cargo tanto de la interfaz como del servidor, el documento maestro (`docs/documento-maestro.md` §4.1) y `docs/adr/0001-decisiones-fundacionales.md` (ítem 5) cierran el framework de aplicación antes de escribir código. RNF-M-01 exige TypeScript en modo estricto en todo el código fuente; múltiples requisitos funcionales (p. ej. RF-NB-05, RF-IN-03) dependen de Server Actions como único mecanismo de mutación. Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Despliegue en Vercel Hobby | Backend separado necesario | Server Actions / RSC | Compatibilidad con shadcn/ui y Tiptap |
|---|---|---|---|---|
| A. Backend Express/Fastify + SPA React | Requiere dos despliegues o enrutamiento manual | Sí: dos bases de código, dos ciclos de *release* | No: exige diseñar y mantener endpoints REST propios | Compatible, pero exige construir la capa de API que Next.js resuelve nativamente |
| B. SvelteKit / Remix | Soportado en Vercel | No | Remix tiene un equivalente (`action`); SvelteKit usa `+page.server.ts` | shadcn/ui y varias extensiones de Tiptap están escritas específicamente para React |
| C. Next.js (App Router) + TypeScript estricto (elegida) | Nativo: integración Git de Vercel, sin configuración adicional | No: un mismo framework sirve UI y Server Actions/Route Handlers | Sí: `"use server"` en cada `actions.ts` de módulo | Nativa: shadcn/ui y Tiptap/React se integran sin capa de adaptación |

### Decisión

**Next.js 16.3.x (16.3.5 al decidir; 16.3.8 medido en `package.json` el 2026-10-15) (App Router) con React 19.2.8 y TypeScript en modo estricto (`tsconfig.json`, `"strict": true`) es el framework de aplicación, usando Server Actions y Route Handlers en vez de una API REST separada.**

### Justificación

- Un solo framework cubre interfaz y lógica de servidor, evitando que una persona mantenga dos bases de código y dos *pipelines* de despliegue.
- Vercel despliega Next.js de forma nativa vía integración Git, sin configuración adicional, ajustado al presupuesto cero (`docs/documento-maestro.md` §4.2).
- shadcn/ui (copiado como código, no como dependencia) y las extensiones oficiales de Tiptap están escritas para React, descartando frameworks fuera de esa familia sin reescribir la capa de UI.
- TypeScript estricto detecta errores de tipos en compilación (RNF-M-01), reduciendo la necesidad de pruebas manuales exhaustivas por parte de un único desarrollador.
- **vs. backend separado (Express/Fastify) + SPA React:** duplicaría el trabajo de mantenimiento (dos *releases*, dos configuraciones de CI) sin una ventaja funcional que Next.js no ofrezca ya vía Route Handlers.
- **vs. SvelteKit/Remix:** ambos son viables técnicamente, pero exigirían reescribir o sustituir shadcn/ui y las extensiones de Tiptap ya integradas, un costo de migración no justificado frente al beneficio marginal sobre Next.js.

### Consecuencias

**Positivas**

- Server Components reducen el JavaScript enviado al cliente; Server Actions eliminan la necesidad de una capa de serialización REST intermedia para cada mutación.

**Negativas**

- Next.js 16 cambia APIs con frecuencia entre versiones mayores (`middleware.ts` renombrado a `proxy.ts`, documentado en el propio código: `src/proxy.ts`, comentario "Next.js 16 renamed middleware to proxy"); el proyecto depende de revisar la documentación embebida en cada actualización mayor.

**Mitigación**

`AGENTS.md` exige revisar `node_modules/next/dist/docs/` antes de escribir código en cada cambio relevante de versión; no existe mitigación adicional más allá de esta disciplina ya adoptada.

---

## ADR-004: Supabase Postgres con Drizzle ORM como capa de datos

### Estado

Aceptado — implementado. Actualización (2026-10-15): el esquema tiene 20 tablas (`pgTable` en `src/shared/db/schema.ts`) y 14 migraciones (`drizzle/0000` a `drizzle/0013`), 12 de ellas con `.down.sql`.

### Contexto

El presupuesto de infraestructura es cercano a cero y el plan gratuito de Supabase agrupa Postgres, Auth y Storage en un mismo proveedor (`docs/documento-maestro.md` §4.1–§4.2). RNF-P-05 exige como máximo una conexión de base de datos por instancia de función serverless, una restricción operativa del *pooler* de transacciones de Supabase que condiciona directamente la elección de driver/ORM. RNF-M-03 exige un script de reversión manual para migraciones no triviales. Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Costo | Compatibilidad con el *pooler* de transacciones (`prepare: false`) | Runtime | Control de SQL crudo (RLS de Storage) |
|---|---|---|---|---|
| A. Supabase Postgres + Prisma | Free tier | Requiere el *Data Proxy* o modo `pgbouncer` con configuración adicional | Node.js, con el motor de consultas en Rust incluido en el *bundle* | Prisma no introspecta `storage`; igualmente exigiría SQL crudo (`prisma db execute`) |
| B. Neon + driver serverless HTTP | Free tier | No aplica: arquitectura HTTP distinta, sin *pooler* de transacciones de Supabase | Compatible con *edge* | Migrar de proveedor completo, perdiendo Storage y Auth ya integrados de Supabase |
| C. Supabase Postgres + Drizzle ORM (elegida) | Free tier + paquete `postgres` (driver TCP) | Nativo: `postgres(url, { prepare: false, max: 1 })` | Node.js (`server-only`) | Directo: migraciones `.sql` a mano para `storage.objects`/`storage.buckets` |

### Decisión

**Supabase Postgres es la base de datos gestionada, accedida desde el servidor con el paquete `postgres` (driver TCP) y Drizzle ORM (`drizzle-orm/postgres-js`), con el cliente configurado como `postgres(url, { prepare: false, max: 1 })` en `src/shared/db/client.ts`.**

### Justificación

- Supabase agrupa Postgres, Auth y Storage en un mismo proveedor gratuito, evitando integrar tres servicios distintos.
- Drizzle infiere los tipos de TypeScript directamente del esquema (`ProfileRow`, `PageRow`, `ImportJobRow` en `src/shared/db/schema.ts`), sin un paso de generación de motor separado.
- `prepare: false` es obligatorio contra el *pooler* de transacciones de Supabase (las sentencias preparadas fallan silenciosamente sin él, según el comentario de `client.ts`); Drizzle sobre `postgres-js` expone esa opción sin capas adicionales.
- `max: 1` evita que una función serverless agote el pool compartido del plan gratuito (RNF-P-05), consistente con `playwright.config.ts` (`workers: 1`, comentario explícito sobre esta única conexión).
- **vs. Prisma:** exige el *Data Proxy* o configuración adicional de `pgbouncer` para operar de forma segura contra un *pooler* de transacciones, y su motor de consultas en Rust añade tamaño al *bundle* de una función serverless; ninguna de las dos limitaciones existe con `postgres-js`.
- **vs. Neon + driver serverless HTTP:** cambiar de proveedor de base de datos perdería la integración ya usada de Supabase Auth y Storage, obligando a reconstruir `identity/infrastructure` y las políticas RLS de Storage sin beneficio funcional adicional.

### Consecuencias

**Positivas**

- Los tipos de las 20 tablas reales (5 cuando se registró la decisión) se derivan automáticamente del esquema, evitando desincronización manual entre SQL y TypeScript.

**Negativas**

- `drizzle-kit` no tiene comando `down`; toda reversión de una migración es manual (12 de 14 migraciones tienen un `.down.sql` emparejado, aplicado a mano contra `cogni-dev`/`cogni-prod`; la creación inicial y la activación de RLS de `profiles` no lo requieren).
- Drizzle no introspecciona el esquema `storage`; las políticas RLS de Storage (`drizzle/0004_page_assets_storage.sql`, `drizzle/0006_page_pdfs_storage.sql`) están escritas como SQL crudo fuera del sistema de tipos de Drizzle.

**Mitigación**

Cada migración con reversión no trivial documenta su propio `.down.sql` con instrucciones explícitas de aplicación manual (psql o el editor SQL de Supabase); no existe mitigación automatizada para la ausencia de `down` en la propia herramienta.

### Diseño

Configuración real del cliente, con la restricción del *pooler* fijada en código (no en una variable de entorno) para que no pueda omitirse por accidente:

```ts
// src/shared/db/client.ts
function createDb() {
  const sql = postgres(serverEnv().DATABASE_URL, { prepare: false, max: 1 });
  return drizzle(sql, { schema });
}
```

---

## ADR-005: Supabase Auth con RLS y proxy de sesión

### Estado

Aceptado — implementado.

### Contexto

RF-ID-01 a RF-ID-07 exigen registro con correo y contraseña, Google OAuth, verificación de correo y recuperación de contraseña; RNF-S-04 exige redirigir a `/login` cualquier solicitud sin sesión activa, salvo las rutas de autenticación, el callback de autenticación, las rutas abiertas y las que se autentican por su cuenta. El documento maestro (§9) cierra Supabase Auth como mecanismo de identidad antes de escribir código, dentro del mismo proveedor gratuito ya elegido para Postgres y Storage (ADR-004). Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Costo | Google OAuth listo para usar | Integración con RLS de Postgres/Storage | Esfuerzo de mantenimiento propio |
|---|---|---|---|---|
| A. NextAuth.js / Auth.js | Gratuito (biblioteca) | Sí, requiere configurar el proveedor y una base de datos de adaptador propia | Ninguna nativa; exigiría replicar el `user.id` hacia Postgres para políticas RLS | Medio: adaptador de base de datos y esquema de sesión propios |
| B. Identidad construida a mano | Gratuito, sin proveedor gestionado | No: habría que implementar el flujo OAuth de Google desde cero | Ninguna: RLS tendría que verificar contra una tabla de sesiones propia | Alto: hashing de contraseñas, tokens y expiración bajo responsabilidad propia |
| C. Supabase Auth (elegida) | Incluido en el plan Free de Supabase | Sí, configuración de proveedor sin código adicional | Nativa: `auth.uid()` disponible en las políticas RLS de Storage | Bajo: `@supabase/ssr` gestiona la sesión por cookies |

### Decisión

**Supabase Auth gestiona identidad (correo/contraseña con verificación y Google OAuth), con la sesión mantenida por cookies vía `@supabase/ssr` y refrescada en cada petición por `src/proxy.ts`.**

### Justificación

- Supabase Auth expone `auth.uid()` de forma nativa a las políticas RLS de Storage (`drizzle/0004_page_assets_storage.sql`, `drizzle/0006_page_pdfs_storage.sql`), evitando sincronizar manualmente un identificador de sesión hacia Postgres.
- `@supabase/ssr` resuelve la sesión por cookies en `src/proxy.ts` (`updateSession`), que redirige a `/login` a cualquier visitante sin sesión salvo en las rutas de autenticación, el callback de autenticación, las rutas abiertas (`/terminos`) y las que se autentican por su cuenta, como los pings de cron y los reportes de errores (RNF-S-04), como defensa perimetral única.
- `src/app/(app)/layout.tsx` vuelve a llamar `getCurrentUser()` como "defensa en profundidad" (comentario del código), aceptando redundancia deliberada sobre un único punto de fallo.
- **vs. NextAuth.js/Auth.js:** exigiría mantener un adaptador de base de datos propio y replicar el identificador de usuario hacia Postgres para que las políticas RLS de Storage lo reconocieran, trabajo que Supabase Auth resuelve de forma nativa.
- **vs. identidad construida a mano:** implicaría implementar y mantener el flujo OAuth de Google, el *hashing* de contraseñas y la expiración de sesiones sin un proveedor gestionado, un costo no justificado para un equipo de una persona.

### Consecuencias

**Positivas**

- RLS de Storage funciona sin sincronización manual de identidad; la verificación de correo y la recuperación de contraseña (RF-ID-03, RF-ID-04) llegan sin código adicional.

**Negativas**

- Acopla la identidad del producto a un proveedor externo; migrar de proveedor implicaría reescribir por completo `identity/infrastructure` (`supabase-auth-gateway.ts`, `supabase-proxy-client.ts`, `supabase-server-client.ts`, `supabase-browser-client.ts`) y las políticas RLS de Storage que dependen de `auth.uid()`.

**Mitigación**

El puerto `AuthGateway` (`src/modules/identity/domain/auth-gateway.ts`) aísla el resto del módulo `identity` de la API concreta de Supabase; una migración de proveedor reemplazaría solo la capa `infrastructure`, no `domain`/`application`. La dependencia de Storage RLS con `auth.uid()` queda sin mitigación por ahora.

---

## ADR-006: Tiptap como base del editor de bloques

### Estado

Aceptado — implementado. Actualización (2026-10-26, `docs/adr/0009`): el contenido importado se valida contra un catálogo estricto de nodos, marcas y atributos de Tiptap (`src/shared/kernel/tiptap-catalogue.ts`, esquema `tiptapContentSchema` de `notebooks`); el editor registra todo ese catálogo (se añadieron detalles, YouTube, color de fondo, familia, tamaño e interlineado de fuente y el texto alternativo de la imagen) y una prueba de paridad (`src/modules/editor/ui/tiptap/extensions/catalogue-parity.test.ts`) mantiene idénticos el esquema del editor y el catálogo. Nuevas dependencias exactas: `@tiptap/extension-details` y `@tiptap/extension-youtube` (`3.31.3`).

### Contexto

RF-ED-01 a RF-ED-07 exigen un editor de bloques con autoguardado, menú `/`, barra de herramientas contextual, manejador de arrastre y subida de imágenes. `docs/adr/0001-decisiones-fundacionales.md` (ítem 3) y `docs/documento-maestro.md` §3.2 cierran Tiptap como motor del editor antes de escribir código, descartando explícitamente construirlo desde cero. Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Costo | Cobertura de bloques mínimos (RF-ED-02) | Aislamiento arquitectónico | Madurez de extensiones |
|---|---|---|---|---|
| A. BlockNote | La plantilla con experiencia estilo Notion completa (menú `/`, manejador de arrastre) es de pago | Alta lista para usar, pero limitada a lo que la plantilla expone | Ninguna ganancia sobre Tiptap: BlockNote está construido sobre Tiptap/ProseMirror | Alta para el caso genérico, pero cerrada a la plantilla |
| B. ProseMirror puro (sin Tiptap) | Gratuito | Ninguna: cada bloque (tablas, callouts, resaltado) se construiría desde cero | Total, a costa de reescribir el sistema de extensiones y esquema que Tiptap ya resuelve | Ninguna: ProseMirror es de bajo nivel, sin catálogo de extensiones oficiales |
| C. Tiptap (headless sobre ProseMirror, elegida) | Extensiones oficiales de código abierto (`@tiptap/extension-*`), sin plantilla de pago | Alta: encabezados, listas, tablas, código con resaltado, menú `/`, barra contextual y manejador de arrastre como extensiones oficiales en `package.json`; callouts e imágenes como nodos propios en `src/modules/editor/ui/tiptap/` | Confinable: regla `editor-tiptap-only-in-ui` de `.dependency-cruiser.cjs` | Alta: extensiones oficiales mantenidas activamente |

### Decisión

**El editor de bloques se construye sobre Tiptap 3 (`@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit` y extensiones oficiales), confinado a `editor/ui` por la regla `editor-tiptap-only-in-ui` de `.dependency-cruiser.cjs`, con la experiencia estilo Notion (menú `/`, manejador de arrastre, barra contextual) construida sobre extensiones gratuitas.**

### Justificación

- Tiptap headless permite construir la experiencia estilo Notion sin depender de una plantilla de pago, usando extensiones oficiales de código abierto (`@tiptap/extension-drag-handle`, `@tiptap/extension-bubble-menu`, `@tiptap/suggestion` para el menú `/`).
- La regla `editor-tiptap-only-in-ui` aísla Tiptap y ProseMirror en `editor/ui`; el dominio y la aplicación del editor (`autosave-state.ts`, `use-autosave.ts`) permanecen libres de esta dependencia y son verificables sin un DOM real.
- Varias extensiones (`@tiptap/extension-drag-handle`, `@tiptap/extension-node-range`, `@tiptap/extensions`) están fijadas a la versión exacta `3.31.3` (sin `^`) en `package.json`, señal explícita de incompatibilidades conocidas entre versiones menores.
- **vs. BlockNote:** su experiencia estilo Notion completa requiere una plantilla de pago; además está construido sobre Tiptap/ProseMirror, por lo que adoptarlo no evita la dependencia de fondo, solo añade una capa de licenciamiento.
- **vs. ProseMirror puro:** exigiría reescribir el sistema de extensiones, el esquema del documento y el manejo de estado que Tiptap ya resuelve, sin ganancia funcional para un equipo de una persona.

### Consecuencias

**Positivas**

- Bloques mínimos completos (RF-ED-02) con extensiones oficiales activamente mantenidas; el dominio del editor permanece agnóstico del motor de edición de texto.

**Negativas**

- Fijar extensiones a una versión exacta (`3.31.3`) significa que una corrección de un error o de seguridad en una versión menor posterior no se recibe automáticamente; requiere una actualización manual coordinada de todas las extensiones fijadas a la vez.

**Mitigación**

`pnpm audit --audit-level=high` (RNF-S-08) sigue auditando estas dependencias fijas en cada integración continua; no existe, más allá de eso, un proceso automatizado de actualización coordinada.

---

## ADR-007: SM-2 por ítem con nivel de dominio derivado por página

### Estado

Aceptado — implementado en la Fase 4 (PR #71–#77). Actualización (2026-10-15): `applySm2` (`src/modules/study-engine/domain/sm2.ts`) y `computeMastery` (`src/modules/study-engine/domain/mastery.ts`) son funciones puras con pruebas unitarias (`sm2.test.ts`, `mastery.test.ts`); el estado vive en las tablas `study_items`, `review_logs` y `page_mastery` (migración `drizzle/0009_study_engine.sql`), y el dominio de cada página se recalcula en cada calificación y una vez al día en `/api/recompute-mastery`. Las decisiones de implementación están en `docs/adr/0005`; `docs/adr/0006` (exámenes), `docs/adr/0007` (calidad combinada de recordación activa) y `docs/adr/0008` (calendario con solo el próximo vencimiento) las precisan. Los umbrales de dominio (0,35 / 0,7) tienen una única fuente en `src/shared/kernel/mastery-thresholds.ts`.

### Contexto

Al registrar la decisión (2026-09-25), `src/modules/study-engine` era un esqueleto (`export {};`) y esta decisión era especificación heredada de `docs/adr/0001-decisiones-fundacionales.md` (ítem 2, "opción C") y `docs/documento-maestro.md` §7 (fórmulas SM-2 por ítem, nivel de dominio por página). Los requisitos que dependen de ella (RF-SE-01, RF-SE-02, RF-SE-03, RF-SE-04) estaban marcados Roadmap en `01-SRS.md`; hoy figuran como Implementados (Fase 4). El documento maestro cita a Wozniak (1987) como base y reserva FSRS como evaluación futura explícita (§2). Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Granularidad de repaso | Simplicidad para TDD 100 % (Fase 4, §4.4) | Evidencia citada (§2 documento maestro) | Compatible con 3 técnicas bajo un motor único |
|---|---|---|---|---|
| A. SM-2 por página completa (un único estado agregado) | Baja: toda la página se repasa junta aunque solo un ítem esté vencido | Alta simplicidad algorítmica, pero pierde la señal de qué ítem falló | Wozniak (1987) sigue aplicando, pero ignora la recuperación por ítem individual | Difícil: mezclar la calidad de flashcards, exámenes y recordación activa en un solo estado por página pierde la señal de qué técnica falló |
| B. Motor FSRS en vez de SM-2 | Alta (por ítem, como C) | Menor: FSRS tiene más parámetros y mayor superficie de prueba que SM-2 | El documento maestro cita a Wozniak (1987) como base ya evaluada; FSRS se menciona solo como evolución futura ("FSRS se evalúa como evolución en un ADR posterior.", §2, tabla de fundamentos) | Sí, pero no evaluado ni implementado en ningún código o especificación actual |
| C. SM-2 por ítem, dominio derivado por página (elegida) | Alta: cada flashcard/pregunta tiene su propio estado (`n`, `EF`, `due_at`) | Alta: fórmulas cerradas y deterministas (§7.1) | Wozniak (1987) citado explícitamente | Sí: `study-engine` es agnóstico de técnica por diseño (regla `study-engine-knows-no-technique`), cada técnica solo mapea su resultado a una calidad `q` 0–5 |

### Decisión

**Cada ítem de estudio (flashcard, pregunta de examen, pregunta de recordación activa) mantendrá su propio estado SM-2 (`n`, `EF`, `due_at`, `lapses`), y el nivel de dominio de una página (Nuevo/Aprendiendo/Consolidando/Dominado) se derivará agregando el estado de sus ítems, según las fórmulas de `docs/documento-maestro.md` §7.1 y §7.3.**

### Justificación

- SM-2 por ítem preserva la señal de qué pregunta o tarjeta específica falló, en vez de diluirla en un único estado por página (RF-SE-01).
- El nivel de dominio derivado (RF-SE-02) reutiliza la página como unidad de estudio (ADR-001) sin introducir una segunda jerarquía de agregación.
- `study-engine` es agnóstico de técnica por diseño (RF-SE-04, regla `study-engine-knows-no-technique` de `.dependency-cruiser.cjs`, activa en CI desde antes de que el módulo tuviera código), lo que exige un modelo de ítem uniforme (calidad `q` 0–5) independiente de la técnica de origen.
- **vs. SM-2 por página completa:** perdería la posibilidad de saber qué ítem concreto necesita repaso dentro de una página con muchos ítems, y complicaría mezclar la calidad de tres técnicas distintas en un único estado.
- **vs. FSRS:** el documento maestro cita a Wozniak (1987, SM-2) como base científica ya evaluada y reserva FSRS como evaluación futura explícita ("FSRS se evalúa como evolución en un ADR posterior.", §2, tabla de fundamentos); adoptarlo ahora añadiría parámetros y superficie de prueba sin evidencia de que mejore el resultado para un producto todavía sin usuarios.

### Consecuencias

**Positivas**

- El mismo motor sirve a las tres técnicas sin duplicar lógica de repetición espaciada; las fórmulas son deterministas y se verifican con pruebas unitarias puras (`applySm2` y `computeMastery` son funciones puras).

**Negativas**

- Al registrar la decisión, era pura especificación: no existía código, tablas ni pruebas de las fórmulas de §7.1/§7.3. Superado en la Fase 4 (ver Estado).

**Mitigación**

Texto original: "la Fase 4 (§13 del documento maestro) implementa esta decisión con TDD estricto en el dominio". Cumplido: las fórmulas se verifican con pruebas unitarias puras sobre `applySm2` y `computeMastery`.

**Consecuencias actuales (2026-10-15)**

- La meta de cobertura del 100 % para SM-2 y el dominio (`docs/documento-maestro.md` §4.4) no se exige automáticamente: `vitest.config.ts` configura `coverage` (proveedor `v8`, informes `text` y `html`) sin `thresholds`, de modo que ningún umbral bloquea un *pull request* (ver ADR-010).
- El mismo motor sirve a las tres técnicas mediante `study_items.kind` (`flashcard`, `exam_question`, `recall_question`), sin que `study-engine` conozca ninguna técnica (regla `study-engine-knows-no-technique`).

---

## ADR-008: Vercel AI SDK con rotación multiproveedor y salida estructurada

### Estado

Aceptado — implementado en la Fase 3 (PR #63–#69). **La lista de proveedores de la decisión original está reemplazada por `docs/adr/0004`:** Google AI Studio (Gemini, `@ai-sdk/google`), Cloudflare Workers AI (`@ai-sdk/openai-compatible`) y OpenRouter (`@openrouter/ai-sdk-provider`) para generación, en ese orden de *fallback*; Groq (`@ai-sdk/groq`) registrado solo para evaluación; Mistral y Cerebras descartados. Las secciones Contexto, Opciones, Decisión y Justificación conservan el análisis original; las partes reemplazadas se marcan en el texto y "Consecuencias actuales" describe el código.

### Contexto

Al registrar la decisión (2026-09-25), `src/modules/ai` era un esqueleto (`export {};`) y ningún paquete `ai`/`@ai-sdk/*` existía en `package.json` (hoy: `ai` 7.0.127, `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/openai-compatible` y `@openrouter/ai-sdk-provider`). Esta decisión era especificación heredada de `docs/adr/0001-decisiones-fundacionales.md` (ítem 6) y de `docs/documento-maestro.md` §3.7 (la IA no es un chat, funciones acotadas), §4.3 (cinco proveedores con nivel gratuito) y §8 (principios, registro de proveedores, propósitos y esquemas). Los requisitos RF-AI-01 a RF-AI-05 estaban marcados Roadmap en `01-SRS.md`; hoy figuran como Implementados (Fase 3). Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Costo | Salida estructurada validada con Zod | Acoplamiento a un proveedor | Integración con Server Actions |
|---|---|---|---|---|
| A. LangChain.js | Multiproveedor, con una capa de abstracción más pesada (cadenas, agentes) no necesaria aquí | Soporta salida estructurada, con una API más verbosa para el caso simple "un esquema, un resultado" | Bajo, similar al elegido | Requiere adaptar sus abstracciones al modelo de Server Actions, más código de integración |
| B. SDKs nativos por proveedor | Igual costo, cada proveedor con su propio esquema de configuración | Cada proveedor valida su salida de forma distinta; exigiría una capa Zod construida a mano por proveedor | Alto: cada punto de uso conocería la forma exacta de la respuesta de cada proveedor | Ninguna ayuda nativa; toda la integración se escribe a mano |
| C. Vercel AI SDK con rotación multiproveedor (elegida) | Multiproveedor, cada uno con nivel gratuito propio (al decidir: Google AI Studio, Groq, Mistral, OpenRouter `:free`, Cerebras; lista reemplazada por `docs/adr/0004`) | Nativa: `generateObject` con esquema Zod | Ninguno: un mismo contrato (`ai.application`) cambia de proveedor sin tocar el resto del código | Nativa, pensada para Server Actions/Route Handlers |

### Decisión

**La capa de IA (roadmap, Fase 3) se construirá sobre Vercel AI SDK, con un `ProviderRegistry` que rota entre Google AI Studio, Groq, Mistral, OpenRouter y Cerebras por cuota, y `generateObject` con esquema Zod como única forma de obtener una salida de un proveedor de IA.** (Texto original. Reemplazado por `docs/adr/0004` en la lista de proveedores: la rotación real es Gemini → Cloudflare Workers AI → OpenRouter, con Groq solo para evaluación.)

### Justificación

- Ningún módulo de negocio (`flashcards`, `exams`, `active-recall`) importaría el SDK de un proveedor directamente; todos pasarían por `ai.application` (RF-AI-01, principio 1 de §8.1 del documento maestro), aislando el resto del código de un cambio de proveedor.
- `generateObject` fuerza que toda salida de IA sea JSON validado contra un esquema Zod (RF-AI-01), nunca texto libre, alineado con la regla `domain-no-npm` que ya permite Zod como única dependencia dentro de `domain/`.
- La rotación entre proveedores con nivel gratuito (5 al decidir; 3 de generación más Groq para evaluación según `docs/adr/0004`) mitiga directamente el riesgo de mayor probabilidad e impacto documentado en `docs/documento-maestro.md` §14 ("Tiers gratuitos de IA cambian o desaparecen").
- **vs. LangChain.js:** su capa de abstracción (cadenas, agentes, memoria) resuelve problemas que Cogni no tiene ("no es un chat", §3.7); adoptarla añadiría superficie de aprendizaje y de errores sin necesidad funcional.
- **vs. SDKs nativos por proveedor:** exigiría escribir y mantener a mano una capa de validación Zod distinta por cada uno de los 5 proveedores, exactamente el trabajo que Vercel AI SDK resuelve con un contrato único (`generateObject`).

### Consecuencias

**Positivas**

- Un proveedor caído o sin cuota no detiene la generación mientras exista al menos un proveedor sano en la rotación (RF-AI-02).

**Negativas**

- Al registrar la decisión, era especificación sin código, pruebas ni proveedores configurados, y la rotación por cuota dependía de un limitador de tasa aún no decidido. Superado en la Fase 3 (ver Estado y "Consecuencias actuales").

**Mitigación**

Texto original: "la Fase 3 implementa esta decisión; el 'Hecho cuando' definido es explícito: 'cuota agotada de un proveedor, sigue funcionando con el siguiente'". Cumplido con la rotación de `src/modules/ai/infrastructure/provider-registry.ts`.

**Consecuencias actuales (2026-10-15)**

- Solo `src/modules/ai/infrastructure/` puede importar `ai`, `@ai-sdk/*`, `@openrouter/*` y `@upstash/*` (reglas `ai-sdk-only-in-ai-infra` y `upstash-only-in-ai-infra`, ver ADR-002); el resto del código pasa por `ai.application`.
- Las cuotas por proveedor, el *circuit breaker* (tres fallos consecutivos dejan al proveedor fuera durante 10 minutos) y los límites por usuario viven en Upstash Redis, según `docs/adr/0004`.
- `generateObject` está marcado `@deprecated` en `ai@7` en favor de `generateText` con salida estructurada; `src/modules/ai/infrastructure/ai-sdk-provider.ts` lo sigue usando porque sigue disponible y es la llamada que fija esta decisión (el comentario del código indica revisarlo cuando se elimine); una actualización futura del SDK tendrá que sustituirlo en ese único adaptador.

---

## ADR-009: Vercel Hobby con Cloudflare DNS, Fluid Compute y Vercel Cron

### Estado

Aceptado — implementado. Actualización (2026-10-15), precisada por `docs/adr/0003` y `docs/adr/0007`:

- `vercel.json` declara dos tareas de Vercel Cron: `/api/keep-alive` (`0 6 * * *`) y `/api/recompute-mastery` (`30 6 * * *`), ambas autenticadas con `CRON_SECRET` comparado con `timingSafeEqual`.
- El tope por función ya no es único: `maxDuration = 120` en la página de importación de PDF (`src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx`) y en la de exámenes (`src/app/(app)/exams/[notebookId]/[pageId]/page.tsx`); `maxDuration = 300` en `/api/recompute-mastery` y en las páginas de recordación activa (sesión y resultados). 300 s es el máximo de Fluid Compute en Hobby fijado por `docs/adr/0003`.
- Existe trabajo asíncrono dentro de la misma función, sin cola: la evaluación de recordación activa se programa con `after()` tras cerrar la sesión y corre dentro del `maxDuration` de la ruta, con reclamo de respuestas pendientes y retoma de reclamos vencidos (`docs/adr/0007`).

### Contexto

Cogni opera con presupuesto de infraestructura cercano a cero (`docs/documento-maestro.md` §4.2) y una sola persona disponible para operar cualquier servicio adicional. Al decidir, dos necesidades de trabajo en segundo plano eran reales (hoy son cuatro, con el recálculo diario del dominio y la evaluación de recordación activa; ver el Estado): procesar una importación de PDF que puede tardar más que una petición HTTP típica (RF-IN-04, tope de 120 segundos) y mantener vivo el proyecto gratuito de Supabase, que se pausa tras aproximadamente 7 días de inactividad (RNF-F-01). `src/modules/ingestion/README.md` documenta explícitamente que no existe un *worker* separado para la primera necesidad. Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Costo | Presupuesto de ejecución disponible | Complejidad operativa (equipo de 1 persona) | Servicios/despliegues adicionales |
|---|---|---|---|---|
| A. Cola de trabajos / servicio de *worker* gestionado | Nivel gratuito limitado en la mayoría de proveedores de colas administradas; superado ese límite es un costo recurrente | Alto, pensado para tareas largas y reintentos | Alta: requiere configurar cola, *worker*, reintentos y observabilidad de un sistema adicional | Sí: al menos un servicio de cola y un proceso *worker* separado del despliegue de Next.js |
| B. *Worker* autoalojado (proceso Node.js propio 24/7) | Una VM o contenedor con costo recurrente, o un nivel gratuito con límites de horas/CPU | Sin límite práctico de duración de tarea | Alta: exige mantener el proceso vivo, reinicios, *logs* y parcheo del sistema operativo | Sí: un servicio de cómputo separado de Vercel |
| C. Tabla de trabajos consultada por *cron* (*job table* + *polling*) | Gratuito con Vercel Cron y Postgres ya existente | Limitado por la frecuencia mínima de *cron* de Vercel Hobby (una vez al día) y por el mismo tope de `maxDuration` de cada invocación que la procesa | Media: sin servicio adicional, pero exige lógica de "reclamar" filas y manejar reintentos con concurrencia | No, pero introduce latencia: el trabajo espera al siguiente disparo de *cron* en vez de procesarse al instante |
| D. Vercel Fluid Compute + Vercel Cron (elegida) | Gratuito en el plan Hobby, sin servicio adicional | 120 s por invocación (`maxDuration = 120`), suficiente para el criterio "hecho cuando" de un PDF de 30 páginas en menos de 60 s (Fase 2, §13) | Baja: un solo despliegue, sin proceso ni cola adicional que operar | No: `vercel.json` añade *crons* declarativos (al decidir, solo `/api/keep-alive`, diario; hoy también `/api/recompute-mastery`) |

### Decisión

**El trabajo en segundo plano y programado de Cogni corre dentro de la misma aplicación Vercel: la importación de PDF se procesa de forma síncrona dentro de la Server Action de la página, bajo un presupuesto explícito `maxDuration = 120` (Vercel Fluid Compute), y la tarea programada que mantiene vivo el proyecto gratuito de Supabase corre vía Vercel Cron (`vercel.json`, `0 6 * * *`) contra el Route Handler `/api/keep-alive`, autenticado con un secreto comparado en tiempo constante.**

### Justificación

- El criterio "hecho cuando" de la Fase 2 (`docs/documento-maestro.md` §13: "un PDF de 30 páginas con capa de texto termina como página editable en <60s") cabe dentro del presupuesto de 120 segundos de una invocación de Fluid Compute (RF-IN-04, RNF-P-01), sin necesitar un mecanismo externo de colas.
- `src/modules/ingestion/README.md` documenta explícitamente que no existe un *worker* separado: `processImportJob` corre dentro de la misma invocación que atendió la solicitud, simplificando el modelo a "una función, un trabajo, un resultado o un error".
- Vercel Cron declara la tarea programada como una línea en `vercel.json` (`{ "path": "/api/keep-alive", "schedule": "0 6 * * *" }`), sin un servicio de colas ni un proceso adicional que una sola persona deba operar.
- `/api/keep-alive` autentica el disparo de *cron* con `timingSafeEqual` sobre `CRON_SECRET` (RNF-S-06), evitando que el endpoint sea invocable por cualquiera que adivine la ruta.
- **vs. cola de trabajos / servicio de *worker* gestionado:** añadiría un segundo servicio con su propia configuración, cuota y observabilidad, para una carga de trabajo (una importación de PDF ocasional, un *ping* diario) que hoy no justifica esa complejidad ni su costo fuera del nivel gratuito.
- **vs. *worker* autoalojado:** exigiría mantener un proceso vivo 24/7 (parches, reinicios, *logs*) fuera de la plataforma ya usada para el resto de la aplicación, sin presupuesto ni tiempo de una persona para operarlo con la misma disciplina que un despliegue serverless.
- **vs. tabla de trabajos consultada por *cron*:** introduciría latencia (el estudiante esperaría al siguiente disparo de *cron* para ver su PDF procesado, no un resultado inmediato) y lógica adicional de reclamar filas con seguridad ante condiciones de carrera, cuando el propio `ImportJob` ya modela el progreso sin necesitar ese mecanismo de sondeo para el caso de uso actual.

### Consecuencias

**Positivas**

- Cero servicios adicionales que operar o pagar; el estudiante ve el resultado de su importación de PDF de inmediato, sin esperar un ciclo de sondeo.

**Negativas**

- El presupuesto de 120 segundos de la importación de PDF es un tope duro por invocación (el texto original lo planteaba como tope general; hoy las rutas de recordación activa y `/api/recompute-mastery` usan 300 s, ver Estado); un PDF que se acerque al límite (por tamaño, número de páginas o lentitud transitoria del extractor) falla con `timeout` (RF-IN-08) en vez de reintentarse automáticamente en segundo plano, y no existe hoy ningún mecanismo de reintento asíncrono más allá de que el estudiante vuelva a importar el archivo.
- Vercel Cron en el plan Hobby limita la frecuencia mínima de una tarea programada a una vez al día, por lo que un trabajo que necesite ejecutarse con mayor frecuencia no cabría en este mecanismo sin cambiar de plan. Actualización (2026-10-15): el recálculo que el texto original ponía como ejemplo sí cabe, porque corre una vez al día (`/api/recompute-mastery`, `30 6 * * *`) y los vencimientos no necesitan recálculo intradiario: cada `study_items.due_at` se fija al responder y las vistas consultan `due_at <= now` en vivo.

**Mitigación**

`ABANDONED_AFTER_MS` (`(MAX_DURATION_S + 30) * 1000` = 150 000 ms, en `src/modules/ingestion/domain/import-budget.ts`) permite detectar un `ImportJob` abandonado tras un tiempo razonable. Actualización (2026-10-15): la detección se usa al leer, no por un proceso de limpieza: `GetImportJobStatus` (`src/modules/ingestion/application/get-import-job-status.ts`) informa como `failed(timeout)` un trabajo abandonado según `isAbandoned`, y `DrizzleImportJobRepository.listActivePageIds` excluye los trabajos más antiguos que `ABANDONED_AFTER_MS`. Ningún proceso automático borra o reintenta esos trabajos.

---

## ADR-010: Estrategia de pruebas: TDD con Vitest, Playwright y dependency-cruiser

### Estado

Aceptado — implementado. Actualización (2026-10-15):

- Conteos medidos (los mismos de RNF-M-05 en `01-SRS.md`): más de 400 archivos de prueba de Vitest, 456 en total (411 bajo `src`, 5 bajo `tests/proxy` y `tests/identity`, 40 de integración con base de datos bajo `tests/db`), y 31 especificaciones de Playwright bajo `tests/e2e`. `dependency-cruiser` aplica 12 reglas (ver ADR-002).
- Dónde corre cada suite: `.github/workflows/pr.yml` ejecuta en cada PR Biome, `tsc --noEmit`, `pnpm test`, `pnpm depcruise` y `pnpm audit`, sin secretos, para que los *forks* y Dependabot tengan la misma puerta. Playwright y `pnpm test:db` corren solo en `.github/workflows/main.yml`, al hacer *push* a `main`, contra `cogni-dev` (`docs/documento-maestro.md` §4.4: "Playwright en main"). La ejecución de la suite completa de Playwright en local antes de cada PR es una práctica del equipo, no una puerta automática.
- Un fallo de Playwright en `main` no bloquea el despliegue: la integración Git de Vercel construye y despliega `main` por su cuenta, y `main.yml` es la verificación que se revisa antes de confiar en producción (comentario de cabecera de `main.yml`).
- Desfase conocido: el comentario de `playwright.config.ts` todavía dice que Playwright cubre "the 3-5 critical end-to-end flows"; la suite real tiene 31 especificaciones.

### Contexto

Cogni se construye con TDD estricto declarado para el dominio (`docs/documento-maestro.md` §4.4) por una sola persona sin equipo de control de calidad separado. RNF-M-05 exige una suite de pruebas unitarias/de integración y una de extremo a extremo ejecutadas en integración continua, y RNF-M-02 exige verificar automáticamente las reglas de dependencia entre capas del monolito modular (ADR-002). Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Velocidad en CI | Compatibilidad con el stack (Vite/Next.js) | Verificación automática de arquitectura | Cobertura del dominio sin navegador |
|---|---|---|---|---|
| A. Jest + Cypress, sin prueba de arquitectura | Jest más lento que Vitest en un proyecto con ESM/Vite; Cypress más pesado que Playwright para CI *headless* | Requiere configuración adicional de transformadores para ESM/TS que Vitest resuelve de forma nativa | Ninguna: sin una herramienta equivalente a `dependency-cruiser`, las reglas de capas dependerían de revisión manual | Sí, equivalente a la opción elegida |
| B. Solo Playwright (e2e), sin pruebas unitarias de dominio | Más lenta por corrida: arranca un navegador real por escenario | Compatible, pero no aprovecha que el dominio (`domain-no-npm`) es puro y no necesita navegador | Ninguna | Ninguna: probar SM-2 o `textToBlocks` solo por e2e sería indirecto y lento |
| C. Vitest + Playwright + dependency-cruiser (elegida) | Vitest comparte el motor de Vite, arranque rápido; Playwright limitado a 8 especificaciones críticas al decidir (31 a 2026-10-15) | Nativo: mismo alias `@` que `tsconfig.json`, mismo entorno `jsdom` | `pnpm depcruise` aplica las reglas de `.dependency-cruiser.cjs` (8 al decidir, 12 hoy) en cada PR y en `main` | Alta: 134 archivos `*.test.ts(x)` bajo `src` al decidir (411 a 2026-10-15), incluyendo dominio puro sin `jsdom` cuando no se necesita DOM |

### Decisión

**La estrategia de pruebas combina Vitest para pruebas unitarias y de integración (134 archivos bajo `src`), Playwright para 8 flujos críticos de extremo a extremo (`tests/e2e/`), y `dependency-cruiser` como prueba de arquitectura (`pnpm depcruise`, 8 reglas con `severity: "error"`), las tres ejecutadas en cada PR y en `main` (`.github/workflows/pr.yml`, `.github/workflows/main.yml`).** (Texto original. Los conteos vigentes y el reparto real entre `pr.yml` y `main.yml` están en el Estado: Playwright no corre en cada PR, solo en `main`.)

### Justificación

- Vitest comparte el motor de Vite y el mismo alias de rutas (`@` → `./src`) que `tsconfig.json`, evitando una configuración de *transform* separada para TypeScript/ESM.
- `dependency-cruiser` convierte las reglas de capas del monolito modular (ADR-002) en una prueba automática, no en una revisión manual dependiente del criterio del único desarrollador (RNF-M-02).
- Al decidir, `tests/e2e/` limitaba los flujos e2e a 8 especificaciones críticas (autenticación, CSP, accesibilidad del editor, subida de imágenes, CRUD de cuadernos, importación de PDF, estado vacío, menú `/`), en línea con `docs/documento-maestro.md` §4.4 ("3–5 flujos críticos").
- **vs. Jest + Cypress sin prueba de arquitectura:** ninguna de las dos herramientas resuelve la verificación automática de límites entre capas; sin `dependency-cruiser` (o equivalente), las reglas de dependencia dependerían de revisión manual en cada *pull request*.
- **vs. solo Playwright (e2e):** el dominio de varios módulos es código puro sin dependencias externas (`domain-no-npm`); probarlo únicamente vía e2e sería más lento y no aislaría casos extremos (p. ej. el factor de facilidad mínimo de SM-2, hoy cubierto por `sm2.test.ts`) con la misma precisión que una prueba unitaria directa.

### Consecuencias

**Positivas**

- `pnpm depcruise` detecta una violación de capas en segundos, antes de que llegue a revisión humana; `playwright.config.ts` fuerza `workers: 1` para no competir por la única conexión de base de datos (`max: 1` en `client.ts`), evitando pruebas e2e intermitentes por agotamiento del *pool*.

**Negativas**

- `vitest.config.ts` no define ningún umbral de cobertura (`coverage` sin `thresholds`); la disciplina de prueba depende del criterio del desarrollador y no de una puerta automática que bloquee un *pull request* con cobertura insuficiente. `docs/documento-maestro.md` §4.4 declara una meta de "cobertura 100%" para SM-2/dominio; desde la Fase 4 ese código existe y está probado, pero la meta sigue sin exigirse porque no hay umbral configurado.
- Playwright corre solo en `main`, después de la fusión: una regresión de extremo a extremo se detecta tras fusionar, salvo que la suite completa se haya ejecutado en local antes del PR.

**Mitigación**

Sin mitigación por ahora — no existe un umbral de cobertura configurado ni un plan documentado para introducirlo.

---

## ADR-011: Política de seguridad: RLS y Content Security Policy

### Estado

Aceptado — implementado. Actualización (2026-10-15): el cambio de `style-src` se aplicó el 2026-09-30 (commit `0e4cee7`, "keep style-src on unsafe-inline so SSR inline styles apply on hard loads"): `styleSrc()` en `src/shared/config/security-headers.ts` devuelve siempre `style-src 'self' 'unsafe-inline'`, con su prueba en `src/shared/config/security-headers.test.ts`. Row Level Security está activa en las 20 tablas. Actualización (2026-10-26, `docs/adr/0009`): la CSP añade `frame-src 'self' https://www.youtube-nocookie.com` para el bloque de YouTube del editor, que siempre se inserta desde `youtube-nocookie.com`.

### Contexto

RNF-S-02, RNF-S-03 y RNF-S-05 exigen Row Level Security activa y una Content Security Policy con nonce por petición. El 24 de septiembre de 2026 se detectó que `style-src` con nonce bloqueaba estilos en línea generados por el servidor (barras de progreso renderizadas con un atributo `style=""` calculado en el servidor): un nonce de CSP no se aplica a atributos `style=""`, solo a elementos completos, lo que produjo 69 violaciones registradas en una sola sesión de una página en carga completa. Se decidió cambiar `style-src` a `'self' 'unsafe-inline'` manteniendo `script-src` con nonce y `'strict-dynamic'` sin cambios; el cambio estaba aceptado pero no implementado en `src/shared/config/security-headers.ts` cuando se registró esta decisión (2026-09-25; aplicado el 2026-09-30). La parte de RLS/CSP heredada de `docs/documento-maestro.md` §9 es comparación retrospectiva elaborada para este registro a partir del documento maestro y del código; la parte del cambio de `style-src` fue decidida y registrada directamente en sesión de trabajo el 2026-09-24.

### Opciones consideradas

| Opción | Cobertura de estilos en línea generados por el servidor | Protección contra inyección de estilos | Costo de implementación | Compatibilidad con la navegación del lado del cliente |
|---|---|---|---|---|
| A. Mantener el nonce también en `style-src` (estado en `main` antes de este registro) | Nula: un nonce no se aplica a un atributo `style=""`; 69 violaciones observadas en una sola sesión de una página en carga completa | Alta en teoría, pero inútil en la práctica porque el navegador bloquea estilos legítimos, no solo maliciosos | Ninguno (ya implementado) | No aplica: React aplica estilos vía CSSOM en la navegación del cliente, no vía atributo, así que el problema solo se manifiesta en cargas completas |
| B. Eliminar todo estilo en línea generado por el servidor (mover las barras de progreso a clases CSS) | Total, sin relajar la directiva | La más alta de las tres opciones | Alto: requiere localizar y reescribir cada componente de servidor que hoy calcula un `style=""` dinámico | Total |
| C. Cambiar `style-src` a `'self' 'unsafe-inline'` (elegida) | Total: cualquier estilo en línea generado por el servidor funciona sin excepción | Menor que B para estilos (se acepta cualquier `style=""`), pero `script-src` conserva el nonce y `'strict-dynamic'` sin cambios | Bajo: un cambio de una línea en `security-headers.ts` | Total |

### Decisión

**`style-src` cambiará de `'self' 'nonce-{value}' 'strict-dynamic'` a `'self' 'unsafe-inline'` en `src/shared/config/security-headers.ts`, mientras `script-src` conserva el nonce por petición y `'strict-dynamic'` sin cambios; el cambio estaba aceptado pero no implementado en el código cuando se registró esta decisión.** (Texto original; implementado el 2026-09-30, ver Estado.)

### Justificación

- Un nonce de CSP no cubre el atributo `style=""`: solo se aplica a elementos `<style>`/`<script>` completos, por lo que mantenerlo en `style-src` bloqueaba estilos en línea legítimos generados por el servidor, observado como 69 violaciones en una sola sesión de una página en carga completa.
- El problema es específico de la carga completa del navegador: en la navegación del lado del cliente, React aplica los estilos a través del CSSOM (no como texto de atributo interpretado de nuevo por el navegador), por lo que las violaciones quedaban ocultas durante la navegación normal y solo aparecían en una recarga completa.
- `script-src` no cambia: conserva `'nonce-{valor}' 'strict-dynamic'`, la protección más relevante contra XSS por inyección de script, sin relajarse.
- **vs. mantener el nonce también en `style-src`:** es la opción más estricta en teoría, pero bloquea funcionalidad real del producto sin ofrecer protección adicional efectiva, porque el navegador nunca aplica un nonce a un atributo `style=""`.
- **vs. eliminar todo estilo en línea generado por el servidor:** sería la opción más segura, pero exige localizar y reescribir cada componente de servidor que hoy calcula un estilo dinámico, un costo de implementación no asumido en esta fase del proyecto; queda como mejora futura posible, no descartada de forma permanente.

### Consecuencias

**Positivas**

- Elimina el bloqueo de estilos en línea legítimos sin relajar `script-src`, la directiva más crítica contra XSS.

**Negativas**

- `'unsafe-inline'` en `style-src` acepta cualquier estilo en línea, incluido uno inyectado por un vector de XSS que lograra insertar un atributo `style=""` (p. ej. exfiltración de datos vía selectores CSS, o alterar la apariencia de la página para un ataque de *phishing* visual); la directiva ya no distingue un estilo legítimo del servidor de uno inyectado.

**Mitigación**

`script-src` conserva el nonce y `'strict-dynamic'`, la superficie de ataque más común (inyección de script) sigue protegida. El cambio en `style-src` se aplicó con su prueba correspondiente en `src/shared/config/security-headers.test.ts` ("keeps style-src on 'self' 'unsafe-inline' without the nonce so SSR inline styles apply").

### Diseño

Directiva vigente en `src/shared/config/security-headers.ts` (2026-10-15):

```ts
function scriptSrc(nonce: string | undefined): string {
  const base = nonce
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "'self' 'unsafe-inline'";
  // posthog-js fetches its remote config and lazy modules as scripts.
  return `script-src ${base} https://*.posthog.com${isDev ? " 'unsafe-eval'" : ""}`;
}

function styleSrc(): string {
  return "style-src 'self' 'unsafe-inline'";
}
```

- `script-src` conserva `'self' 'nonce-${nonce}' 'strict-dynamic'` cuando `src/proxy.ts` genera un nonce, y `'self' 'unsafe-inline'` como red de seguridad sin él (cabeceras estáticas de `next.config.ts` para rutas fuera del *matcher* del proxy).
- `script-src` también permite `https://*.posthog.com`, porque `posthog-js` descarga su configuración remota y sus módulos diferidos como *scripts* (comentario del código).
- `'unsafe-eval'` se añade solo en desarrollo (`NODE_ENV === "development"`): React usa `eval` en desarrollo para reconstruir en el navegador las pilas de errores del servidor, y no lo necesita en producción (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). Producción nunca envía `'unsafe-eval'`.
