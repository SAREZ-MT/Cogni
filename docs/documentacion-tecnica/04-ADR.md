# Registro de Decisiones de Arquitectura (ADR) — Cogni

**Proyecto:** Cogni — plataforma web de estudio a partir de apuntes propios
**Versión:** 1.0
**Fecha:** 2026-09-25
**Estado:** Borrador
**Autor:** Javier Sarez
**Documentos relacionados:** ./01-SRS.md, ./02-SAD.md, ./03-DATA-API.md

---

## 0. Nota de estado actual (2026-09-25)

- Fase 0 (Cimientos) y Fase 1 (Cuadernos y editor) están desplegadas en producción.
- Fase 2 (Importación de PDF) se implementó bajo Organic Driven Development (ODD) el 2026-09-23.
- Fase 3 (Capa de IA) no ha iniciado: `src/modules/ai` es un esqueleto (`export {};`).
- Las Fases 4 a 7 (`study-engine`, `flashcards`, `exams`, `active-recall`, `scheduling`, `analytics`) son esqueletos vacíos en este código base; cuatro de ellas tienen una versión de diseño visual con datos de muestra en la rama `design/shell-look`, no integrada a `main`.
- Fase 8 (Endurecimiento) está parcialmente cubierta: Content Security Policy con nonce, redirección del dominio apex y protección de sesión existen; el resto (registro de logs externo, pruebas de carga, auditoría de accesibilidad) no se ha iniciado.
- De las 11 decisiones registradas en este documento:
  - **Completamente implementadas y verificables en el código de `main`:** ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, ADR-009, ADR-010.
  - **Implementada en la Fase 3 (2026-10-04):** ADR-008 (capa de IA con rotación multiproveedor); el registro de proveedores cambió respecto del texto original, ver `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md`.
  - **Aceptada, pendiente de implementación (especificación del documento maestro, módulo aún vacío):** ADR-007 (Fase 4 — motor de repetición espaciada).
  - **Aceptada e implementada en su mayor parte, con un cambio puntual pendiente:** ADR-011 (Row Level Security está activa; el cambio de `style-src` decidido el 2026-09-24 no está aplicado todavía en `src/shared/config/security-headers.ts`).

### Documento vivo

Este documento se actualiza a medida que avanza la construcción de Cogni; la nota de estado de esta sección es el punto de anclaje de esas actualizaciones. Por ejemplo, cuando la Fase 3 implemente la capa de IA, el Estado de ADR-008 dejará de decir "pendiente de implementación" y su sección de Consecuencias se revisará contra el código real (proveedores configurados, `ProviderRegistry` existente); cuando se aplique el cambio de `style-src`, el Estado de ADR-011 pasará a "Aceptado" sin la anotación pendiente.

### Correspondencia con las fases RAD

| Sección de este documento | Fase RAD | Uso en la tesis |
|---|---|---|
| ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, ADR-009, ADR-010 (decisiones implementadas) | Planificación de requisitos / Construcción | Evidencia de que cada decisión de producto, stack y arquitectura fue tomada antes de programar y quedó verificada contra el código construido. |
| ADR-007 (decisión aceptada, pendiente de implementación) | Planificación de requisitos | Documenta una decisión ya cerrada para una fase futura (4), útiles como diseño detallado a sustentar ante el jurado antes de su Construcción. |
| ADR-011 (política de seguridad: RLS y CSP) | Implementación | Sustenta las medidas de seguridad ya desplegadas y el cambio de configuración pendiente, propio de la fase de Implementación/endurecimiento. |

---

## Índice de decisiones

| ID | Título | Estado | Origen |
|---|---|---|---|
| ADR-001 | Página como unidad de estudio y cuaderno como agrupación | Aceptado | `docs/adr/0001-decisiones-fundacionales.md` (ítem 1) |
| ADR-002 | Monolito modular con arquitectura hexagonal por módulo | Aceptado | `docs/adr/0001-decisiones-fundacionales.md` (ítem 4) |
| ADR-003 | Next.js con TypeScript estricto como framework de aplicación | Aceptado | `docs/adr/0001-decisiones-fundacionales.md` (ítem 5) |
| ADR-004 | Supabase Postgres con Drizzle ORM como capa de datos | Aceptado | `docs/documento-maestro.md` §4.1–§4.2 |
| ADR-005 | Supabase Auth con RLS y proxy de sesión | Aceptado | `docs/documento-maestro.md` §9 |
| ADR-006 | Tiptap como base del editor de bloques | Aceptado | `docs/adr/0001-decisiones-fundacionales.md` (ítem 3) |
| ADR-007 | SM-2 por ítem con nivel de dominio derivado por página | Aceptado — pendiente de implementación (Fase 4) | `docs/adr/0001-decisiones-fundacionales.md` (ítem 2) |
| ADR-008 | Vercel AI SDK con rotación multiproveedor y salida estructurada | Aceptado — implementado (Fase 3) | `docs/adr/0001-decisiones-fundacionales.md` (ítem 6); actualizado por `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md` |
| ADR-009 | Vercel Hobby con Cloudflare DNS, Fluid Compute y Vercel Cron | Aceptado | `docs/documento-maestro.md` §4.2, §10 |
| ADR-010 | Estrategia de pruebas: TDD con Vitest, Playwright y dependency-cruiser | Aceptado | `docs/documento-maestro.md` §4.4 |
| ADR-011 | Política de seguridad: RLS y Content Security Policy | Aceptado — pendiente de implementación del cambio de `style-src` | `docs/documento-maestro.md` §9; decisión registrada en sesión de trabajo del 2026-09-24 (cambio de `style-src`) |

