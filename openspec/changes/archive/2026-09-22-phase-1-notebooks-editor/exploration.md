## Exploration: Fase 1 — Cuadernos y editor

Change: `phase-1-notebooks-editor` · Store: hybrid (this file + Engram topic `sdd/phase-1-notebooks-editor/explore`, observation #41) · Date: 2026-09-20

### Current State

Fase 0 entregó únicamente los cimientos ejecutables: Next.js 16.3.5 App Router, Supabase Auth (módulo `identity` totalmente implementado como el módulo hexagonal de referencia), Drizzle con una tabla (`profiles`), tokens de diseño, shell (sidebar + topbar con un único enlace "Inicio"), Sentry/PostHog, CI/CD. Los módulos `notebooks` y `editor` son esqueletos vacíos (solo `index.ts` + README, sin domain/application/infrastructure/ui). Todavía no están instalados Tiptap, TanStack Query ni Zustand, pese a ser decisiones de stack ya cerradas (ADR 0001). No existe `components.json` de `shadcn/ui`; `src/shared/ui/` solo tiene un `button.tsx` hecho a mano y `utils.ts` (`cn`). No hay bucket de Supabase Storage ni variables de entorno configuradas. El test e2e actual `tests/e2e/shell-empty-state.spec.ts` verifica que el shell muestra **únicamente** un estado vacío y comprueba que `getByRole("link", { name: /cuadernos/i })` tiene conteo 0 — este test es un objetivo directo de regresión para la Fase 1 y debe reescribirse, no solo extenderse.

`identity` es el patrón a replicar: `domain/` (entidades puras + puertos, p. ej. `AuthGateway`, `Profile`), `application/` (casos de uso que devuelven `Result<T, DomainError>`, validación con Zod vía `parseInput`, fakes para tests: `FakeAuthGateway`, `InMemoryProfileRepository`), `infrastructure/` (adaptadores de Supabase/Drizzle, p. ej. `DrizzleProfileRepository`, `SupabaseAuthGateway`), `ui/` + `actions.ts` (Server Actions que llaman a `application`, hacen redirects, analítica diferida con `after()`). `dependency-cruiser` exige: `domain` no importa nada salvo `shared/kernel` y Zod; `application` nunca importa `infrastructure`/`ui`; `ui`/`app` nunca importan `infrastructure` directamente; los imports entre módulos solo pasan por `index.ts`.

### Affected Areas

- `src/modules/notebooks/**` — nuevo: domain (entidades e invariantes de Notebook, Page, PageAsset), application (casos de uso CRUD, `SavePage` con materialización de `plain_text`), infrastructure (repositorios Drizzle, adaptador de Supabase Storage), ui (árbol del sidebar, formularios CRUD de notebook/page).
- `src/modules/editor/**` — nuevo: extensiones/schema de Tiptap para cada bloque de §3.2, menú de comandos `/`, paleta de resaltado, hook de autosave conectado a `notebooks` mediante un puerto de guardado (según la dependencia de §5.2: `editor` → `notebooks`).
- `src/shared/db/schema.ts` — agregar las tablas `notebooks`, `pages`, `page_assets` (Drizzle), migraciones bajo `drizzle/`.
- `src/app/(app)/_components/sidebar.tsx` y `layout.tsx` — actualmente fijos a un único enlace "Inicio"; necesitan una sección de árbol de cuadernos/páginas.
- `src/shared/config/env.schema.ts` — necesita nombre del bucket de Storage / configuración de URL firmada si se introducen nuevas variables de entorno.
- `src/shared/ui/**` — necesita la configuración de `shadcn/ui` (falta `components.json`) o continuar con componentes hechos a mano; el editor necesita varios primitivos de UI (menú, popover, dropdown) que todavía no existen.
- `tests/e2e/shell-empty-state.spec.ts` — las aserciones de "sin funcionalidad de producto" dejan de cumplirse en cuanto se lancen los cuadernos; debe actualizarse en el mismo PR que agrega el árbol del sidebar.
- `next.config.*` — los dominios de imagen (`images.remotePatterns`) y la directiva `img-src` de CSP deben permitir el dominio de Supabase Storage una vez que se rendericen imágenes.
- `.dependency-cruiser.cjs` — no se necesitan cambios; las reglas existentes ya cubren los nuevos módulos de forma genérica, pero el extractor de plain_text DEBE seguir cumpliendo dependency-cruiser (domain no puede importar los paquetes npm de Tiptap/ProseMirror).

### Requirements Extracted from Master Doc

- §3.1: jerarquía estricta de dos niveles Usuario → Cuaderno → Página. Sin subpáginas, sin carpetas dentro de carpetas.
- §3.2 bloques del editor (exhaustivo, todos obligatorios): H1–H3, párrafos, listas con viñetas, listas numeradas, listas de tareas, citas, bloques de código con resaltado de sintaxis, imágenes (Supabase Storage), divisores, tablas, callouts (idea/nota/advertencia), resaltado de texto (paleta Cogni), negrita, cursiva, subrayado, tachado, código en línea, enlaces. Además, menú de comandos `/`, autosave con debounce y actualización optimista, persistencia en JSON + `plain_text` materializado.
- §6.1 el modelo de datos ya fija la forma: `Notebook{title, icon, color, position, archived_at}`, `Page{notebook_id, title, content jsonb, plain_text, content_version, position, archived_at}`, `PageAsset{page_id, storage_path, mime, size_bytes}`. `content_version` implica fuertemente que se espera manejo de concurrencia optimista, no que sea opcional.
- §6.2: `plain_text` se recalcula en cada guardado; RLS se omite del lado del servidor (la autorización es explícita en `application`, filtrada por `owner_id`); RLS permanece activo para Storage y cualquier acceso de `supabase-js` desde el cliente; solo borrado lógico (`archived_at`), el borrado físico es un job de limpieza aparte (fuera del alcance de la Fase 1).
- §9: los buckets de Storage son privados con políticas RLS por `owner_id` y URLs firmadas de corta duración — este es un requisito de seguridad estricto para el bloque de imagen, no un "nice-to-have".
- §13 Fase 1 "hecho cuando": un usuario toma notas de clase completas sin salir de Cogni y las recupera al volver — es decir, la barra de aceptación es persistencia entre recargas más cobertura completa de bloques, no funcionalidad parcial del editor.

### Approaches

1. **Estrategia de autosave — debounce con envío de plain_text del lado cliente vs. recomputación exclusiva del servidor**
   - Recomendación: el cliente aplica debounce (p. ej. 800ms–1.5s) y envía únicamente el `content` en JSON de Tiptap; el servidor (capa application) es el **único** lugar que calcula `plain_text` a partir de `content`, usando una función pura de dominio (recorrido del AST sobre el JSON de Tiptap, sin importar ProseMirror) para que siga cumpliendo dependency-cruiser y sea testeable como unidad. Nunca confiar en un `plain_text` enviado por el cliente.
   - Ventajas: única fuente de verdad, coincide con la redacción de §6.2 ("se recalcula en cada guardado"), mantiene el dominio puro y 100% testeable en Vitest.
   - Desventajas: el servidor debe mantener una implementación liviana de recorrido de AST independiente del propio `getText()` de Tiptap (que requiere el editor y el schema completos y no es segura para el dominio).
   - Esfuerzo: Medio.

2. **Concurrencia optimista al guardar — comparar-e-intercambiar (compare-and-swap) con `content_version` vs. last-write-wins**
   - Recomendación: comparar-e-intercambiar usando `content_version` (application rechaza un guardado cuya versión no coincida con la actual, devuelve un `DomainError`, la UI reconcilia/vuelve a pedir los datos). Coincide con el campo ya presente en el modelo de datos y con el patrón de mutación/rollback de TanStack Query.
   - Desventajas: agrega una rama de fallo más al diseño/tests (conflicto de versión obsoleta).
   - Esfuerzo: Bajo–Medio.
   - Alternativa (last-write-wins, ignorando la semántica de `content_version`): más simple, pero pierde ediciones silenciosamente en uso con múltiples pestañas; no se recomienda dado que el campo ya existe y tomar notas en múltiples pestañas con un solo usuario es un escenario realista para estudiantes.

3. **Ruta de subida de imágenes — proxy multipart vía Server Action vs. subida firmada directa del cliente a Storage**
   - Hallazgo (verificado contra `node_modules/next/dist/docs`): las Server Actions de Next.js tienen un **límite por defecto de 1MB** en el cuerpo de la petición (`experimental.serverActions.bodySizeLimit`), incluyendo el overhead del boundary multipart. Las fotos/capturas de notas de clase típicas superan 1MB con frecuencia.
   - Recomendación: el cliente solicita una URL/token de subida firmada de corta duración a una Server Action (`application.RequestImageUploadUrl`, con alcance por owner), y luego sube directamente a Supabase Storage desde el navegador; solo los metadatos del `storage_path`/asset resultante pasan por una Server Action para persistir una fila de `PageAsset`. Esto evita subir `bodySizeLimit` de forma global (lo que también relajaría el límite para la acción de guardado del contenido de la página) y coincide con las "URLs firmadas de corta duración" de §9.
   - Alternativa (subir `bodySizeLimit` y hacer proxy de las subidas mediante una Server Action): flujo de control más simple, pero acopla una subida arbitraria del límite global del cuerpo de las Server Actions a las subidas de imágenes, y de todos modos exige que el servidor almacene en buffer el archivo completo, desperdiciando el presupuesto serverless del tier Hobby mencionado en §10.3 (operación de costo cero).
   - Esfuerzo: Medio (necesita un caso de uso que emita URLs firmadas + políticas RLS de Storage + conexión de subida del lado cliente), pero con menor riesgo operativo.

4. **Forma de los datos del árbol del sidebar/página — dado que la jerarquía está fija en 2 niveles (§3.1), no hace falta un árbol real**
   - Recomendación: un Server Component carga los cuadernos activos del owner y sus páginas activas (o carga las páginas de forma perezosa por cuaderno al expandir) ordenadas por `position`; las mutaciones (crear/renombrar/archivar/reordenar) pasan por Server Actions con actualizaciones optimistas de TanStack Query en el cliente para una UI ágil, siguiendo el patrón de Server Action del módulo identity. El reordenamiento por arrastrar y soltar es un asunto aparte y opcional (ver decisiones de producto abiertas).
   - Esfuerzo: Bajo (forma de los datos) una vez que existan los casos de uso CRUD.

5. **Server Actions vs. Route Handlers para la persistencia del editor**
   - Recomendación: mantener Server Actions para el CRUD y el guardado de contenido (consistente con el patrón de `identity` y con el diagrama de flujo "Server Action → application" de §5.4 en §5.5), reservando los route handlers solo para el callback de confirmación de la subida firmada si Supabase requiere un endpoint tipo webhook (no lo requiere para subidas directas del cliente con `supabase-js`, así que probablemente no se necesite un nuevo route handler para imágenes).

### Phase 0 Follow-ups: Fold vs Defer

Los 10 ítems del reporte de archivo de la fase 0 están nominalmente etiquetados "(Phase 1)" pero solo tocan tangencialmente notebooks/editor:

- **Bajo riesgo, baratos de incorporar de forma oportunista** si un PR tiene margen de presupuesto: restricción FK de profiles (migración de una línea), timing de drizzle-migrate-in-build, regex de anclaje del proxy matcher. Son solo de infraestructura, sin superficie de producto.
- **Se recomienda diferir a un change de mantenimiento pequeño y aparte** (mantiene el diff de la Fase 1 enfocado en su propio criterio de aceptación): nonces de CSP, exposición del userId en sign-in, evento de analítica de OAuth, semántica de upsert del repositorio, manejo del resultado de signOut, resiliencia de ensureProfile, redirect del dominio apex. Ninguno de estos bloquea "un usuario toma notas y las recupera".
- Una excepción a señalar para el diseño: renderizar imágenes de todas formas requerirá tocar `images.remotePatterns` en `next.config` y la directiva `img-src` de CSP — esto es trabajo nuevo de la Fase 1, no el follow-up diferido de nonces de CSP, pero el diseño debería hacer ambos toques de CSP en el mismo pase de revisión para evitar dos diffs de CSP separados.

### Risks

- Incorporar Tiptap y dependencias adyacentes a editores colaborativos (basadas en ProseMirror) en la capa `ui` de `editor` conlleva el riesgo de filtración accidental hacia `domain` si las funciones de extracción se construyen con descuido; dependency-cruiser lo detectará en CI, pero solo después del hecho — debe señalarse explícitamente en design.md.
- `tests/e2e/shell-empty-state.spec.ts` tiene aserciones estrictas que empezarán a fallar en cuanto aparezca un enlace de cuaderno; esta es una edición requerida, no incidental, y debe ser una tarea explícita.
- Todavía no existe scaffolding de `shadcn/ui`; el editor necesita varios primitivos interactivos (menú de comandos, popovers, dropdowns, controles de tabla) — decidir ahora si se configura shadcn/ui o se construye todo a mano cambia sustancialmente el esfuerzo y debe resolverse en el diseño, no dejarse por defecto en silencio.
- El límite por defecto de 1MB en el cuerpo de las Server Actions es una trampa fácil tanto para los payloads grandes de JSON de página (notas de clase largas con muchos bloques) como para las subidas de imágenes; debe dimensionarse y probarse explícitamente.
- El bucket de Supabase Storage, las políticas RLS y el flujo de URL firmada son infraestructura nueva sin precedente previo en la Fase 0 del cual copiar — presupuestar tiempo extra de diseño/spike.
- El manejo de concurrencia optimista de `content_version` agrega una superficie de test considerable (conflicto de escritura obsoleta) que es fácil de subdimensionar en tasks.md.

### Open Product Decisions (el orchestrator debe preguntárselas al usuario)

1. ¿Los 10 follow-ups diferidos de la Fase 0 deben incorporarse de forma oportunista en los PR de la Fase 1 donde sea barato, o mantenerse íntegramente como un change pequeño y separado para que el diff de la Fase 1 quede acotado solo a notebooks/editor?
2. ¿El reordenamiento por arrastrar y soltar de cuadernos/páginas está en el alcance de la Fase 1, o basta con el orden de creación inicial (vía `position`, solo agregando al final) hasta una fase posterior?
3. ¿Existe una política de tamaño máximo de imagen / tipos MIME permitidos para el bloque de imagen, o la Fase 1 debe elegir unilateralmente un valor por defecto razonable (p. ej. 10MB, tipos de imagen comunes)?
4. ¿Los cuadernos/páginas archivados (borrado lógico) deben poder recuperarse mediante una UI de "papelera" en la Fase 1, o es aceptable archivar sin UI de restauración hasta una fase posterior?

### Testability Implications (Strict TDD)

- La lógica de dominio de `notebooks` y `editor` (invariantes de página/cuaderno, el extractor AST de `plain_text`, la matemática de posición/reordenamiento) debe seguir el precedente del módulo `identity`: funciones/entidades puras, `Result<T, DomainError>`, con tests unitarios primero y cobertura del 100% donde §4.4 ya lo exige para lógica calculada; incluso donde no es obligatorio, se espera TDD en la capa de dominio según el "estricto en dominio" de §4.4.
- Los casos de uso de application necesitan fakes en memoria (`InMemoryNotebookRepository`, `InMemoryPageRepository`, `FakeStorageGateway`) que reflejen a `FakeAuthGateway`/`InMemoryProfileRepository`, permitiendo correr Vitest sin una conexión real a Supabase/Drizzle.
- Los e2e de Playwright deben cubrir de punta a punta el criterio de "hecho" de la Fase 1 de §13: crear cuaderno → crear página → escribir con varios tipos de bloque → recargar → el contenido persiste; más al menos un flujo de subida de imagen y una inserción con el menú de comandos `/`, según la guía del documento maestro de "3 a 5 flujos críticos" (§4.4).
- La reescritura de las aserciones de `shell-empty-state.spec.ts` debe planificarse como una tarea, no descubrirse a mitad de la implementación.

### Methodology Improvements Adopted for This Phase

1. `design.md` debe incluir diagramas de arquitectura generados con archify en `docs/diagramas/` (documento maestro §4.4).
2. Al archivar, las specs canónicas en `openspec/specs/` se actualizan donde la implementación se haya desviado de ellas.

### Slice Plan Hint (PRs encadenadas, ~400 líneas de autoría cada una, auto-chain)

1. Modelo de datos: schema de Drizzle (notebooks/pages/page_assets) + migración + entidades/invariantes de dominio de notebooks + casos de uso CRUD de application + fakes en memoria + tests unitarios. Sin UI.
2. Infraestructura de notebooks (repositorios Drizzle) + UI del árbol del sidebar (listar/crear/renombrar/archivar) vía Server Actions, reemplazando el estado vacío actual; actualizar `shell-empty-state.spec.ts`.
3. Esqueleto del editor: conexión de Tiptap, bloques principales (encabezados, párrafos, listas, lista de tareas, cita, bloque de código, divisor, marcas, enlaces), menú `/`, guardado manual conectado a `SavePage`.
4. Autosave (debounce + actualización optimista) + manejo de conflicto de `content_version` + extractor puro de `plain_text` + tests de dominio.
5. Bloques restantes: tablas, callouts, paleta de resaltado, estilos según el sistema de diseño.
6. Pipeline de imágenes: bucket de Storage + RLS + subida firmada + bloque de imagen + persistencia de `PageAsset` + actualizaciones de `next.config`/CSP.
7. Opcional: incorporar los follow-ups baratos de la Fase 0 si queda presupuesto, o si no, un change aparte.

Las fases de design/tasks deben tratar esto como una guía, no como el corte final.

### Recommendation

Avanzar a `sdd-propose` presentando primero al usuario las cuatro decisiones de producto abiertas de arriba (o diferirlas explícitamente con valores por defecto documentados si el usuario prefiere mantener el ritmo). Las preguntas de arquitectura (autosave, subida de imágenes, materialización de plain_text, concurrencia) ya tienen respuestas recomendadas claras arriba y no necesitan bloquear la redacción de la propuesta.

### Ready for Proposal

Sí — a la espera de que las cuatro decisiones de producto abiertas se respondan o se difieran explícitamente con un valor por defecto documentado.
