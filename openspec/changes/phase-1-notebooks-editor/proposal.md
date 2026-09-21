# Proposal: Fase 1 — Cuadernos y editor

**Fase 1** (documento maestro §13). **Hecho cuando**: un usuario toma notas de clase completas sin salir de Cogni y las recupera al volver, en producción. Entregables según §13: CRUD de cuadernos y páginas, sidebar, editor Tiptap con todos los bloques de §3.2, menú de comandos `/`, paleta de resaltado Cogni, imágenes a Storage, autosave optimista, `plain_text` materializado.

Change: `phase-1-notebooks-editor` · Store: hybrid (este archivo + Engram `sdd/phase-1-notebooks-editor/proposal`) · Date: 2026-09-20 · Insumos: `exploration.md` (Engram #41), `docs/documento-maestro.md`, ADR 0001, specs canónicas en `openspec/specs/`, reporte de archivo de la Fase 0.

## Intent

La Fase 0 entregó unos cimientos ejecutables sin superficie de producto: un usuario puede registrarse, iniciar sesión y ver un shell vacío. La unidad de estudio de Cogni es la página (§3.1); nada río abajo (importación de PDF, IA, flashcards, exámenes, recordación activa, programación, analítica) puede existir hasta que las páginas contengan contenido y `plain_text`. Este change convierte el shell en una herramienta de toma de notas funcional: cuadernos, páginas, un editor de bloques y persistencia duradera. Es el primer change que entrega valor visible para el usuario y el prerrequisito de toda fase posterior.

Dos follow-ups de la Fase 0 afectan cómo se desarrolla este change y se resuelven primero: ejecutar `drizzle migrate` dentro del build de Vercel para que las tres tablas nuevas existan antes de que el código que las lee esté en producción, y la clave foránea `profiles` → `auth.users` para que las nuevas columnas `owner_id` descansen sobre una base referencialmente sólida.

## Product decisions (cerradas, no reabrir)

| # | Decision | Effect on this change |
|---|---|---|
| 1 | Follow-ups de la Fase 0: migrate-in-build y la FK de `profiles` se hacen **antes** del trabajo de producto; los otros ocho son el **último slice** de este change | Slice 0 y slice 8 más abajo; sin change de mantenimiento aparte |
| 2 | Sin reordenamiento por arrastrar y soltar | `position` es el orden de creación, solo agregando al final; sin caso de uso de reordenamiento, sin UI de reordenamiento |
| 3 | Imágenes: máx. 10 MB; MIME `image/jpeg`, `image/png`, `image/webp`, `image/gif`; bucket privado con RLS por owner; URLs firmadas de corta duración | Los límites se aplican del lado del servidor al emitir el permiso de subida y de nuevo al persistir `PageAsset` |
| 4 | Borrado lógico solo vía `archived_at`; sin papelera ni UI de restauración | Los cuadernos y páginas archivados desaparecen del sidebar; el borrado físico sigue siendo un job de limpieza futuro (§6.2) |

## Scope

### In Scope

- **Trabajo previo (follow-ups de la Fase 0 que afectan el desarrollo de la Fase 1)**: `drizzle migrate` ejecutado como parte del build de Vercel para que las migraciones se apliquen antes que el código desplegado; clave foránea de `profiles.id` hacia `auth.users.id`.
- **Modelo de datos**: schema de Drizzle y migraciones versionadas para `notebooks`, `pages`, `page_assets` exactamente según §6.1 (ids UUID v7, `owner_id`, timestamps, `archived_at`, `content` jsonb, `plain_text`, `content_version`, `position`).
- **Módulo `notebooks`** (hexagonal, siguiendo a `identity`): entidades e invariantes de dominio (jerarquía de dos niveles, reglas de título, ownership, semántica de archivado), casos de uso de application para el CRUD de cuadernos y páginas, `SavePage` con materialización de `plain_text` del lado del servidor y comparar-e-intercambiar (compare-and-swap) de `content_version`, registro de `PageAsset`, fakes en memoria, repositorios Drizzle, adaptador de Supabase Storage.
- **Sidebar y navegación**: árbol de cuadernos y páginas en el shell autenticado (listar, crear, renombrar, definir ícono y color, archivar), reemplazando el estado vacío de la Fase 0; rutas para las vistas de cuaderno y página bajo `(app)`.
- **Módulo `editor`**: conexión de Tiptap y todos los bloques de §3.2 (H1–H3, párrafo, listas con viñetas, numeradas y de tareas, cita, bloque de código con resaltado de sintaxis, imagen, divisor, tabla, callouts idea/nota/advertencia, paleta de resaltado Cogni, negrita, cursiva, subrayado, tachado, código en línea, enlace), menú de comandos `/`, autosave con debounce y actualización optimista mediante un puerto de guardado hacia `notebooks` (§5.2), manejo en la UI del conflicto de versión obsoleta.
- **Pipeline de imágenes**: bucket privado de Storage con RLS por `owner_id`, permiso de subida firmado de corta duración emitido por el servidor, subida directa del navegador a Storage, persistencia de `PageAsset`, URLs de lectura firmadas, actualizaciones del dominio de imagen en `next.config` y de `img-src` en CSP.
- **UI compartida**: primitivos de shadcn/ui requeridos por el editor y el sidebar (menú de comandos, popover, dropdown, dialog), estilizados con el sistema de diseño de Cogni.
- **Tests**: tests unitarios primero para todo el código de domain y application (Strict TDD), tests de componente para los comportamientos del editor y el sidebar, flujos de Playwright para el criterio de aceptación de §13, una subida de imagen y una inserción con `/`; reescritura de `tests/e2e/shell-empty-state.spec.ts`.
- **Follow-ups de la Fase 0 de fin de fase (último slice)**: nonces de CSP, anclaje del proxy matcher `monitoring(?:/|$)`, exposición del `userId` en el gateway de sign-in, `user_signed_in` en el callback de OAuth, semántica de upsert del repositorio, manejo del resultado de `signOut`, resiliencia de `EnsureProfile`, redirect del dominio apex.
- **Metodología**: `design.md` con diagramas de archify en `docs/diagramas/`; specs canónicas actualizadas al archivar; ADRs para cualquier decisión que cambie una ya cerrada.

### Out of Scope

- Reordenamiento por arrastrar y soltar o cualquier reordenamiento manual de cuadernos y páginas.
- Papelera, restauración o borrado físico de los elementos archivados.
- Importación de PDF (Fase 2), funciones de IA y consumidores de `plain_text` (Fase 3 en adelante), técnicas de estudio, calendario, dashboard.
- Colaboración en tiempo real, compartir, acceso multiusuario a un cuaderno.
- Búsqueda de texto completo entre páginas.
- Plantillas de página, exportación a nivel de página, UI de historial de versiones.
- Subir el `bodySizeLimit` global de las Server Actions.
- Pulido del modo oscuro más allá de lo que ya ofrecen los tokens.

## Capabilities

### New Capabilities

- `notebooks`: jerarquía de dos niveles, ciclo de vida de cuaderno y página (crear, renombrar, ícono y color, archivar), autorización por ownership, `position` solo agregando al final, persistencia del contenido de página con `plain_text` del lado del servidor y comparar-e-intercambiar de `content_version`.
- `editor`: conjunto de bloques de §3.2, menú de comandos `/`, paleta de resaltado Cogni y callouts, autosave optimista con debounce a través del puerto de guardado de `notebooks`, reconciliación de conflictos.
- `page-assets`: límites de subida de imagen y política de MIME, bucket privado con RLS por owner, URLs de subida y lectura firmadas de corta duración, registro de `PageAsset` vinculado a la página propietaria.

### Modified Capabilities

- `design-tokens-and-shell`: el requisito "Shell sin funcionalidad de producto" queda superado; el shell ahora aloja el árbol de cuadernos y páginas y el editor. Se agregan primitivos de shadcn/ui a `src/shared/ui/`.
- `identity-auth`: "Tabla `profiles` con creación automática" gana la clave foránea hacia `auth.users`; los follow-ups de fin de fase tocan el sign-in (`userId`), el manejo del resultado de sign-out, la resiliencia de `EnsureProfile` y la semántica de upsert del repositorio.
- `observability-and-delivery`: "Pipeline en `main` con migraciones antes del deploy" cambia para que las migraciones corran dentro del build de Vercel en lugar de como un job de workflow posterior al deploy; los follow-ups de fin de fase tocan las cabeceras de seguridad (nonces de CSP, `img-src`), la analítica (`user_signed_in` en OAuth), el anclaje del proxy matcher y el redirect del apex.
- `project-tooling`: el escenario "Esqueleto de los once módulos" se actualiza porque `notebooks` y `editor` dejan de estar vacíos; nuevas expectativas de dependency-cruiser para el editor (Tiptap solo en `ui`).

## Approach

Replicar la forma del módulo `identity` para `notebooks` y `editor`, manteniendo todas las recomendaciones de arquitectura de la exploración:

| Concern | Decision | Rationale |
|---|---|---|
| `plain_text` | Se calcula solo en el servidor mediante un recorrido puro de dominio sobre el JSON de Tiptap; el cliente nunca lo envía | Única fuente de verdad (§6.2), el dominio se mantiene libre de imports de ProseMirror, 100% testeable como unidad |
| Guardados concurrentes | Comparar-e-intercambiar de `content_version` en `SavePage`; una discrepancia devuelve un `DomainError`, la UI vuelve a pedir los datos y reconcilia | El campo ya existe en §6.1; last-write-wins pierde silenciosamente ediciones con múltiples pestañas |
| Subida de imagen | Una Server Action emite un permiso de subida firmado de corta duración con alcance por owner; el navegador sube directamente a Storage; una segunda Server Action persiste `PageAsset` | Las Server Actions limitan el cuerpo a 1 MB; la subida directa coincide con §9 y preserva el tier de costo cero |
| Puntos de entrada de persistencia | Server Actions para todo el CRUD y los guardados de contenido; sin nuevos route handlers | Mismo patrón que `identity`, coincide con §5.5 |
| Datos del sidebar | Un Server Component carga los cuadernos y páginas activos ordenados por `position`; las mutaciones van vía Server Actions con actualizaciones optimistas de TanStack Query | Dos niveles fijos no necesitan una abstracción de árbol |
| Integración del editor | `editor.ui` contiene Tiptap; `editor` accede a `notebooks` solo a través de su puerto de guardado público en `index.ts` | Dirección de dependencia de §5.2, aplicada por dependency-cruiser |
| Primitivos de UI | Inicializar shadcn/ui sobre los tokens existentes y agregar solo los primitivos que necesitan el editor y el sidebar | Stack cerrado (ADR 0001); evita construir menús y popovers a mano |

La entrega es auto-chain con alrededor de 400 líneas de autoría cambiadas por PR. El orden de slices recomendado es una guía para `sdd-tasks`, que fija el corte final y pronostica el presupuesto:

| Slice | Content | Exit condition |
|---|---|---|
| 0 | Trabajo previo: migrate-in-build, migración de la FK de `profiles` | Migración aplicada en `cogni-dev` y `cogni-prod` por el build; FK visible en el schema |
| 1 | Schema y migraciones de Drizzle para las tres tablas; entidades e invariantes de dominio de `notebooks`; casos de uso de CRUD y `SavePage`; fakes en memoria; tests unitarios | Suite unitaria en verde; sin UI |
| 2 | Repositorios Drizzle; árbol del sidebar y rutas de notebook/page; Server Actions de CRUD; primitivos de shadcn necesarios aquí; reescritura de `shell-empty-state.spec.ts` | El usuario crea, renombra y archiva cuadernos y páginas en preview |
| 3 | Esqueleto del editor: Tiptap, bloques principales (encabezados, párrafo, listas, lista de tareas, cita, bloque de código, divisor, marcas, enlaces), menú `/`, guardado explícito hacia `SavePage` | Los bloques principales persisten y recargan |
| 4 | Autosave (debounce, actualización optimista), manejo de conflicto de `content_version`, extractor puro de `plain_text` con tests de dominio; flujo de Playwright de aceptación | El criterio de §13 pasa de punta a punta en preview |
| 5 | Bloques restantes: tablas, callouts, paleta de resaltado, tema de resaltado de sintaxis, estilos del sistema de diseño | Todos los bloques de §3.2 disponibles desde `/` |
| 6 | Pipeline de imágenes: bucket, RLS, permiso de subida firmado, bloque de imagen, `PageAsset`, `next.config` y `img-src` de CSP; flujo de Playwright de imagen | Subir, renderizar y recargar una imagen funciona en preview |
| 7 | Documentación: diagramas de archify, TSDoc en puertos y casos de uso, deltas de specs canónicas reconciliados | Diagramas de `design.md` presentes en `docs/diagramas/` |
| 8 | Follow-ups de fin de fase de la Fase 0 (los ocho ítems) | Cada ítem verificado con su propio test o revisión manual |

Los slices 3 y 5 tienen el mayor riesgo de superar las 400 líneas de autoría por la cantidad de extensiones de Tiptap; `sdd-tasks` puede subdividirlos más. El slice 7 puede incorporarse al slice que produce cada artefacto si el presupuesto lo permite.

## Constraints

- **Reglas de dependencia (§5.3, dependency-cruiser)**: `domain` solo importa `shared/kernel` y Zod; `application` nunca importa `infrastructure` ni `ui`; `ui` y `app` nunca importan `infrastructure`; los imports entre módulos solo pasan por `index.ts`. Los paquetes de Tiptap y ProseMirror solo están permitidos en `editor/ui`.
- **Capas hexagonales** siguiendo a `identity`: entidades y puertos en `domain`, casos de uso que devuelven `Result<T, DomainError>` con parseo de entrada con Zod en `application`, adaptadores en `infrastructure`, Server Actions en `ui`.
- **Autorización**: cada caso de uso recibe `ownerId` de la sesión y filtra por él (§6.1, §9); RLS se omite en la conexión del pooler del servidor y permanece activo en Storage.
- **Tier de costo cero**: Vercel Hobby y el tier gratuito de Supabase; sin buffering de subidas del lado del servidor; sin nuevos servicios pagos.
- **Strict TDD**: cada unidad de domain y application empieza con su test de Vitest; cobertura del 100% en el extractor de `plain_text` y en las invariantes; flujos de Playwright para el criterio de aceptación.
- **Presupuesto de revisión**: 400 líneas de autoría cambiadas por PR con auto-chain; la estrategia de encadenado se elige en el momento de tasks.
- **Convenciones**: código e identificadores en inglés, comentarios en inglés simple, textos de UI en español con tratamiento de "tú" según el sistema de diseño de Cogni, Conventional Commits sin atribución a IA.
- **Versión de Next.js**: leer `node_modules/next/dist/docs/` antes de escribir código de app o de Server Action; la versión 16.x instalada tiene cambios disruptivos respecto a los datos de entrenamiento.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/shared/db/schema.ts`, `drizzle/` | Modified / New | Tablas `notebooks`, `pages`, `page_assets`; migración de la FK de `profiles` |
| `src/modules/notebooks/{domain,application,infrastructure,ui,index.ts}` | New | Entidades, invariantes, casos de uso, fakes, repositorios Drizzle, adaptador de Storage, Server Actions, componentes del árbol del sidebar |
| `src/modules/editor/{domain,application,ui,index.ts}` | New | Extensiones de Tiptap, conjunto de bloques, menú `/`, paleta de resaltado, hook de autosave, UI de conflicto |
| `src/app/(app)/` (layout, sidebar, rutas de notebook y page) | Modified / New | Árbol en el sidebar; rutas para las vistas de notebook y page |
| `src/shared/ui/`, `components.json` | Modified | Inicialización de shadcn/ui y primitivos requeridos |
| `src/shared/config/env.schema.ts` | Modified | Nombre del bucket de Storage y cualquier configuración de URL firmada |
| `next.config.*` | Modified | `images.remotePatterns` y `img-src` de CSP para Storage; nonces de CSP en el slice 8 |
| `vercel.json`, `.github/workflows/main.yml`, `package.json` | Modified | Migrate-in-build; eliminar o adaptar el job de migración posterior al deploy |
| `tests/e2e/` | Modified / New | Reescritura de `shell-empty-state.spec.ts`; flujos de aceptación, de imagen y del menú `/` |
| `docs/diagramas/`, `docs/adr/` | New | Diagramas de archify; ADRs solo si cambia una decisión cerrada |
| `openspec/specs/{notebooks,editor,page-assets}` y las cuatro specs existentes | New / Modified | Se promueven al archivar |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Tipos de Tiptap o ProseMirror se filtran a `notebooks/domain` o `editor/domain` a través del extractor | Med | El extractor se tipa contra una forma local de JSON de Tiptap; la regla de dependency-cruiser se acota a `editor/ui`; se señala en `design.md` |
| Migrate-in-build falla o bloquea un build de Vercel, tumbando producción con él | Med | Probar primero en preview (`cogni-dev`); el build falla de forma segura (fail-closed), el deployment anterior sigue activo; plan de reversión más abajo |
| Los slices 3 y 5 superan el presupuesto de 400 líneas | High | `sdd-tasks` pronostica por slice y divide por familia de bloques; nunca recortar tests o comentarios para ajustar |
| El bucket de Storage, las políticas RLS y el flujo de URL firmada no tienen precedente en la Fase 0 | Med | Slice 6 dedicado con un test negativo de RLS (lectura entre usuarios denegada); el aprovisionamiento del bucket se documenta como un paso del usuario |
| El JSON de página para notas largas se acerca al límite de 1 MB de las Server Actions | Low | Medir el tamaño del payload en el flujo de aceptación; los bytes de imagen nunca viajan por Server Actions |
| La ruta de conflicto de `content_version` está subdimensionada en tests | Med | Escenario unitario explícito (escritura obsoleta rechazada) y un test de componente para la UI de reconciliación |
| `shell-empty-state.spec.ts` se rompe silenciosamente en cuanto cambia el sidebar | High | Reescribirlo como una tarea explícita en el slice 2 |
| El slice 8 crece más allá de un PR | Med | Agrupar por localidad de archivos; dividir en dos PR si el pronóstico supera el presupuesto |
| Idioma del artefacto: esta propuesta está en inglés mientras el contexto de `openspec/config.yaml` declara que los artefactos de SDD van en español neutro | Low | Sigue el contrato de idioma explícito del orchestrator para este change; `exploration.md` sentó el precedente; confirmar la convención en el momento de spec |

## Rollback Plan

- **Migraciones**: cada migración nueva se entrega con una migración de reversión versionada (`drop table page_assets, pages, notebooks`; `alter table profiles drop constraint`). Aplicar la migración de reversión en `cogni-dev` es parte del test de migración.
- **Migrate-in-build**: revertir `vercel.json` / el build command y restaurar el job del workflow; ambos cambios viven en el PR del slice 0, de modo que un solo revert restaura el comportamiento de la Fase 0.
- **Superficie de producto**: notebooks, editor y sus rutas son aditivos. Revertir el PR del slice elimina la superficie; el auth y el shell existentes siguen funcionando porque `identity` no es tocado por los slices de producto.
- **Storage**: eliminar el bucket y sus políticas en Supabase; ningún otro componente depende de él.
- **CSP y dominios de imagen**: revertir `next.config`; la CSP estática anterior es la línea base conocida como buena.
- **Follow-ups de fin de fase**: cada uno es reversible de forma independiente; el PR del slice 8 es la unidad de reversión.

## Dependencies

- Bucket de Supabase Storage creado en `cogni-dev` y `cogni-prod` (paso del usuario en el dashboard; nombre exacto y políticas especificados en `design.md`).
- Cambio del build command de Vercel (dashboard del usuario o `vercel.json`) y URL de base de datos disponible en tiempo de build para migrate-in-build.
- Nuevas variables de entorno para el bucket; valores de `.env.local` y pasos del dashboard documentados para el usuario.
- Paquetes npm: núcleo y extensiones de Tiptap, resaltado de sintaxis, TanStack Query, Zustand (fijados por ADR 0001), CLI de shadcn/ui.
- Sin nuevos servicios pagos.

## Success Criteria

- [ ] En producción, un usuario crea un cuaderno y una página, escribe notas usando cada familia de bloques de §3.2, cierra el navegador, vuelve a iniciar sesión y encuentra el contenido intacto (criterio de §13).
- [ ] Los flujos de Playwright pasan en `main`: flujo de aceptación, subida y renderizado de imagen, inserción con el comando `/`.
- [ ] `pages.plain_text` se completa en cada guardado y coincide con la salida testeada como unidad del extractor; el cliente nunca lo envía.
- [ ] Un guardado obsoleto (discrepancia de `content_version`) es rechazado por `SavePage` y la UI reconcilia sin pérdida de datos.
- [ ] Una URL firmada para el asset de otro usuario es rechazada por RLS de Storage (test negativo).
- [ ] Las subidas mayores a 10 MB o fuera de la lista de MIME permitidos se rechazan antes de que cualquier byte llegue a Storage.
- [ ] CI en verde en cada PR: Biome, `tsc --noEmit`, Vitest, dependency-cruiser, `pnpm audit`; cobertura del 100% en el extractor de `plain_text` y en las invariantes de dominio.
- [ ] Cada PR de la cadena se mantiene dentro de las ~400 líneas de autoría cambiadas o lleva un `size:exception` explícito.
- [ ] `drizzle migrate` corre dentro del build de Vercel; `profiles` tiene la FK hacia `auth.users`.
- [ ] Los ocho follow-ups de fin de fase quedan cerrados con su propia verificación.
- [ ] `design.md` incluye diagramas de archify en `docs/diagramas/`; al archivar, `openspec/specs/` gana `notebooks`, `editor`, `page-assets` y las cuatro specs existentes reflejan el comportamiento implementado.