---

## ADR-001: Página como unidad de estudio y cuaderno como agrupación

### Estado

Aceptado.

### Contexto

Cogni es un producto individual (no colaborativo: `docs/documento-maestro.md` §1.2) construido por una sola persona con presupuesto de infraestructura cercano a cero. Antes de escribir código, el documento maestro cerró la jerarquía de contenido en `Usuario → Cuaderno → Página → {contenido, ítems de estudio}` (§3.1), fijando la página como unidad de estudio y el cuaderno como agrupación sin semántica de estudio ("opción B" del ADR fundacional). Esta decisión condiciona directamente el nivel de dominio derivado (RF-SE-02, roadmap), la asociación de un mazo de flashcards a exactamente una página (RF-FC-01, diseño visual sin integrar) y el esquema real de `src/shared/db/schema.ts` (`notebooks` sin columnas de contenido; `pages.content`/`plain_text` como única fuente de texto). Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

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
- El nivel de dominio (RF-SE-02, roadmap) se puede derivar agregando los ítems de una página sin necesitar reglas adicionales sobre qué bloque pertenece a qué tema.
- **vs. cuaderno como unidad de estudio:** un cuaderno agrupa contenido heterogéneo (varias clases, incluso varias materias); generar un único mazo o examen por cuaderno mezclaría temas y reduciría la utilidad de la calibración metacognitiva (RF-AN-03, roadmap).
- **vs. bloque individual como unidad de estudio:** el editor no asigna una identidad estable a un bloque (los bloques Tiptap se reordenan y se fusionan libremente); generar ítems a nivel de bloque exigiría un mecanismo de identidad y sincronización que no existe hoy y fragmentaría el contexto necesario para preguntas de calidad.

### Consecuencias

**Positivas**

- `notebooks` permanece sin columnas de contenido, evitando duplicar `plain_text`/`content` en dos niveles de la jerarquía.
- La granularidad por página encaja 1:1 con la decisión de que cada mazo/examen/sesión pertenezca a exactamente una página (RF-FC-01), sin ambigüedad sobre a qué entidad pertenece un ítem de estudio.

**Negativas**

- Si una página mezcla varios temas, el nivel de dominio (roadmap) y los ítems generados heredarán esa mezcla; no existe hoy, ni en el roadmap especificado, una forma de dividir una página en subtemas de estudio independientes.
- Un estudiante no puede compartir ítems de estudio entre dos páginas relacionadas de distintos cuadernos: cada mazo/examen pertenece a exactamente una página, lo que puede llevar a duplicar contenido de estudio si un tema aparece en más de un lugar.

**Mitigación**

Sin mitigación por ahora — `docs/documento-maestro.md` §1.2 marca este tipo de ajuste como fuera de alcance salvo por un ADR futuro.

---

## ADR-002: Monolito modular con arquitectura hexagonal por módulo

### Estado

Aceptado.

### Contexto

Cogni se desarrolla con presupuesto de infraestructura cercano a cero y una sola persona (`docs/documento-maestro.md` §14, riesgo "una sola persona desarrollando"). RNF-M-02 exige verificar en integración continua que ningún módulo de dominio dependa de infraestructura, de un framework externo (salvo Zod) ni de otro módulo fuera de su índice público. La decisión de dividir el código en 11 módulos con capas hexagonales está heredada de `docs/adr/0001-decisiones-fundacionales.md` (ítem 4) y `docs/documento-maestro.md` §5.1–§5.3. Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Costo operativo | Verificabilidad automática de límites | Complejidad para un equipo de una persona | Aislamiento entre módulos |
|---|---|---|---|---|
| A. Monolito sin capas internas | Mínimo: un despliegue | Ninguna: nada impide que la UI importe Drizzle directamente | Baja al inicio, alta a mediano plazo por acoplamiento no contenido | Ninguno: todo el código comparte un mismo espacio de nombres |
| B. Microservicios por módulo | Alto: 11 servicios, 11 *pipelines* de CI/CD, orquestación de red | Alta, por fronteras de proceso | Muy alta: una persona debe operar y desplegar 11 servicios | Alto, a costa de latencia de red entre módulos que hoy se comunican en el mismo proceso |
| C. Monolito modular con arquitectura hexagonal (elegida) | Mínimo: un despliegue, sin configuración multiservicio en `vercel.json` | Alta: 8 reglas `severity: "error"` en `.dependency-cruiser.cjs`, ejecutadas en cada PR (`pnpm depcruise`) | Media: una sola base de código, límites internos explícitos | Alto en el código (`domain`/`application`/`infrastructure` por módulo, regla `cross-module-via-index`), sin el costo de red de B |

