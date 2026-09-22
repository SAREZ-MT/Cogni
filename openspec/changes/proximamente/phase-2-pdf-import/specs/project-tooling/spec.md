# project-tooling Specification (Delta)

## MODIFIED Requirements

### Requirement: Reglas de dependencia verificadas

dependency-cruiser MUST codificar las reglas de la sección 5.3 como errores: (1) `domain` no importa nada externo ni otra capa, (2) `application` solo importa `domain` y puertos, (3) solo `infrastructure` importa Drizzle, Supabase, AI SDK, Upstash o Trigger.dev, (4) `ui` no importa `infrastructure`, (5) un módulo solo se importa a través de su `index.ts`, (6) `study-engine` no importa `flashcards`, `exams` ni `active-recall`, (7) los paquetes de Tiptap y ProseMirror (`@tiptap/*`, `prosemirror-*`) MUST importarse únicamente desde `src/modules/editor/ui`, (8) `@trigger.dev/sdk` MUST importarse únicamente desde `src/trigger/` y desde la capa `infrastructure` de un módulo, (9) `unpdf` MUST importarse únicamente desde `src/modules/ingestion/infrastructure`, y (10) los archivos de `src/trigger/` MUST importar módulos solo a través de su `index.ts` público y MUST NOT importar `src/shared/db` ni ninguna capa `infrastructure` directamente.
(Previously: siete reglas; se agregan las reglas 8, 9 y 10 para Trigger.dev, `unpdf` y `src/trigger/`.)

#### Scenario: Grafo conforme (unit)

- GIVEN el esqueleto de módulos sin violaciones
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando termina con código 0

#### Scenario: Violación de capa (unit)

- GIVEN un archivo de `domain` que importa Drizzle
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla nombrando la regla violada

#### Scenario: Importación de ruta interna (unit)

- GIVEN un archivo que importa `modules/identity/application/...` desde otro módulo
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla indicando que el acceso debe pasar por `index.ts`

#### Scenario: Tiptap importado fuera de `editor/ui` (unit)

- GIVEN un archivo en `editor/domain` o `editor/application` que importa un paquete `@tiptap/*` o `prosemirror-*`
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla nombrando la regla de dependencia violada

#### Scenario: Tiptap permitido en `editor/ui` (unit)

- GIVEN un archivo en `editor/ui` que importa `@tiptap/react`
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando termina con código 0 para esa importación

#### Scenario: Trigger.dev importado fuera de `src/trigger/` e `infrastructure` (unit)

- GIVEN un archivo en `ingestion/application` o `ingestion/ui` que importa `@trigger.dev/sdk`
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla nombrando la regla 8

#### Scenario: `unpdf` importado fuera de `ingestion/infrastructure` (unit)

- GIVEN un archivo en `ingestion/domain`, `ingestion/application` o `src/trigger/` que importa `unpdf`
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla nombrando la regla 9

#### Scenario: Tarea delgada conforme (unit)

- GIVEN un archivo en `src/trigger/` que importa `@trigger.dev/sdk` y `@/modules/ingestion`
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando termina con código 0 para esas importaciones

#### Scenario: Tarea que importa una ruta interna (unit)

- GIVEN un archivo en `src/trigger/` que importa `@/modules/ingestion/application/process-import-job` o `@/shared/db`
- WHEN se ejecuta `pnpm depcruise`
- THEN el comando falla nombrando la regla 10

### Requirement: Estructura de carpetas de la sección 5.4

El repositorio MUST tener `src/app/{(public),(app),api}`, `src/modules/`, `src/shared/{kernel,db,ui,config}`, `drizzle/`, `tests/e2e/` y, a partir de esta fase, `src/trigger/` para las tareas delgadas de Trigger.dev junto con `trigger.config.ts` en la raíz del repositorio. Cada archivo de `src/trigger/` MUST contener solo la declaración de una tarea que delega en `application`, sin lógica de negocio.
(Previously: sin `src/trigger/` ni `trigger.config.ts`.)