### Decisión

**Cogni es un monolito modular desplegado como una sola aplicación Next.js, dividido en 11 módulos bajo `src/modules/*`, cada uno con capas `domain/`, `application/`, `infrastructure/` y `ui/`, con los límites verificados automáticamente por 8 reglas de `severity: "error"` en `.dependency-cruiser.cjs`.**

### Justificación

- Un solo despliegue en Vercel Hobby mantiene el costo de infraestructura en cero y evita que una persona deba operar múltiples servicios.
- Las 8 reglas de `.dependency-cruiser.cjs` (`domain-is-pure`, `domain-no-npm`, `application-no-infra-or-ui`, `ui-never-touches-infra`, `cross-module-via-index`, `editor-tiptap-only-in-ui`, `study-engine-knows-no-technique`, `unpdf-only-in-ingestion-infra`) convierten los límites de la arquitectura en errores de integración continua (RNF-M-02), no en convenciones que dependan de la disciplina del único desarrollador.
- La regla `cross-module-via-index` obliga a que todo acceso entre módulos pase por un `index.ts` público (p. ej. `src/modules/ingestion/infrastructure/notebooks-pages-adapter.ts` consume `notebooks` solo a través de `createNotebooksServerApi`), preservando el desacoplamiento propio de un límite de proceso sin pagar su costo de red.
- **vs. monolito sin capas internas:** nada impediría, sin las 8 reglas, que la UI de un módulo importara Drizzle u otro módulo por una ruta interna; la propia regla `unpdf-only-in-ingestion-infra` documenta un riesgo concreto de este tipo (resolución de `pnpm` a una ruta anidada de `node_modules`).
- **vs. microservicios por módulo:** una persona no puede operar 11 servicios, 11 *pipelines* y la coordinación de red entre ellos con presupuesto cero; además, módulos reales se llaman entre sí en el mismo proceso hoy (`ingestion` → `src/modules/notebooks/server-api.ts`), algo que en microservicios exigiría una llamada de red o un bus de eventos.

### Consecuencias

**Positivas**

- Mover o refactorizar un módulo no requiere coordinar despliegues independientes.
- El costo de infraestructura permanece en cero, alineado con el presupuesto de una persona (`docs/documento-maestro.md` §14).

**Negativas**

- Un error en cualquier módulo puede afectar la aplicación completa: no hay aislamiento de fallos entre procesos, a diferencia de microservicios.
- Siete de los once módulos (`ai`, `study-engine`, `flashcards`, `exams`, `active-recall`, `scheduling`, `analytics`) son hoy esqueletos vacíos (`export {};`); las reglas de dependencia no pueden verificar límites en código que aún no existe, por lo que la arquitectura hexagonal de esos módulos es una intención, no un hecho verificado, hasta que se implementen.

**Mitigación**

Las reglas de `dependency-cruiser` ya cubren los módulos reales (`identity`, `notebooks`, `editor`, `ingestion`); cuando cada módulo roadmap se implemente, las mismas 8 reglas (con alcance `^src/modules/[^/]+/...`) lo cubrirán automáticamente sin cambios de configuración.

---

## ADR-003: Next.js con TypeScript estricto como framework de aplicación

### Estado

Aceptado.

### Contexto

Con presupuesto cercano a cero y una sola persona a cargo tanto de la interfaz como del servidor, el documento maestro (`docs/documento-maestro.md` §4.1) y `docs/adr/0001-decisiones-fundacionales.md` (ítem 5) cierran el framework de aplicación antes de escribir código. RNF-M-01 exige TypeScript en modo estricto en todo el código fuente; múltiples requisitos funcionales (p. ej. RF-NB-05, RF-IN-03) dependen de Server Actions como único mecanismo de mutación. Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Despliegue en Vercel Hobby | Backend separado necesario | Server Actions / RSC | Compatibilidad con shadcn/ui y Tiptap |
|---|---|---|---|---|
| A. Backend Express/Fastify + SPA React | Requiere dos despliegues o enrutamiento manual | Sí: dos bases de código, dos ciclos de *release* | No: exige diseñar y mantener endpoints REST propios | Compatible, pero exige construir la capa de API que Next.js resuelve nativamente |
| B. SvelteKit / Remix | Soportado en Vercel | No | Remix tiene un equivalente (`action`); SvelteKit usa `+page.server.ts` | shadcn/ui y varias extensiones de Tiptap están escritas específicamente para React |
| C. Next.js (App Router) + TypeScript estricto (elegida) | Nativo: integración Git de Vercel, sin configuración adicional | No: un mismo framework sirve UI y Server Actions/Route Handlers | Sí: `"use server"` en cada `actions.ts` de módulo | Nativa: shadcn/ui y Tiptap/React se integran sin capa de adaptación |

### Decisión

**Next.js 16.3.5 (App Router) con React 19.2.8 y TypeScript en modo estricto (`tsconfig.json`, `"strict": true`) es el framework de aplicación, usando Server Actions y Route Handlers en vez de una API REST separada.**

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

Aceptado.

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

- Los tipos de las 5 tablas reales se derivan automáticamente del esquema, evitando desincronización manual entre SQL y TypeScript.

**Negativas**

- `drizzle-kit` no tiene comando `down`; toda reversión de una migración es manual (5 de 7 migraciones tienen un `.down.sql` emparejado, aplicado a mano contra `cogni-dev`/`cogni-prod`).
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

Aceptado.

### Contexto

RF-ID-01 a RF-ID-07 exigen registro con correo y contraseña, Google OAuth, verificación de correo y recuperación de contraseña; RNF-S-04 exige redirigir a `/login` cualquier solicitud sin sesión activa. El documento maestro (§9) cierra Supabase Auth como mecanismo de identidad antes de escribir código, dentro del mismo proveedor gratuito ya elegido para Postgres y Storage (ADR-004). Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

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
- `@supabase/ssr` resuelve la sesión por cookies en `src/proxy.ts` (`updateSession`), que redirige a `/login` a cualquier visitante sin sesión fuera de las rutas de autenticación (RNF-S-04), como defensa perimetral única.
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

Aceptado.

### Contexto

RF-ED-01 a RF-ED-07 exigen un editor de bloques con autoguardado, menú `/`, barra de herramientas contextual, manejador de arrastre y subida de imágenes. `docs/adr/0001-decisiones-fundacionales.md` (ítem 3) y `docs/documento-maestro.md` §3.2 cierran Tiptap como motor del editor antes de escribir código, descartando explícitamente construirlo desde cero. Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Costo | Cobertura de bloques mínimos (RF-ED-02) | Aislamiento arquitectónico | Madurez de extensiones |
|---|---|---|---|---|
| A. BlockNote | La plantilla con experiencia estilo Notion completa (menú `/`, manejador de arrastre) es de pago | Alta lista para usar, pero limitada a lo que la plantilla expone | Ninguna ganancia sobre Tiptap: BlockNote está construido sobre Tiptap/ProseMirror | Alta para el caso genérico, pero cerrada a la plantilla |
| B. ProseMirror puro (sin Tiptap) | Gratuito | Ninguna: cada bloque (tablas, callouts, resaltado) se construiría desde cero | Total, a costa de reescribir el sistema de extensiones y esquema que Tiptap ya resuelve | Ninguna: ProseMirror es de bajo nivel, sin catálogo de extensiones oficiales |
| C. Tiptap (headless sobre ProseMirror, elegida) | Extensiones oficiales de código abierto (`@tiptap/extension-*`), sin plantilla de pago | Alta: encabezados, listas, tablas, código con resaltado, callouts, imágenes, menú `/`, barra contextual y manejador de arrastre, todos en `package.json` | Confinable: regla `editor-tiptap-only-in-ui` de `.dependency-cruiser.cjs` | Alta: extensiones oficiales mantenidas activamente |

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

Aceptado — pendiente de implementación (Fase 4).

### Contexto

`src/modules/study-engine` es hoy un esqueleto (`export {};`); esta decisión es especificación heredada de `docs/adr/0001-decisiones-fundacionales.md` (ítem 2, "opción C") y `docs/documento-maestro.md` §7 (fórmulas SM-2 por ítem, nivel de dominio por página). Los requisitos que dependen de ella (RF-SE-01, RF-SE-02, RF-SE-03, RF-SE-04) están marcados Roadmap en `01-SRS.md`, a la espera de la Fase 4. El documento maestro cita a Wozniak (1987) como base y reserva FSRS como evaluación futura explícita (§2). Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Granularidad de repaso | Simplicidad para TDD 100 % (Fase 4, §4.4) | Evidencia citada (§2 documento maestro) | Compatible con 3 técnicas bajo un motor único |
|---|---|---|---|---|
| A. SM-2 por página completa (un único estado agregado) | Baja: toda la página se repasa junta aunque solo un ítem esté vencido | Alta simplicidad algorítmica, pero pierde la señal de qué ítem falló | Wozniak (1987) sigue aplicando, pero ignora la recuperación por ítem individual | Difícil: mezclar la calidad de flashcards, exámenes y recordación activa en un solo estado por página pierde la señal de qué técnica falló |
| B. Motor FSRS en vez de SM-2 | Alta (por ítem, como C) | Menor: FSRS tiene más parámetros y mayor superficie de prueba que SM-2 | El documento maestro cita a Wozniak (1987) como base ya evaluada; FSRS se menciona solo como evaluación futura "a futuro por ADR" | Sí, pero no evaluado ni implementado en ningún código o especificación actual |
| C. SM-2 por ítem, dominio derivado por página (elegida) | Alta: cada flashcard/pregunta tiene su propio estado (`n`, `EF`, `due_at`) | Alta: fórmulas cerradas y deterministas (§7.1) | Wozniak (1987) citado explícitamente | Sí: `study-engine` es agnóstico de técnica por diseño (regla `study-engine-knows-no-technique`), cada técnica solo mapea su resultado a una calidad `q` 0–5 |