#### Scenario: Árbol presente

- GIVEN el repositorio tras la fase 0
- WHEN se inspecciona el árbol de carpetas
- THEN existen todas las rutas anteriores con el alias `@/*` apuntando a `src/`

#### Scenario: Carpeta de tareas presente (unit)

- GIVEN el repositorio tras esta fase
- WHEN se inspecciona la raíz y `src/`
- THEN existen `src/trigger/` con al menos la tarea de importación de PDF y `trigger.config.ts` que apunta a `src/trigger/` como directorio de tareas

### Requirement: Esqueleto de los once módulos

`src/modules/` MUST contener los once módulos declarados. `identity`, `shared`, `notebooks`, `editor` e `ingestion` MUST tener código real; los demás MUST tener solo `index.ts` y `README.md` indicando la fase pendiente, sin lógica de negocio.
(Previously: `ingestion` era un módulo vacío pendiente; pasa a tener código real.)

#### Scenario: Módulos pendientes vacíos (unit)

- GIVEN un módulo de fase futura, por ejemplo `src/modules/study-engine/`
- WHEN se inspecciona su contenido
- THEN contiene `index.ts` sin exportaciones de dominio y un `README.md` que nombra su fase futura

#### Scenario: `notebooks` y `editor` con código real (unit)

- GIVEN `src/modules/notebooks/` y `src/modules/editor/` tras esta fase
- WHEN se inspecciona su contenido
- THEN cada uno tiene `domain`, `application` e `index.ts` con exportaciones reales, y `notebooks` además tiene `infrastructure` y `ui`

#### Scenario: `ingestion` con código real (unit)

- GIVEN `src/modules/ingestion/` tras esta fase
- WHEN se inspecciona su contenido
- THEN tiene `domain`, `application`, `infrastructure`, `ui` e `index.ts` con exportaciones reales, y su `README.md` ya no lo describe como pendiente

## ADDED Requirements

### Requirement: Dependencias de Trigger.dev y `unpdf` fijadas

`package.json` MUST declarar `@trigger.dev/sdk` como dependencia de producción y `trigger.dev` (CLI) como dependencia de desarrollo, ambas en la misma versión de la línea 4.6.x, y `unpdf` como dependencia de producción en la línea 1.8.x, con versiones exactas fijadas en design tras consultar el registro. `pnpm audit --audit-level=high` MUST seguir pasando tras agregarlas.

#### Scenario: Versiones alineadas (unit)

- GIVEN `package.json` tras esta fase
- WHEN se inspeccionan las dependencias
- THEN `@trigger.dev/sdk` y `trigger.dev` tienen la misma versión 4.6.x y `unpdf` una versión 1.8.x

#### Scenario: Auditoría en verde (unit)

- GIVEN las dependencias nuevas instaladas
- WHEN se ejecuta `pnpm audit --audit-level=high`
- THEN el comando termina con código 0

### Requirement: Scripts de Trigger.dev

`package.json` MUST exponer `pnpm trigger:dev`, que ejecuta la CLI de Trigger.dev en modo desarrollo contra el proyecto configurado en `trigger.config.ts`, y `pnpm trigger:deploy`, que despliega las tareas al entorno indicado. Ambos MUST usar la CLI fijada como dependencia de desarrollo, no `npx` con versión flotante. `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm depcruise` MUST seguir funcionando sin conectividad a Trigger.dev.

#### Scenario: Scripts declarados (unit)

- GIVEN `package.json` tras esta fase
- WHEN se inspecciona `scripts`
- THEN existen `trigger:dev` y `trigger:deploy` invocando la CLI local de `trigger.dev`

#### Scenario: Verificación sin conectividad (unit)

- GIVEN un entorno sin acceso a la red
- WHEN se ejecutan `pnpm test`, `pnpm typecheck` y `pnpm depcruise`
- THEN los tres terminan con código 0