### Decisión

**Cada ítem de estudio (flashcard, pregunta de examen, pregunta de recordación activa) mantendrá su propio estado SM-2 (`n`, `EF`, `due_at`, `lapses`), y el nivel de dominio de una página (Nuevo/Aprendiendo/Consolidando/Dominado) se derivará agregando el estado de sus ítems, según las fórmulas de `docs/documento-maestro.md` §7.1 y §7.3.**

### Justificación

- SM-2 por ítem preserva la señal de qué pregunta o tarjeta específica falló, en vez de diluirla en un único estado por página (RF-SE-01).
- El nivel de dominio derivado (RF-SE-02) reutiliza la página como unidad de estudio (ADR-001) sin introducir una segunda jerarquía de agregación.
- `study-engine` es agnóstico de técnica por diseño (RF-SE-04, regla `study-engine-knows-no-technique` de `.dependency-cruiser.cjs`, ya activa en CI aunque el módulo esté vacío), lo que exige un modelo de ítem uniforme (calidad `q` 0–5) independiente de la técnica de origen.
- **vs. SM-2 por página completa:** perdería la posibilidad de saber qué ítem concreto necesita repaso dentro de una página con muchos ítems, y complicaría mezclar la calidad de tres técnicas distintas en un único estado.
- **vs. FSRS:** el documento maestro cita a Wozniak (1987, SM-2) como base científica ya evaluada y reserva FSRS como evaluación futura explícita ("FSRS evaluado a futuro por ADR", §2); adoptarlo ahora añadiría parámetros y superficie de prueba sin evidencia de que mejore el resultado para un producto todavía sin usuarios.

### Consecuencias

**Positivas**

- Una vez implementado, el mismo motor serviría a las tres técnicas sin duplicar lógica de repetición espaciada; las fórmulas son deterministas y verificables con pruebas unitarias puras (`applySm2` como función pura, según la especificación).

**Negativas**

- Hoy esta decisión es pura especificación: `src/modules/study-engine` es un esqueleto, no existe tabla `StudyItem`/`ReviewLog`/`PageMastery`, y ninguna prueba verifica las fórmulas de §7.1/§7.3 contra código real. El documento maestro fija una meta de cobertura de pruebas del 100 % para este algoritmo (§4.4) que aún no puede evaluarse.

**Mitigación**

Sin mitigación por ahora — la Fase 4 (§13 del documento maestro) implementa esta decisión con TDD estricto en el dominio, según el "Hecho cuando" definido: "intervalos SM-2 exactos en tests y producción tras 3 días simulados".

---

## ADR-008: Vercel AI SDK con rotación multiproveedor y salida estructurada

### Estado

Aceptado — implementado en la Fase 3. La lista de proveedores del texto original quedó reemplazada por la del `docs/adr/0004-capa-de-ia-con-proveedores-gratuitos.md` (Google AI Studio, Cloudflare Workers AI y OpenRouter para generación; Groq solo para evaluación; Mistral y Cerebras descartados). Las secciones siguientes conservan el análisis original de la decisión.

### Contexto

`src/modules/ai` es un esqueleto (`export {};`); ningún paquete `ai`/`@ai-sdk/*` existe en `package.json`. Esta decisión es especificación heredada de `docs/adr/0001-decisiones-fundacionales.md` (ítem 6) y de `docs/documento-maestro.md` §3.7 (la IA no es un chat, funciones acotadas), §4.3 (cinco proveedores con nivel gratuito) y §8 (principios, registro de proveedores, propósitos y esquemas). Los requisitos RF-AI-01 a RF-AI-05 están marcados Roadmap en `01-SRS.md`, a la espera de la Fase 3. Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Costo | Salida estructurada validada con Zod | Acoplamiento a un proveedor | Integración con Server Actions |
|---|---|---|---|---|
| A. LangChain.js | Multiproveedor, con una capa de abstracción más pesada (cadenas, agentes) no necesaria aquí | Soporta salida estructurada, con una API más verbosa para el caso simple "un esquema, un resultado" | Bajo, similar al elegido | Requiere adaptar sus abstracciones al modelo de Server Actions, más código de integración |
| B. SDKs nativos por proveedor | Igual costo, cada proveedor con su propio esquema de configuración | Cada proveedor valida su salida de forma distinta; exigiría una capa Zod construida a mano por proveedor | Alto: cada punto de uso conocería la forma exacta de la respuesta de cada proveedor | Ninguna ayuda nativa; toda la integración se escribe a mano |
| C. Vercel AI SDK con rotación multiproveedor (elegida) | Multiproveedor, cada uno con nivel gratuito propio (Google AI Studio, Groq, Mistral, OpenRouter `:free`, Cerebras) | Nativa: `generateObject` con esquema Zod | Ninguno: un mismo contrato (`ai.application`) cambia de proveedor sin tocar el resto del código | Nativa, pensada para Server Actions/Route Handlers |

### Decisión

**La capa de IA (roadmap, Fase 3) se construirá sobre Vercel AI SDK, con un `ProviderRegistry` que rota entre Google AI Studio, Groq, Mistral, OpenRouter y Cerebras por cuota, y `generateObject` con esquema Zod como única forma de obtener una salida de un proveedor de IA.**

### Justificación

- Ningún módulo de negocio (`flashcards`, `exams`, `active-recall`) importaría el SDK de un proveedor directamente; todos pasarían por `ai.application` (RF-AI-01, principio 1 de §8.1 del documento maestro), aislando el resto del código de un cambio de proveedor.
- `generateObject` fuerza que toda salida de IA sea JSON validado contra un esquema Zod (RF-AI-01), nunca texto libre, alineado con la regla `domain-no-npm` que ya permite Zod como única dependencia dentro de `domain/`.
- La rotación entre 5 proveedores con nivel gratuito mitiga directamente el riesgo de mayor probabilidad e impacto documentado en `docs/documento-maestro.md` §14 ("Tiers gratuitos de IA cambian o desaparecen").
- **vs. LangChain.js:** su capa de abstracción (cadenas, agentes, memoria) resuelve problemas que Cogni no tiene ("no es un chat", §3.7); adoptarla añadiría superficie de aprendizaje y de errores sin necesidad funcional.
- **vs. SDKs nativos por proveedor:** exigiría escribir y mantener a mano una capa de validación Zod distinta por cada uno de los 5 proveedores, exactamente el trabajo que Vercel AI SDK resuelve con un contrato único (`generateObject`).

### Consecuencias

**Positivas**

- Cuando se implemente, un proveedor caído o sin cuota no detendría la generación mientras exista al menos un proveedor sano en la rotación (RF-AI-02).

**Negativas**

- Hoy no existe ningún paquete `ai`/`@ai-sdk/*` en `package.json`; `src/modules/ai` es un esqueleto vacío; toda esta decisión es especificación, sin código, sin pruebas y sin ningún proveedor configurado. La rotación por cuota además depende de un limitador de tasa (§8.2–§8.3 del documento maestro, roadmap), lo que hace que esta decisión no pueda evaluarse de forma aislada de decisiones futuras sobre limitación de tasa.

**Mitigación**

Sin mitigación por ahora — la Fase 3 (§13 del documento maestro) implementa esta decisión; el "Hecho cuando" definido es explícito: "cuota agotada de un proveedor, sigue funcionando con el siguiente".

---

## ADR-009: Vercel Hobby con Cloudflare DNS, Fluid Compute y Vercel Cron

### Estado

Aceptado.

### Contexto

Cogni opera con presupuesto de infraestructura cercano a cero (`docs/documento-maestro.md` §4.2) y una sola persona disponible para operar cualquier servicio adicional. Dos necesidades de trabajo en segundo plano son reales hoy: procesar una importación de PDF que puede tardar más que una petición HTTP típica (RF-IN-04, tope de 120 segundos) y mantener vivo el proyecto gratuito de Supabase, que se pausa tras aproximadamente 7 días de inactividad (RNF-F-01). `src/modules/ingestion/README.md` documenta explícitamente que no existe un *worker* separado para la primera necesidad. Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Costo | Presupuesto de ejecución disponible | Complejidad operativa (equipo de 1 persona) | Servicios/despliegues adicionales |
|---|---|---|---|---|
| A. Cola de trabajos / servicio de *worker* gestionado | Nivel gratuito limitado en la mayoría de proveedores de colas administradas; superado ese límite es un costo recurrente | Alto, pensado para tareas largas y reintentos | Alta: requiere configurar cola, *worker*, reintentos y observabilidad de un sistema adicional | Sí: al menos un servicio de cola y un proceso *worker* separado del despliegue de Next.js |
| B. *Worker* autoalojado (proceso Node.js propio 24/7) | Una VM o contenedor con costo recurrente, o un nivel gratuito con límites de horas/CPU | Sin límite práctico de duración de tarea | Alta: exige mantener el proceso vivo, reinicios, *logs* y parcheo del sistema operativo | Sí: un servicio de cómputo separado de Vercel |
| C. Tabla de trabajos consultada por *cron* (*job table* + *polling*) | Gratuito con Vercel Cron y Postgres ya existente | Limitado por la frecuencia mínima de *cron* de Vercel Hobby (una vez al día) y por el mismo tope de `maxDuration` de cada invocación que la procesa | Media: sin servicio adicional, pero exige lógica de "reclamar" filas y manejar reintentos con concurrencia | No, pero introduce latencia: el trabajo espera al siguiente disparo de *cron* en vez de procesarse al instante |
| D. Vercel Fluid Compute + Vercel Cron (elegida) | Gratuito en el plan Hobby, sin servicio adicional | 120 s por invocación (`maxDuration = 120`), suficiente para el criterio "hecho cuando" de un PDF de 30 páginas en menos de 60 s (Fase 2, §13) | Baja: un solo despliegue, sin proceso ni cola adicional que operar | No: `vercel.json` añade un solo *cron* declarativo (`/api/keep-alive`, diario) |

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

- El presupuesto de 120 segundos es un tope duro por invocación; un PDF que se acerque al límite (por tamaño, número de páginas o lentitud transitoria del extractor) falla con `timeout` (RF-IN-08) en vez de reintentarse automáticamente en segundo plano, y no existe hoy ningún mecanismo de reintento asíncrono más allá de que el estudiante vuelva a importar el archivo.
- Vercel Cron en el plan Hobby limita la frecuencia mínima de una tarea programada a una vez al día, por lo que cualquier trabajo futuro que necesite ejecutarse con mayor frecuencia (p. ej. un recálculo de vencimientos varias veces al día, §10.3 del documento maestro) no cabría en este mecanismo sin cambiar de plan.

**Mitigación**

`ABANDONED_AFTER_MS` (`(MAX_DURATION_S + 30) * 1000` = 150 000 ms, en `src/modules/ingestion/domain/import-budget.ts`) permite detectar un `ImportJob` abandonado tras un tiempo razonable, aunque hoy ningún proceso automático limpia esos trabajos: la detección (`isAbandoned`) es una función de lectura sin un disparador que la invoque todavía.

---

## ADR-010: Estrategia de pruebas: TDD con Vitest, Playwright y dependency-cruiser

### Estado

Aceptado.

### Contexto

Cogni se construye con TDD estricto declarado para el dominio (`docs/documento-maestro.md` §4.4) por una sola persona sin equipo de control de calidad separado. RNF-M-05 exige una suite de pruebas unitarias/de integración y una de extremo a extremo ejecutadas en integración continua, y RNF-M-02 exige verificar automáticamente las reglas de dependencia entre capas del monolito modular (ADR-002). Comparación retrospectiva elaborada para este registro a partir del documento maestro y del código.

### Opciones consideradas

| Opción | Velocidad en CI | Compatibilidad con el stack (Vite/Next.js) | Verificación automática de arquitectura | Cobertura del dominio sin navegador |
|---|---|---|---|---|
| A. Jest + Cypress, sin prueba de arquitectura | Jest más lento que Vitest en un proyecto con ESM/Vite; Cypress más pesado que Playwright para CI *headless* | Requiere configuración adicional de transformadores para ESM/TS que Vitest resuelve de forma nativa | Ninguna: sin una herramienta equivalente a `dependency-cruiser`, las reglas de capas dependerían de revisión manual | Sí, equivalente a la opción elegida |
| B. Solo Playwright (e2e), sin pruebas unitarias de dominio | Más lenta por corrida: arranca un navegador real por escenario | Compatible, pero no aprovecha que el dominio (`domain-no-npm`) es puro y no necesita navegador | Ninguna | Ninguna: probar SM-2 o `textToBlocks` solo por e2e sería indirecto y lento |
| C. Vitest + Playwright + dependency-cruiser (elegida) | Vitest comparte el motor de Vite, arranque rápido; Playwright limitado a 8 especificaciones críticas | Nativo: mismo alias `@` que `tsconfig.json`, mismo entorno `jsdom` | `pnpm depcruise` aplica las 8 reglas de `.dependency-cruiser.cjs` en cada PR y en `main` | Alta: 134 archivos `*.test.ts(x)` bajo `src`, incluyendo dominio puro sin `jsdom` cuando no se necesita DOM |

### Decisión

**La estrategia de pruebas combina Vitest para pruebas unitarias y de integración (134 archivos bajo `src`), Playwright para 8 flujos críticos de extremo a extremo (`tests/e2e/`), y `dependency-cruiser` como prueba de arquitectura (`pnpm depcruise`, 8 reglas con `severity: "error"`), las tres ejecutadas en cada PR y en `main` (`.github/workflows/pr.yml`, `.github/workflows/main.yml`).**

### Justificación

- Vitest comparte el motor de Vite y el mismo alias de rutas (`@` → `./src`) que `tsconfig.json`, evitando una configuración de *transform* separada para TypeScript/ESM.
- `dependency-cruiser` convierte las reglas de capas del monolito modular (ADR-002) en una prueba automática, no en una revisión manual dependiente del criterio del único desarrollador (RNF-M-02).
- `playwright.config.ts` limita expresamente los flujos e2e a 8 especificaciones críticas (autenticación, CSP, accesibilidad del editor, subida de imágenes, CRUD de cuadernos, importación de PDF, estado vacío, menú `/`), en línea con `docs/documento-maestro.md` §4.4 ("3–5 flujos críticos").
- **vs. Jest + Cypress sin prueba de arquitectura:** ninguna de las dos herramientas resuelve la verificación automática de límites entre capas; sin `dependency-cruiser` (o equivalente), las 8 reglas de dependencia dependerían de revisión manual en cada *pull request*.
- **vs. solo Playwright (e2e):** el dominio de varios módulos es código puro sin dependencias externas (`domain-no-npm`); probarlo únicamente vía e2e sería más lento y no aislaría casos extremos (p. ej. el factor de facilidad mínimo de SM-2, roadmap) con la misma precisión que una prueba unitaria directa.

### Consecuencias

**Positivas**

- `pnpm depcruise` detecta una violación de capas en segundos, antes de que llegue a revisión humana; `playwright.config.ts` fuerza `workers: 1` para no competir por la única conexión de base de datos (`max: 1` en `client.ts`), evitando pruebas e2e intermitentes por agotamiento del *pool*.

**Negativas**

- `vitest.config.ts` no define ningún umbral de cobertura (`coverage` sin `thresholds`); la disciplina de prueba depende del criterio del desarrollador y no de una puerta automática que bloquee un *pull request* con cobertura insuficiente. `docs/documento-maestro.md` §4.4 declara una meta de "cobertura 100%" para SM-2/dominio que hoy no es exigible porque ese código no existe todavía.

**Mitigación**

Sin mitigación por ahora — no existe un umbral de cobertura configurado ni un plan documentado para introducirlo.

---

## ADR-011: Política de seguridad: RLS y Content Security Policy

### Estado

Aceptado — pendiente de implementación del cambio de `style-src`.

### Contexto

RNF-S-02, RNF-S-03 y RNF-S-05 exigen Row Level Security activa y una Content Security Policy con nonce por petición. El 24 de septiembre de 2026 se detectó que `style-src` con nonce bloqueaba estilos en línea generados por el servidor (barras de progreso renderizadas con un atributo `style=""` calculado en el servidor): un nonce de CSP no se aplica a atributos `style=""`, solo a elementos completos, lo que produjo 69 violaciones registradas en una sola sesión de una página en carga completa. Se decidió cambiar `style-src` a `'self' 'unsafe-inline'` manteniendo `script-src` con nonce y `'strict-dynamic'` sin cambios; el cambio está aceptado pero no implementado en `src/shared/config/security-headers.ts` a la fecha de este documento. La parte de RLS/CSP heredada de `docs/documento-maestro.md` §9 es comparación retrospectiva elaborada para este registro a partir del documento maestro y del código; la parte del cambio de `style-src` fue decidida y registrada directamente en sesión de trabajo el 2026-09-24.

### Opciones consideradas

| Opción | Cobertura de estilos en línea generados por el servidor | Protección contra inyección de estilos | Costo de implementación | Compatibilidad con la navegación del lado del cliente |
|---|---|---|---|---|
| A. Mantener el nonce también en `style-src` (estado en `main` antes de este registro) | Nula: un nonce no se aplica a un atributo `style=""`; 69 violaciones observadas en una sola sesión de una página en carga completa | Alta en teoría, pero inútil en la práctica porque el navegador bloquea estilos legítimos, no solo maliciosos | Ninguno (ya implementado) | No aplica: React aplica estilos vía CSSOM en la navegación del cliente, no vía atributo, así que el problema solo se manifiesta en cargas completas |
| B. Eliminar todo estilo en línea generado por el servidor (mover las barras de progreso a clases CSS) | Total, sin relajar la directiva | La más alta de las tres opciones | Alto: requiere localizar y reescribir cada componente de servidor que hoy calcula un `style=""` dinámico | Total |
| C. Cambiar `style-src` a `'self' 'unsafe-inline'` (elegida) | Total: cualquier estilo en línea generado por el servidor funciona sin excepción | Menor que B para estilos (se acepta cualquier `style=""`), pero `script-src` conserva el nonce y `'strict-dynamic'` sin cambios | Bajo: un cambio de una línea en `security-headers.ts` | Total |

### Decisión

**`style-src` cambiará de `'self' 'nonce-{value}' 'strict-dynamic'` a `'self' 'unsafe-inline'` en `src/shared/config/security-headers.ts`, mientras `script-src` conserva el nonce por petición y `'strict-dynamic'` sin cambios; el cambio está aceptado pero no implementado en el código a la fecha de este documento.**

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

`script-src` conserva el nonce y `'strict-dynamic'`, la superficie de ataque más común (inyección de script) sigue protegida; el cambio en `style-src` se aplicará junto con su prueba correspondiente en `src/shared/config/security-headers.test.ts` durante el paso de TDD de la rama de diseño en curso.

### Diseño

Directiva actual en `main` (a la fecha de este documento) y directiva objetivo, ambas de `src/shared/config/security-headers.ts`:

```ts
// Actual (con nonce disponible):
function styleSrc(nonce: string | undefined): string {
  return nonce
    ? `style-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "style-src 'self' 'unsafe-inline'";
}

// Objetivo (pendiente de implementación):
function styleSrc(): string {
  return "style-src 'self' 'unsafe-inline'";
}
```

`script-src` no cambia en ninguno de los dos estados: conserva `'self' 'nonce-${nonce}' 'strict-dynamic'` cuando hay nonce, y `'self' 'unsafe-inline'` como red de seguridad sin él (`next.config.ts`, rutas fuera del *matcher* del proxy).
